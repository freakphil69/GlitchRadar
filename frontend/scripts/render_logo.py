"""Derive all active brand images from the existing approved mascot assets."""
from pathlib import Path
import base64
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images"
BG = (13, 17, 23, 255)

def mascot(pose):
    image = Image.open(OUT / "mascot" / f"{pose}.webp").convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"Empty mascot: {pose}")
    return image.crop(bounds)

def mark(size, pose="neutral", background=False, fraction=0.9):
    canvas = Image.new("RGBA", (size, size), BG if background else (0, 0, 0, 0))
    source = mascot(pose)
    ratio = min(size * fraction / source.width, size * fraction / source.height)
    sprite = source.resize((max(1, round(source.width * ratio)), max(1, round(source.height * ratio))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(sprite, ((size - sprite.width) // 2, (size - sprite.height) // 2))
    return canvas

def main():
    outputs = {
        "icon.png": mark(1024, background=True),
        "adaptive-icon.png": mark(1024, fraction=0.60),
        "favicon.png": mark(512, background=True),
        "splash-image.png": mark(600, pose="crossed"),
        "logo-mark.png": mark(512, pose="crossed"),
        "app-image.png": mark(1024, background=True),
    }
    full = Image.new("RGBA", (1200, 440), (0, 0, 0, 0))
    full.alpha_composite(mark(420), (0, 10))
    draw = ImageDraw.Draw(full)
    font = ImageFont.truetype(str(ROOT / "assets/fonts/BarlowCondensed-Bold.ttf"), 120)
    draw.text((440, 150), "GlitchRadar", font=font, fill=(255, 107, 0, 255))
    outputs["logo-full.png"] = full
    for name, image in outputs.items():
        image.save(OUT / name, optimize=True)
        with Image.open(OUT / name) as check:
            check.verify()
    encoded = base64.b64encode((OUT / "icon.png").read_bytes()).decode("ascii")
    (OUT / "logo.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><image width="1024" height="1024" href="data:image/png;base64,{encoded}"/></svg>\n', encoding="utf-8")
    store = ROOT.parent / "store" / "playstore"
    if store.is_dir():
        mark(512, background=True).save(store / "icon_512.png", optimize=True)
    print("Generated mascot icons, splash, ticker mark and full brand image.")

if __name__ == "__main__":
    main()
