# App icon options (JCB-63)

Three home-screen icon options to replace the flat mint placeholders in `public/`. All use the paw glyph from the header brand mark (`src/components/Brand.tsx`), unchanged, and only colours from `docs/design-system/tokens.json`.

Open `index.html` in a browser at 100% zoom: each option sits on a 390 × 844 pt iPhone home screen (light and dark wallpaper) at real size, followed by every file and how it looks under the iOS mask and a circular maskable mask.

| Option | Background | Paw |
|---|---|---|
| A, `a-mint-gradient/` | `mint-top` → `mint` gradient (the primary-button gradient) | `surface` (white), soft `mint-deep` shadow |
| B, `b-mint-ink/` | same gradient | `on-mint`, as in the header mark |
| C, `c-white-mint-deep/` | `surface` → `mint-bg` gradient | `mint` → `mint-deep` gradient |

## Recommendation: A
It looks most at home on iOS (one bright colour, white glyph), stands out on both wallpapers and still says "PawLog mint". B matches the header mark 1:1 but the near-black paw feels heavy beside other icons. C fades into a light wallpaper and the tile edge almost vanishes.

## Files per option
- `icon.svg`: source (1024 grid, glyph at 58% width). `icon-maskable.svg`: glyph at 50% width, inside the 80% safe-zone circle.
- `icon-1024.png` master; `apple-touch-icon.png` 180, full bleed, no transparency, no own corners (iOS masks it); `icon-192.png`, `icon-512.png`; `icon-512-maskable.png`.
- `generate.py` rebuilds all options from tokens: `python3 design/proposals/app-icon/generate.py <repo root>` (needs Google Chrome and Pillow).

## Hand-off notes for the developer (after the CEO picks)
- Copy the chosen option's `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `icon.svg` into `public/`, and add `icon-512-maskable.png`.
- `vite.config.ts` currently lists `icon-512.png` as the maskable icon too; point the `purpose: 'maskable'` entry at `icon-512-maskable.png`.
- iOS caches home-screen icons: remove and re-add the PWA to see the new one.
