"""Generate the PawLog app-icon options (JCB-63) from tokens.json; render PNGs with headless Chrome + Pillow.

Usage (macOS, Google Chrome installed): python3 design/proposals/app-icon/generate.py <repo root>
"""
import json, os, subprocess, sys, tempfile
from PIL import Image

ROOT = sys.argv[1]
OUT = os.path.join(ROOT, "design/proposals/app-icon")
tok = {t["name"]: t["value"] for t in json.load(open(os.path.join(ROOT, "docs/design-system/tokens.json")))["color"]["tokens"]}

def rgba(hex_, a):
    h = hex_.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return f"rgba({r},{g},{b},{a})"

# Paw glyph from src/components/Brand.tsx (24px grid). Bounding box x 4.2..20.6, y 4.0..19.3.
PAW = """<ellipse cx="6.2" cy="11" rx="2" ry="2.6"/>
<ellipse cx="10.2" cy="6.6" rx="2" ry="2.6"/>
<ellipse cx="15" cy="6.6" rx="2" ry="2.6"/>
<ellipse cx="18.6" cy="11" rx="2" ry="2.6"/>
<path d="M12.4 11.4c2.6 0 5.2 2.9 5.2 5.4 0 1.8-1.5 2.7-3 2.4-.8-.2-1.4-.5-2.2-.5s-1.4.3-2.2.5c-1.5.3-3-.6-3-2.4 0-2.5 2.6-5.4 5.2-5.4z"/>"""
CX, CY, GW = 12.4, 11.65, 16.4
S = 1024

def glyph_transform(width_frac):
    s = S * width_frac / GW
    return f"translate({S/2} {S/2}) scale({s:.3f}) translate({-CX} {-CY})"

OPTIONS = {
    "a-mint-gradient": dict(
        title="A · Mint gradient, white paw",
        defs=f"""<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="{tok['mint-top']}"/><stop offset="1" stop-color="{tok['mint']}"/></linearGradient>
<filter id="sh" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
  <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="{tok['mint-deep']}" flood-opacity="0.30"/></filter>""",
        bg='<rect width="1024" height="1024" fill="url(#bg)"/>',
        glyph_fill=tok["surface"], glyph_attrs='filter="url(#sh)"'),
    "b-mint-ink": dict(
        title="B · Mint, on-mint paw (matches header)",
        defs=f"""<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="{tok['mint-top']}"/><stop offset="1" stop-color="{tok['mint']}"/></linearGradient>""",
        bg='<rect width="1024" height="1024" fill="url(#bg)"/>',
        glyph_fill=tok["on-mint"], glyph_attrs=""),
    "c-white-mint-deep": dict(
        title="C · White, mint-deep paw",
        defs=f"""<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="{tok['surface']}"/><stop offset="1" stop-color="{tok['mint-bg']}"/></linearGradient>
<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="{tok['mint']}"/><stop offset="1" stop-color="{tok['mint-deep']}"/></linearGradient>""",
        bg='<rect width="1024" height="1024" fill="url(#bg)"/>',
        glyph_fill="url(#gl)", glyph_attrs=""),
}

def svg(opt, width_frac):
    o = OPTIONS[opt]
    # Option C's glyph gradient spans the whole paw (24px grid, y 4..19.3), not each toe separately.
    defs = o["defs"].replace('<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">',
                             '<linearGradient id="gl" gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="19.3">')
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<title>PawLog app icon, option {o['title']}</title>
<defs>{defs}</defs>
{o['bg']}
<g {o['glyph_attrs']}><g fill="{o['glyph_fill']}" transform="{glyph_transform(width_frac)}">
{PAW}
</g></g>
</svg>
"""

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

def render(svg_path, png_path):
    tmp = tempfile.mkdtemp()
    html = os.path.join(tmp, "r.html")
    open(html, "w").write(f'<html><body style="margin:0"><img src="file://{svg_path}" width="1024" height="1024" style="display:block"></body></html>')
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--user-data-dir={tmp}/prof", "--window-size=1024,1024", "--default-background-color=00000000",
                    f"--screenshot={png_path}", f"file://{html}"], check=True, capture_output=True)
    im = Image.open(png_path).convert("RGB").crop((0, 0, 1024, 1024))
    im.save(png_path, optimize=True)
    return im

for opt in OPTIONS:
    d = os.path.join(OUT, opt)
    os.makedirs(d, exist_ok=True)
    regular = os.path.join(d, "icon.svg")
    maskable = os.path.join(d, "icon-maskable.svg")
    open(regular, "w").write(svg(opt, 0.58))
    # Maskable safe zone: circle of radius 40% of the icon; glyph at 50% width -> half-diagonal ~ 0.34 * size.
    open(maskable, "w").write(svg(opt, 0.50))
    master = render(regular, os.path.join(d, "icon-1024.png"))
    for size, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        master.resize((size, size), Image.LANCZOS).save(os.path.join(d, name), optimize=True)
    m = render(maskable, os.path.join(d, "_mask-1024.png"))
    m.resize((512, 512), Image.LANCZOS).save(os.path.join(d, "icon-512-maskable.png"), optimize=True)
    os.remove(os.path.join(d, "_mask-1024.png"))
    print(opt, "ok")
