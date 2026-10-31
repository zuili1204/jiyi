import os
from PIL import Image

SRC = r"f:/Cursor Files/APK/JiYi/icon.png"
RES = r"f:/Cursor Files/APK/JiYi/android/app/src/main/res"

densities = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0}
legacy_size = lambda f: round(48 * f)
fg_canvas = lambda f: round(108 * f)
SAFE = 66 / 108  # 自适应图标安全区

im = Image.open(SRC).convert('RGB')
W, H = im.size
s = min(W, H)
left, top = (W - s) // 2, (H - s) // 2
sq = im.crop((left, top, left + s, top + s))


def sample(px, py, r=20):
    cols = list(im.crop((px - r, py - r, px + r, py + r)).getdata())
    return tuple(sum(c[i] for c in cols) // len(cols) for i in range(3))


pts = [(30, 30), (W - 30, 30), (30, H - 30), (W - 30, H - 30)]
samples = [sample(x, y) for x, y in pts]
bg = tuple(sum(sv[i] for sv in samples) // len(samples) for i in range(3))
print("corners:", samples)
print("sampled bg:", bg, "-> #%02X%02X%02X" % bg)

TOL = 40  # 米纸底有轻微纹理；圭体(灰绿)距底色远，安全


def to_foreground(img):
    img = img.convert('RGB')
    px = img.load()
    w, h = img.size
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - bg[0]) <= TOL and abs(g - bg[1]) <= TOL and abs(b - bg[2]) <= TOL:
                continue  # 透明
            op[x, y] = (r, g, b, 255)
    return out


fg_full = to_foreground(sq)
bbox = fg_full.getbbox()
fg_crop = fg_full.crop(bbox)
print("fg bbox:", bbox, "crop:", fg_crop.size)

for name, f in densities.items():
    d = os.path.join(RES, f"mipmap-{name}")
    # legacy：整图平铺（米底 + 玉圭）
    leg = sq.resize((legacy_size(f), legacy_size(f)), Image.LANCZOS)
    leg.save(os.path.join(d, "ic_launcher.png"))
    leg.save(os.path.join(d, "ic_launcher_round.png"))
    # adaptive 前景：圭体裁出后按安全区缩放居中
    C = fg_canvas(f)
    fit = round(C * SAFE)
    scale = fit / max(fg_crop.size)
    tw, th = round(fg_crop.size[0] * scale), round(fg_crop.size[1] * scale)
    t = fg_crop.resize((tw, th), Image.LANCZOS)
    canvas = Image.new('RGBA', (C, C), (0, 0, 0, 0))
    canvas.paste(t, ((C - tw) // 2, (C - th) // 2), t)
    canvas.save(os.path.join(d, "ic_launcher_foreground.png"))
    print("wrote", name, "legacy", legacy_size(f), "fg", C, "tablet", tw, th)

print("done")
