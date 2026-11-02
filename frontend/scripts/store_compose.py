"""Compose App Store / Play Store screenshots + Play feature graphic from raw captures.
Run: python scripts/store_compose.py  (reads /app/store/raw, writes /app/store/{playstore,appstore})"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAW = "/app/store/raw"
OUT = "/app/store"
FONTS = "/app/frontend/assets/fonts"
LOGO = "/app/frontend/assets/images/logo-full.png"

BG_TOP, BG_BOTTOM = (13, 17, 23), (0, 0, 0)
ORANGE, AMBER, WHITE, GREY = (255, 87, 34), (255, 179, 71), (240, 246, 252), (139, 148, 158)

SLIDES = [
    ("splash", "PREISFEHLER FINDEN,", "BEVOR SIE WEG SIND", "Dein Radar für echte Glitches im Netz"),
    ("radar", "ECHTE GLITCHES", "IN ECHTZEIT", "Preisfehler, Gutscheine & Cashback aus DE-Communities"),
    ("delivery", "LIEFERDIENST-CODES", "MIT EINEM TIPP", "Lieferando, Uber Eats, Wolt & mehr"),
    ("detail", "JEDER DEAL", "MIT QUELLE GEPRÜFT", "KI-Trefferquote + Original-Beitrag zum Nachprüfen"),
    ("search", "SUCH DIREKT,", "WAS DU WILLST", "PS5, AirPods, Lego – sofort alle aktiven Deals"),
    ("pro", "PRO: UNBEGRENZT", "SCANNEN & SPAREN", "Woche, Monat oder Jahr – jederzeit kündbar"),
]

SIZES = {"playstore": (1080, 1920), "appstore": (1290, 2796)}


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def gradient(w, h):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))
    # soft orange glow behind the phone
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((w * 0.1, h * 0.35, w * 0.9, h * 0.95), fill=(*ORANGE, 70))
    img.paste(glow.filter(ImageFilter.GaussianBlur(w // 6)), (0, 0), glow.filter(ImageFilter.GaussianBlur(w // 6)))
    return img


def centered(d, y, text, fnt, fill, w):
    tw = d.textlength(text, font=fnt)
    d.text(((w - tw) / 2, y), text, font=fnt, fill=fill)


def rounded(img, r):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), r, fill=255)
    out = Image.new("RGBA", img.size)
    out.paste(img, (0, 0), mask)
    return out


def slide(raw_name, l1, l2, sub, w, h):
    img = gradient(w, h)
    d = ImageDraw.Draw(img)
    s = w / 1080
    y = int(110 * s)
    f1 = font("BarlowCondensed-Bold.ttf", int(104 * s))
    centered(d, y, l1, f1, WHITE, w)
    centered(d, y + int(108 * s), l2, f1, ORANGE, w)
    centered(d, y + int(240 * s), sub, font("Satoshi-Medium.ttf", int(36 * s)), GREY, w)

    shot = Image.open(os.path.join(RAW, f"{raw_name}.png")).convert("RGB")
    top = y + int(340 * s)
    ph = h - top + int(60 * s)  # phone runs off the bottom edge
    pw = int(w * 0.78)
    shot = shot.resize((pw, int(pw * shot.height / shot.width)), Image.LANCZOS)
    bezel = int(18 * s)
    frame = Image.new("RGB", (pw + 2 * bezel, min(ph, shot.height + 2 * bezel)), (36, 41, 47))
    frame = rounded(frame, int(70 * s))
    screen = rounded(shot.crop((0, 0, pw, frame.height - 2 * bezel)), int(54 * s))
    frame.paste(screen, (bezel, bezel), screen)
    img.paste(frame, ((w - frame.width) // 2, top), frame)
    return img


def feature_graphic():
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(img)
    logo = Image.open(LOGO).convert("RGB")
    logo = logo.resize((int(380 * logo.width / logo.height), 380), Image.LANCZOS)
    img.paste(logo, (40, 60))
    x = 40 + logo.width + 30
    d.text((x, 140), "PREISFEHLER", font=font("BarlowCondensed-Bold.ttf", 76), fill=WHITE)
    d.text((x, 215), "IN ECHTZEIT", font=font("BarlowCondensed-Bold.ttf", 76), fill=ORANGE)
    d.text((x, 310), "Glitches, Codes & Cashback", font=font("Satoshi-Medium.ttf", 30), fill=GREY)
    return img


if __name__ == "__main__":
    for store, (w, h) in SIZES.items():
        os.makedirs(os.path.join(OUT, store), exist_ok=True)
        for i, (raw, l1, l2, sub) in enumerate(SLIDES, 1):
            slide(raw, l1, l2, sub, w, h).save(os.path.join(OUT, store, f"{i:02d}_{raw}.png"))
    feature_graphic().save(os.path.join(OUT, "playstore", "feature_graphic_1024x500.png"))
    Image.open("/app/frontend/assets/images/icon.png").resize((512, 512), Image.LANCZOS).save(
        os.path.join(OUT, "playstore", "icon_512.png"))
    print("done")
