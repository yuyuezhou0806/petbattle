import base64
import io

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, ImageDraw, ImageFilter, ImageOps
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
        # Phone cameras often store orientation in EXIF instead of rotating pixels.
        # Normalize it before segmentation so the extracted pet stays upright.
        source = ImageOps.exif_transpose(Image.open(io.BytesIO(content))).convert("RGB")
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

    # A neutral "white card" starts every pet at the same visual rarity.
    # Equipment and progression are rendered separately by the client.
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

    output = io.BytesIO()
    canvas.convert("RGB").save(output, format="WEBP", quality=90, method=6)
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return {"image": f"data:image/webp;base64,{encoded}"}
