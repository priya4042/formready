# App icons and the share card, drawn with Pillow (no text in icons).
import os
from PIL import Image, ImageDraw, ImageFont
R = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(R, "assets")
INK, HL, PASS, PAGE = (22, 36, 92), (255, 228, 92), (11, 122, 62), (243, 246, 252)
def mark(size, pad=0.0, bg=None):
    S = size * 4; im = Image.new("RGBA", (S, S), bg or (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    k = S * (1 - 2 * pad) / 34; o = S * pad
    P = lambda x, y: (o + x * k, o + y * k)
    d.rounded_rectangle((*P(3, 3), *P(25, 31)), radius=3 * k, fill=INK)
    d.rounded_rectangle((*P(7, 8), *P(17, 19)), radius=1.5 * k, fill=HL)
    d.rounded_rectangle((*P(7, 22), *P(21, 24)), radius=k, fill=(185, 192, 214))
    d.rounded_rectangle((*P(7, 26), *P(17, 28)), radius=k, fill=(185, 192, 214))
    d.ellipse((*P(17.5, 16.5), *P(32.5, 31.5)), fill=PASS, outline=(255, 255, 255), width=int(2 * k))
    d.line([P(21.6, 24.2), P(23.9, 26.4), P(27.9, 22)], fill=(255, 255, 255), width=int(2.2 * k), joint="curve")
    return im.resize((size, size), Image.LANCZOS)
mark(192, .04, (*PAGE, 255)).save(os.path.join(A, "icon-192.png"))
mark(512, .04, (*PAGE, 255)).save(os.path.join(A, "icon-512.png"))
mark(512, .16, (*PAGE, 255)).save(os.path.join(A, "icon-maskable.png"))
# share card 1200x630
W, H = 1200, 630; im = Image.new("RGB", (W, H), PAGE); d = ImageDraw.Draw(im)
for y in range(0, H, 32): d.line([(0, y), (W, y)], fill=(220, 227, 242))
F = lambda n, s: ImageFont.truetype(os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", n), s)
im.paste(mark(140), (80, 80), mark(140))
d.text((240, 108), "FormReady", font=F("bahnschrift.ttf", 76), fill=INK)
d.text((80, 270), "Exam photo and signature", font=F("segoeuib.ttf", 64), fill=INK)
d.text((80, 350), "in the exact KB and pixel size", font=F("segoeuib.ttf", 64), fill=INK)
d.text((80, 460), "SSC  IBPS  UPSC  NEET  JEE  CUET  RRB", font=F("segoeui.ttf", 36), fill=(86, 96, 126))
d.rounded_rectangle((80, 530, 720, 580), radius=10, fill=HL)
d.text((100, 538), "Free. Files never leave your phone.", font=F("segoeuib.ttf", 30), fill=INK)
im.save(os.path.join(A, "og.png"), optimize=True)
print("ok")
