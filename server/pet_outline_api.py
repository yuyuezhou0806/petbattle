import asyncio
import base64
import io
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageDraw, ImageFilter, ImageOps, UnidentifiedImageError
from rembg import new_session, remove
from game_backend import close_backend, init_backend, router as game_router

app = FastAPI(title="Pet Battle Image API")
session = new_session("u2netp")
app.include_router(game_router)


@app.on_event("startup")
def startup_backend():
    init_backend()


@app.on_event("shutdown")
def shutdown_backend():
    close_backend()

MAX_IMAGE_BYTES = 12 * 1024 * 1024
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
SERVER_DIR = Path(__file__).resolve().parent
KNOWLEDGE_PATH = next(
    path for path in (
        SERVER_DIR.parent / "knowledge" / "pet-breeds.zh-CN.json",
        SERVER_DIR / "knowledge" / "pet-breeds.zh-CN.json",
    )
    if path.exists()
)


def load_knowledge() -> dict[str, Any]:
    with KNOWLEDGE_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


KNOWLEDGE = load_knowledge()
SPECIES_BY_ID = {item["id"]: item for item in KNOWLEDGE["species"]}
CAT_BY_ID = {item["id"]: item for item in KNOWLEDGE["catCategories"]}


@app.get("/health")
def health():
    return {
        "ok": True,
        "recognitionConfigured": bool(os.getenv("OPENAI_API_KEY")),
        "knowledgeVersion": KNOWLEDGE["version"],
    }


async def read_image(file: UploadFile) -> bytes:
    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "图片不能超过 12 MB")
    if not content:
        raise HTTPException(422, "没有读取到图片内容")
    return content


def normalized_source(content: bytes, max_size: int) -> Image.Image:
    try:
        source = ImageOps.exif_transpose(Image.open(io.BytesIO(content))).convert("RGB")
        source.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        return source
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(422, "无法读取这张图片") from exc


def openai_response_text(payload: dict[str, Any]) -> str:
    for output in payload.get("output", []):
        for content in output.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                return content["text"]
    raise ValueError("AI 响应中没有结构化识别结果")


def request_identification(image_data_url: str) -> dict[str, Any]:
    category_lines = [
        f'- {item["id"]}: {item["name"]}（{item["classification"]}），别名：{"、".join(item["aliases"])}'
        for item in KNOWLEDGE["catCategories"]
    ]
    prompt = """你是宠物照片分类器。先判断照片中的主要宠物物种，再在给定的猫咪游戏词表中提供至多 3 个候选。
规则：
1. 只根据肉眼可见特征判断，不得把花色说成正式血统。
2. 没有血统证书时，正式品种只能叫“品种候选”，置信度不要虚高。
3. 狸花、三花、橘猫、奶牛猫、黑猫、白猫属于外观或花色分类。
4. 如果不是猫，或看不清，cat_candidates 返回空数组。
5. breed_id 只能使用下面列出的 ID；不确定的猫优先使用 other-cat。

猫咪标准词表：
""" + "\n".join(category_lines)

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "species_id": {"type": "string", "enum": list(SPECIES_BY_ID)},
            "species_confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "observations": {"type": "string"},
            "cat_candidates": {
                "type": "array",
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "breed_id": {"type": "string", "enum": list(CAT_BY_ID)},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "reason": {"type": "string"},
                    },
                    "required": ["breed_id", "confidence", "reason"],
                },
            },
        },
        "required": ["species_id", "species_confidence", "observations", "cat_candidates"],
    }
    body = {
        "model": os.getenv("OPENAI_VISION_MODEL", "gpt-5.4-nano"),
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": image_data_url, "detail": "high"},
            ],
        }],
        "text": {"format": {"type": "json_schema", "name": "pet_identification", "strict": True, "schema": schema}},
    }
    request = urllib.request.Request(
        OPENAI_RESPONSES_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f'Bearer {os.environ["OPENAI_API_KEY"]}',
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API {exc.code}: {error_body[:400]}") from exc
    return json.loads(openai_response_text(response_payload))


@app.post("/identify")
async def identify(file: UploadFile = File(...)):
    content = await read_image(file)
    if not os.getenv("OPENAI_API_KEY"):
        return {
            "available": False,
            "message": "AI 品种识别尚未配置，可先手动选择品类和细分类。",
            "knowledgeVersion": KNOWLEDGE["version"],
            "candidates": [],
        }

    source = normalized_source(content, 1024)
    buffer = io.BytesIO()
    source.save(buffer, format="JPEG", quality=86, optimize=True)
    image_data_url = "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    try:
        result = await asyncio.to_thread(request_identification, image_data_url)
    except Exception as exc:
        raise HTTPException(502, "AI 识别暂时不可用，请手动选择或稍后重试") from exc

    species_id = result.get("species_id") if result.get("species_id") in SPECIES_BY_ID else "cat"
    candidates = []
    for candidate in result.get("cat_candidates", []):
        knowledge = CAT_BY_ID.get(candidate.get("breed_id"))
        if not knowledge:
            continue
        confidence = max(0.0, min(1.0, float(candidate.get("confidence", 0))))
        candidates.append({
            "id": knowledge["id"],
            "name": knowledge["name"],
            "classification": knowledge["classification"],
            "confidence": confidence,
            "reason": candidate.get("reason", ""),
            "summary": knowledge["summary"],
            "visualCues": knowledge["visualCues"],
        })
    candidates.sort(key=lambda item: item["confidence"], reverse=True)
    best_confidence = candidates[0]["confidence"] if candidates else 0
    return {
        "available": True,
        "speciesId": species_id,
        "speciesName": SPECIES_BY_ID[species_id]["name"],
        "speciesConfidence": max(0.0, min(1.0, float(result.get("species_confidence", 0)))),
        "observations": result.get("observations", ""),
        "needsConfirmation": best_confidence < 0.82 or species_id != "cat",
        "knowledgeVersion": KNOWLEDGE["version"],
        "candidates": candidates,
        "disclaimer": KNOWLEDGE["scope"],
    }


@app.post("/outline")
async def outline(file: UploadFile = File(...)):
    content = await read_image(file)
    source = normalized_source(content, 1280)
    try:
        buffer = io.BytesIO()
        source.save(buffer, format="JPEG", quality=92)
        cutout_bytes = remove(buffer.getvalue(), session=session, alpha_matting=True)
        cutout = Image.open(io.BytesIO(cutout_bytes)).convert("RGBA")
    except Exception as exc:
        raise HTTPException(422, "无法识别宠物主体") from exc

    bbox = cutout.getbbox()
    if not bbox:
        raise HTTPException(422, "照片中没有识别到清晰的宠物")
    cutout = cutout.crop(bbox)

    canvas_size = 1100
    max_subject = 880
    scale = min(max_subject / cutout.width, max_subject / cutout.height, 1.5)
    subject = cutout.resize(
        (max(1, int(cutout.width * scale)), max(1, int(cutout.height * scale))),
        Image.Resampling.LANCZOS,
    )

    alpha = subject.getchannel("A")
    glow = alpha.filter(ImageFilter.GaussianBlur(24))
    outline_wide = alpha.filter(ImageFilter.MaxFilter(31))
    outline_inner = alpha.filter(ImageFilter.MaxFilter(15))

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (248, 247, 244, 255))
    decorations = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(decorations)
    draw.ellipse((-220, -260, 560, 520), fill=(255, 221, 208, 145))
    draw.ellipse((680, 640, 1320, 1280), fill=(224, 216, 255, 150))
    draw.ellipse((70, 95, 1030, 1055), outline=(220, 214, 208, 130), width=4)
    draw.ellipse((130, 155, 970, 995), outline=(255, 255, 255, 220), width=3)
    for offset in range(-500, 1500, 90):
        draw.line((offset, 0, offset + 720, 1100), fill=(204, 198, 194, 20), width=2)
    decorations = decorations.filter(ImageFilter.GaussianBlur(1.2))
    canvas.alpha_composite(decorations)

    x = (canvas_size - subject.width) // 2
    y = canvas_size - subject.height - 55
    soft_shadow = Image.new("RGBA", subject.size, (91, 77, 93, 0))
    soft_shadow.putalpha(glow.point(lambda value: int(value * 0.36)))
    pearl_outer = Image.new("RGBA", subject.size, (199, 188, 184, 0))
    pearl_outer.putalpha(outline_wide)
    white_inner = Image.new("RGBA", subject.size, (255, 255, 255, 0))
    white_inner.putalpha(outline_inner)

    canvas.alpha_composite(soft_shadow, (x, y + 9))
    canvas.alpha_composite(pearl_outer, (x, y))
    canvas.alpha_composite(white_inner, (x, y))
    canvas.alpha_composite(subject, (x, y))

    # The collectible-card renderer needs an independent transparent hero layer.
    # Keep the same refined double outline, but do not bake in the white-card surface.
    art_canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    art_canvas.alpha_composite(soft_shadow, (x, y + 9))
    art_canvas.alpha_composite(pearl_outer, (x, y))
    art_canvas.alpha_composite(white_inner, (x, y))
    art_canvas.alpha_composite(subject, (x, y))

    output = io.BytesIO()
    canvas.convert("RGB").save(output, format="WEBP", quality=90, method=6)
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    art_output = io.BytesIO()
    art_canvas.save(art_output, format="WEBP", quality=92, method=6, lossless=True)
    art_encoded = base64.b64encode(art_output.getvalue()).decode("ascii")
    return {
        "image": f"data:image/webp;base64,{encoded}",
        "cutout": f"data:image/webp;base64,{art_encoded}",
    }
