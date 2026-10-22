"""Renders the GlitchRadar logo (radar + glitch blip) into all Expo icon assets."""
from PIL import Image, ImageDraw

S = 4  # supersampling factor
BG = (13, 17, 23, 255)
RING = (48, 54, 61, 255)
CROSS = (33, 38, 45, 255)
ORANGE = (255, 87, 34)
RED = (248, 81, 73)
PEACH = (255, 171, 145)
OUT = "/app/frontend/assets/images/"


def draw_mark(size: int, with_bg: bool, scale: float = 1.0) -> Image.Image:
    n = size * S
    img = Image.new("RGBA", (n, n), BG if with_bg else (0, 0, 0, 0))
    k = n / 1024 * scale
    off = n / 2 - 512 * k  # keep the mark centered when scaled down

    def p(v):
        return off + v * k

    # sweep wedge on its own layer: pies overwrite (no stacking), outer edge strong, center faint
    wedge = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wedge)
    steps = 40
    for i in range(steps):
        r = 340 * (1 - i / steps)
        alpha = int(150 - 135 * (i / steps))
        wd.pieslice([p(512 - r), p(512 - r), p(512 + r), p(512 + r)], -90, -30, fill=ORANGE + (alpha,))
    img = Image.alpha_composite(img, wedge)
    d = ImageDraw.Draw(img, "RGBA")
    for r, w in ((340, 14), (232, 12), (124, 10)):
        d.ellipse([p(512 - r), p(512 - r), p(512 + r), p(512 + r)], outline=RING, width=int(w * k))
    d.line([p(172), p(512), p(852), p(512)], fill=CROSS, width=int(8 * k))
    d.line([p(512), p(172), p(512), p(852)], fill=CROSS, width=int(8 * k))
    # beam (angle -30deg) + round cap
    d.line([p(512), p(512), p(806), p(342)], fill=ORANGE + (255,), width=int(18 * k))
    d.ellipse([p(806 - 9), p(342 - 9), p(806 + 9), p(342 + 9)], fill=ORANGE + (255,))
    # glitch blip: RGB-split offset blocks
    d.rectangle([p(628), p(270), p(706), p(300)], fill=RED + (220,))
    d.rectangle([p(648), p(306), p(706), p(328)], fill=PEACH + (230,))
    d.rectangle([p(612), p(334), p(708), p(360)], fill=ORANGE + (255,))
    d.ellipse([p(482), p(482), p(542), p(542)], fill=ORANGE + (255,))
    return img.resize((size, size), Image.LANCZOS)


draw_mark(1024, True).save(OUT + "icon.png")
draw_mark(1024, False, scale=0.72).save(OUT + "adaptive-icon.png")  # Android safe zone
draw_mark(512, True).save(OUT + "favicon.png")
draw_mark(600, False, scale=0.9).save(OUT + "splash-image.png")
print("ok")
