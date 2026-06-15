// Petit utilitaire de texte SVG pour les images générées (og.png, réseaux sociaux).
//
// IMPORTANT : on NE convertit PAS le texte en tracés via opentype.js getPath().
// Cette API produit des coordonnées NaN sur certaines séquences de glyphes
// (apostrophes, lignes longues) avec nos polices → texte tronqué.
// À la place, on émet des <text> et on laisse resvg-js faire la mise en forme à
// partir des fichiers de police embarqués (RESVG_FONT). Robuste et plus simple.
// opentype.js ne sert plus QU'À mesurer (advanceWidth, qui lui est fiable) pour
// décider des retours à la ligne et des décalages.

import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fonts');
export const FONT_FILES = {
  anton: join(FONT_DIR, 'Anton-Regular.ttf'),
  mono: join(FONT_DIR, 'SpaceMono-Bold.ttf'),
};
// Option `font` à passer à `new Resvg(svg, { font: RESVG_FONT, ... })`.
export const RESVG_FONT = {
  fontFiles: [FONT_FILES.anton, FONT_FILES.mono],
  loadSystemFonts: false,
  defaultFontFamily: 'Space Mono',
};

const FAMILY = { anton: { family: 'Anton', weight: 400 }, mono: { family: 'Space Mono', weight: 700 } };

// Polices opentype mises en cache, UNIQUEMENT pour mesurer.
const _ot = {};
function otFont(key) {
  if (!_ot[key]) {
    const b = readFileSync(FONT_FILES[key]);
    _ot[key] = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
  return _ot[key];
}

// Largeur d'encrage approx. d'une chaîne (px) — fiable car n'utilise que advanceWidth.
export function measure(fontKey, str, size, ls = 0) {
  const f = otFont(fontKey);
  const sc = size / f.unitsPerEm;
  let w = 0;
  for (const ch of [...String(str)]) w += f.charToGlyph(ch).advanceWidth * sc + ls;
  return Math.max(0, w - ls);
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Un <text>. anchor: 'start' | 'middle' | 'end'. font: 'anton' | 'mono'.
export function text(str, { x, y, size, fill, font = 'mono', anchor = 'start', ls = 0, opacity = 1 }) {
  const fam = FAMILY[font];
  const a = anchor === 'start' ? '' : ` text-anchor="${anchor}"`;
  const l = ls ? ` letter-spacing="${ls}"` : '';
  const o = opacity < 1 ? ` opacity="${opacity}"` : '';
  return `<text x="${x}" y="${y}" font-family="${fam.family}" font-weight="${fam.weight}" ` +
         `font-size="${size}" fill="${fill}"${a}${l}${o}>${esc(str)}</text>`;
}

// Découpe une chaîne en lignes qui tiennent dans maxW (px).
export function wrap(fontKey, str, size, maxW, ls = 0) {
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(fontKey, t, size, ls) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
