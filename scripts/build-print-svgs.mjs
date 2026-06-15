// Convert the shop designs to TEXT-AS-PATHS SVGs (Printify-compatible).
// Outputs to shop-designs/print/.  Run: node scripts/build-print-svgs.mjs
import opentype from 'opentype.js';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const loadFont = (file) => {
  const buf = readFileSync(join(__dirname, 'fonts', file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const fonts = { anton: loadFont('Anton-Regular.ttf'), mono: loadFont('SpaceMono-Bold.ttf') };

function renderLine(line, cxDefault) {
  const { y, size, font = 'anton', ls = 0, anchor = 'middle', x, segments } = line;
  const f = fonts[font];
  const scale = size / f.unitsPerEm;
  const glyphsOf = (text) => [...text].map((ch) => f.charToGlyph(ch));
  const widthOf = (text) => glyphsOf(text).reduce((w, g) => w + g.advanceWidth * scale + ls, 0);
  let total = segments.reduce((w, s) => w + widthOf(s.text), 0) - ls;
  let px = anchor === 'start' ? x : cxDefault - total / 2;
  let out = '';
  for (const s of segments) {
    let d = '';
    for (const g of glyphsOf(s.text)) {
      const gp = g.getPath(px, y, size);
      d += gp.toPathData(2) + ' ';
      px += g.advanceWidth * scale + ls;
    }
    const stroke = s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.strokeWidth || 10}" stroke-linejoin="round"` : '';
    out += `  <path d="${d.trim()}" fill="${s.fill}"${stroke}/>\n`;
  }
  return out;
}

function build({ file, w, h, cx, shapes = [], lines }) {
  let body = shapes.map(s => '  ' + s).join('\n') + (shapes.length ? '\n' : '');
  body += lines.map(l => renderLine(l, cx)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">\n${body}</svg>\n`;
  const dir = join(root, 'shop-designs', 'print');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), svg, 'utf8');
  console.log('✓', 'shop-designs/print/' + file);
}

const W = '#ffffff', BLK = '#0a0a0f', YEL = '#ffd60a', PINK = '#ff2e63', ACID = '#c6f135', GREEN = '#7bb800', DIM = '#a6a6c2', MUTE = '#6c6c86';

// 1. 69 LINE — transparent, black shirt
build({ file: '69-line.svg', w: 3000, h: 3600, cx: 1500,
  shapes: ['<rect x="900" y="2330" width="1200" height="14" fill="#ffd60a"/>'],
  lines: [
    { y: 650,  size: 120, font: 'mono', ls: 30, segments: [{ text: 'THE IDIOCRACY INDEX', fill: W }] },
    { y: 1450, size: 640, ls: 10, segments: [{ text: 'SURVIVED', fill: W }] },
    { y: 2150, size: 640, ls: 10, segments: [{ text: 'THE ', fill: W }, { text: '69', fill: YEL }] },
    { y: 2820, size: 320, ls: 6, segments: [{ text: 'BRAWNDO WON.', fill: PINK }] },
  ] });

// 2. DOCUMENTARY — transparent, pink/white shirt
build({ file: 'documentary.svg', w: 3000, h: 3600, cx: 1500,
  shapes: ['<circle cx="1230" cy="582" r="55" fill="#ff2e63"/>', '<rect x="700" y="2860" width="1600" height="12" fill="#0a0a0f"/>'],
  lines: [
    { y: 645, size: 150, font: 'mono', ls: 18, anchor: 'start', x: 1340, segments: [{ text: 'REC', fill: BLK }] },
    { y: 1500, size: 560, ls: 6, segments: [{ text: 'IDIOCRACY', fill: BLK }] },
    { y: 2120, size: 560, ls: 6, segments: [{ text: 'WAS A', fill: BLK }] },
    { y: 2740, size: 430, ls: 4, segments: [{ text: 'DOCUMENTARY', fill: W, stroke: BLK, strokeWidth: 10 }] },
  ] });

// 3. VOTERS CRAVE — transparent, black shirt
build({ file: 'voters-crave.svg', w: 3000, h: 3600, cx: 1500, lines: [
  { y: 900,  size: 720, ls: 8, segments: [{ text: "IT'S GOT", fill: ACID }] },
  { y: 1620, size: 720, ls: 8, segments: [{ text: 'WHAT', fill: ACID }] },
  { y: 2280, size: 560, ls: 6, segments: [{ text: 'VOTERS', fill: W }] },
  { y: 2900, size: 560, ls: 6, segments: [{ text: 'CRAVE', fill: W }] },
  { y: 3180, size: 120, font: 'mono', ls: 24, segments: [{ text: '/ THE IDIOCRACY INDEX /', fill: DIM }] },
] });

// 4. ELECTROLYTES MUG — transparent, white mug
build({ file: 'electrolytes-mug.svg', w: 2700, h: 1155, cx: 1350, lines: [
  { y: 320, size: 230, segments: [{ text: "I'VE GOT", fill: BLK }] },
  { y: 680, size: 360, segments: [{ text: 'ELECTROLYTES', fill: GREEN }] },
  { y: 900, size: 130, font: 'mono', ls: 14, segments: [{ text: '( PROBABLY )', fill: BLK }] },
] });

// 5. CHAMPION STICKER — dark rounded bg
build({ file: 'champion-sticker.svg', w: 1500, h: 1500, cx: 750,
  shapes: ['<rect x="60" y="60" width="1380" height="1380" rx="90" fill="#0d0d15" stroke="#c6f135" stroke-width="14"/>'],
  lines: [
    { y: 520, size: 220, segments: [{ text: 'MY COUNTRY', fill: W }] },
    { y: 740, size: 220, segments: [{ text: 'BEAT YOURS', fill: ACID }] },
    { y: 930, size: 150, segments: [{ text: 'IN THE', fill: DIM }] },
    { y: 1140, size: 240, segments: [{ text: 'RANKINGS', fill: W }] },
    { y: 1300, size: 70, font: 'mono', ls: 12, segments: [{ text: 'THE IDIOCRACY INDEX', fill: MUTE }] },
  ] });

// 6. ANNUAL REPORT POSTER — dark full-bleed
build({ file: 'annual-report-poster.svg', w: 3000, h: 4000, cx: 1500,
  shapes: [
    '<rect x="0" y="0" width="3000" height="4000" fill="#07070b"/>',
    '<rect x="0" y="0" width="3000" height="40" fill="#ffd60a"/>',
    '<rect x="0" y="3960" width="3000" height="40" fill="#ff2e63"/>',
  ],
  lines: [
    { y: 560, size: 120, font: 'mono', ls: 36, segments: [{ text: 'THE IDIOCRACY INDEX', fill: DIM }] },
    { y: 1180, size: 300, ls: 6, segments: [{ text: 'ANNUAL REPORT', fill: W }] },
    { y: 2000, size: 720, ls: 8, segments: [{ text: 'GLOBAL', fill: YEL }] },
    { y: 2760, size: 720, ls: 8, segments: [{ text: 'STUPIDITY', fill: PINK }] },
    { y: 3360, size: 560, ls: 20, segments: [{ text: '2026', fill: W }] },
  ] });

console.log('\nDone. Upload the files in shop-designs/print/ to Printify.');
