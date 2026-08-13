import base64
import io
import math

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

app = FastAPI(title="Pet Battle Outline API")
session = new_session("u2netp")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/outline")
async def outline(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(413, "图片不能超过 12 MB")

    try:
        source = Image.open(io.BytesIO(content)).convert("RGB")
        source.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
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

    # Original football-player-card-inspired arena: metallic gradients,
    # radial beams, geometric texture, and a shield silhouette. No brand assets.
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (11, 18, 38, 255))
    pixels = canvas.load()
    for py in range(canvas_size):
        for px in range(canvas_size):
            distance = math.hypot(px - canvas_size / 2, py - canvas_size * 0.42) / 760
            beam = max(0.0, math.cos(math.atan2(py - 470, px - 550) * 10)) * 0.10
            gold = max(0.0, 1.0 - distance) + beam
            pixels[px, py] = (
                int(10 + 65 * gold),
                int(18 + 46 * gold),
                int(39 + 22 * gold),
                255,
            )

    decorations = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(decorations)
    center = (550, 475)
    for index in range(32):
        angle = index * math.pi * 2 / 32
        inner = 150
        outer = 780
        width = 0.018 if index % 2 else 0.03
        points = [
            center,
            (center[0] + math.cos(angle - width) * outer, center[1] + math.sin(angle - width) * outer),
            (center[0] + math.cos(angle + width) * outer, center[1] + math.sin(angle + width) * outer),
        ]
        draw.polygon(points, fill=(255, 205, 91, 12 if index % 2 else 20))

    for row in range(10):
        for col in range(11):
            cx = 55 + col * 105 + (52 if row % 2 else 0)
            cy = 60 + row * 98
            radius = 31
            hexagon = [
                (cx + math.cos(math.pi / 3 * step) * radius, cy + math.sin(math.pi / 3 * step) * radius)
                for step in range(6)
            ]
            draw.line(hexagon + [hexagon[0]], fill=(255, 220, 128, 20), width=2)

    shield = [(90, 75), (1010, 75), (1065, 170), (1015, 850), (550, 1060), (85, 850), (35, 170)]
    draw.line(shield + [shield[0]], fill=(255, 215, 112, 160), width=9, joint="curve")
    inner_shield = [(120, 105), (980, 105), (1025, 185), (980, 825), (550, 1025), (120, 825), (75, 185)]
    draw.line(inner_shield + [inner_shield[0]], fill=(255, 244, 202, 75), width=3, joint="curve")
    decorations = decorations.filter(ImageFilter.GaussianBlur(0.4))
    canvas.alpha_composite(decorations)

    x = (canvas_size - subject.width) // 2
    y = canvas_size - subject.height - 55

    gold_glow = Image.new("RGBA", subject.size, (255, 191, 56, 0))
    gold_glow.putalpha(glow.point(lambda value: int(value * 0.55)))
    gold_outer = Image.new("RGBA", subject.size, (255, 171, 34, 0))
    gold_outer.putalpha(outline_wide)
    cream_inner = Image.new("RGBA", subject.size, (255, 244, 196, 0))
    cream_inner.putalpha(outline_inner)

    canvas.alpha_composite(gold_glow, (x, y))
    canvas.alpha_composite(gold_outer, (x, y))
    canvas.alpha_composite(cream_inner, (x, y))
    canvas.alpha_composite(subject, (x, y))

    output = io.BytesIO()
    canvas.convert("RGB").save(output, format="WEBP", quality=90, method=6)
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return {"image": f"data:image/webp;base64,{encoded}"}
