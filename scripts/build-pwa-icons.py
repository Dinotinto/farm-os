import os
from PIL import Image, ImageDraw, ImageFont

OUT = r"D:\Dinotinto-Farm-OS\public\icons"
os.makedirs(OUT, exist_ok=True)

GREEN = (25, 59, 40, 255)      # #193b28
GOLD = (217, 154, 40, 255)     # #d99a28
WHITE = (255, 255, 255, 255)

def font(size):
    for path in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\ariblk.ttf", r"C:\Windows\Fonts\segoeuib.ttf"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def draw_text_centered(d, cx, cy, text, fnt, fill):
    l, t, r, b = d.textbbox((0, 0), text, font=fnt)
    d.text((cx - (r - l) / 2 - l, cy - (b - t) / 2 - t), text, font=fnt, fill=fill)

def make(size, maskable=False, rounded=True):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        # full-bleed background (safe zone is the centre ~80%)
        d.rectangle([0, 0, size, size], fill=GREEN)
        badge = size * 0.62
    else:
        radius = int(size * 0.22)
        if rounded:
            d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=GREEN)
        else:
            d.rectangle([0, 0, size, size], fill=GREEN)
        badge = size * 0.78

    # gold rounded square holding the monogram
    bx = (size - badge) / 2
    d.rounded_rectangle([bx, bx, bx + badge, bx + badge], radius=int(badge * 0.22), fill=GOLD)
    draw_text_centered(d, size / 2, size / 2, "DF", font(int(badge * 0.5)), GREEN)
    return img

def make_feature_graphic():
    w, h = 1024, 500
    img = Image.new("RGB", (w, h), GREEN[:3])
    d = ImageDraw.Draw(img)
    # subtle accent bar
    d.rectangle([0, 0, 14, h], fill=GOLD[:3])
    # app badge on the left
    badge = 300
    bx, by = 90, (h - badge) / 2
    d.rounded_rectangle([bx, by, bx + badge, by + badge], radius=int(badge * 0.22), fill=GOLD[:3])
    draw_text_centered(d, bx + badge / 2, by + badge / 2, "DF", font(int(badge * 0.5)), GREEN)
    # title + tagline
    d.text((bx + badge + 70, 175), "Dinotinto Farm OS", font=font(64), fill=WHITE)
    d.text((bx + badge + 72, 260), "Land · Irrigation · Labour · Crops · AI", font=font(34), fill=(210, 225, 215))
    img.save(os.path.join(OUT, "playstore-feature-1024x500.png"))

make(192).save(os.path.join(OUT, "icon-192.png"))
make(512).save(os.path.join(OUT, "icon-512.png"))
make(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
make(180, rounded=True).save(os.path.join(OUT, "apple-touch-icon.png"))
make(512).save(os.path.join(OUT, "playstore-512.png"))
# Favicon
make(64).save(os.path.join(OUT, "favicon-64.png"))
make_feature_graphic()
print("icons written to", OUT)
