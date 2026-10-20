"""The app's icons from one generated image: the cream card cut out of its near-white ground (transparent around it),
then every size ことのあめ also has. Needs Pillow and numpy.
Usage: python design/make-icons.py design/icon-source-chatgpt.png .

The card is convex with sharp edges and the ground's noise stays under 7 (sum of channel differences), the card's cream
is 10 or more from it: each row's card runs from its first to its last pixel above 7.5 (after a median filter for the
noise), which also keeps the near-white glow inside the card. Downsampling smooths the edge."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

src, root = Path(sys.argv[1]), Path(sys.argv[2])
im = Image.open(src).convert("RGB")
a = np.asarray(im).astype(np.int32)
ground = np.median(np.concatenate([a[:40].reshape(-1, 3), a[-40:].reshape(-1, 3)]), axis=0)
dist = np.abs(a - ground).sum(axis=2)
smooth = np.asarray(Image.fromarray(np.clip(dist, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5)))
above = smooth > 7.5

h, w = above.shape
mask = np.zeros((h, w), bool)
for y in range(h):
    xs = np.flatnonzero(above[y])
    if len(xs) > 20:
        mask[y, xs[0] : xs[-1] + 1] = True
ys, xs = np.where(mask)
top, bottom, left, right = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
print("ground", ground, "card", (left, top, right, bottom), right - left, "x", bottom - top)

card_rgb = a[top:bottom, left:right].astype(np.uint8)
card_mask = mask[top:bottom, left:right]

# The card's own colour along each row, a little inside its edges, smoothed down the card: what fills the ground for
# the opaque icons, so the card's edge leaves no seam.
fill = np.zeros((bottom - top, 3))
for y in range(bottom - top):
    xs = np.flatnonzero(card_mask[y])
    band = np.concatenate([card_rgb[y, xs[0] + 6 : xs[0] + 30], card_rgb[y, max(xs[-1] - 29, 0) : xs[-1] - 5]])
    fill[y] = np.median(band, axis=0) if len(band) else np.nan
valid = ~np.isnan(fill[:, 0])
for c in range(3):
    fill[:, c] = np.interp(np.arange(len(fill)), np.flatnonzero(valid), fill[valid, c])
kernel = np.ones(41) / 41
fill = np.stack([np.convolve(np.pad(fill[:, c], 20, mode="edge"), kernel, mode="valid") for c in range(3)], axis=1)
print("fill top", fill[0].round(1), "middle", fill[len(fill) // 2].round(1), "bottom", fill[-1].round(1))

rgba = np.dstack([card_rgb, (card_mask * 255).astype(np.uint8)])
cut = Image.fromarray(rgba, "RGBA")
filled = card_rgb.copy()
filled[~card_mask] = np.broadcast_to(fill[:, None, :], filled.shape)[~card_mask].round().astype(np.uint8)
full = Image.fromarray(filled, "RGB")

# The card is a few pixels off square (generated): made square, too little to see.
side = max(cut.size)
cut = cut.resize((side, side), Image.LANCZOS)
full = full.resize((side, side), Image.LANCZOS)


def sized(n: int) -> Image.Image:
    return cut.resize((n, n), Image.LANCZOS)


def on_fill(n: int, scale: float) -> Image.Image:
    """The card filled out to a full square (no transparency), drawn at `scale` of the square on its own edge colour."""
    if scale >= 1:
        return full.resize((n, n), Image.LANCZOS)
    inner = full.resize((round(n * scale), round(n * scale)), Image.LANCZOS)
    margin = (n - inner.width) // 2
    base = np.asarray(full.resize((n, n), Image.LANCZOS)).copy()
    # Around the scaled card, the colour of the card's top and bottom rows carried outwards, so the edge disappears.
    small = np.asarray(inner)
    base[:] = small[:, :1].mean(axis=(0, 1))
    base[margin : margin + inner.height, :] = np.repeat(small[:, :1], n, axis=1)
    base[:margin, :] = small[0, 0]
    base[margin + inner.height :, :] = small[-1, 0]
    out = Image.fromarray(base.astype(np.uint8), "RGB")
    out.paste(inner, (margin, margin))
    return out


icons = root / "public" / "icons"
sized(512).save(icons / "icon-512.png", optimize=True)
sized(192).save(icons / "icon-192.png", optimize=True)
# Maskable: Android may cut it to a circle of 80%; the artwork reaches 0.44 of the side from the middle, so 86% keeps it
# inside.
on_fill(512, 0.86).save(icons / "maskable-512.png", optimize=True)
app = root / "src" / "app"
sized(512).save(app / "icon.png", optimize=True)
# iOS rounds the corners itself: the card full size, its corners filled with its own cream.
on_fill(180, 1.0).save(app / "apple-icon.png", optimize=True)
sized(256).save(app / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote icons")
