// Fictional photos for the prototype: drawn SVG stand-ins (a patch of fur, a small lump, a ruler).
// They are pictures, not UI, so their colours are image content and not design tokens.
const PHOTO_LOOKS = {
  1: { r: 30, x: 196, y: 128, rot: -8, fur: ['#d9c3a5', '#c4a582'], light: 0.0 },
  2: { r: 31, x: 206, y: 122, rot: 5, fur: ['#dcc7aa', '#c7a986'], light: 0.06 },
  3: { r: 29, x: 200, y: 132, rot: -2, fur: ['#d6bf9f', '#c0a07c'], light: 0.03 },
  4: { r: 22, x: 210, y: 118, rot: 10, fur: ['#e0ccb0', '#c9ab88'], light: 0.08 },
};
function photoSrc(n) {
  const p = PHOTO_LOOKS[n] || PHOTO_LOOKS[1];
  let hairs = '';
  let seed = n * 97;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 400, y = rnd() * 300, l = 10 + rnd() * 16, a = -0.9 + rnd() * 0.5;
    hairs += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${(Math.cos(a) * l).toFixed(1)} ${(Math.sin(a) * l).toFixed(1)}" stroke="${rnd() > 0.5 ? '#a8865f' : '#efe2cf'}" stroke-opacity="${(0.25 + rnd() * 0.35).toFixed(2)}" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  let ticks = '';
  for (let i = 0; i <= 10; i++) ticks += `<path d="M${70 + i * 26} 242v${i % 5 ? 7 : 13}" stroke="#4a4a4a" stroke-width="1.5"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="800" height="600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.fur[0]}"/><stop offset="1" stop-color="${p.fur[1]}"/></linearGradient>
<radialGradient id="l" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ead8c0"/><stop offset="0.7" stop-color="#c9a37e"/><stop offset="1" stop-color="#a8825c"/></radialGradient></defs>
<rect width="400" height="300" fill="url(#g)"/>${hairs}
<ellipse cx="${p.x + 4}" cy="${p.y + 8}" rx="${p.r * 1.25}" ry="${p.r}" fill="#000" opacity="0.12" transform="rotate(${p.rot} ${p.x} ${p.y})"/>
<ellipse cx="${p.x}" cy="${p.y}" rx="${p.r * 1.25}" ry="${p.r}" fill="url(#l)" transform="rotate(${p.rot} ${p.x} ${p.y})"/>
<rect x="60" y="238" width="280" height="34" rx="4" fill="#f4f1e6" stroke="#9a9a8a"/>${ticks}
<text x="70" y="267" font-family="system-ui" font-size="11" fill="#4a4a4a">0</text><text x="194" y="267" font-family="system-ui" font-size="11" fill="#4a4a4a">5 cm</text>
<rect width="400" height="300" fill="#fff" opacity="${p.light}"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
