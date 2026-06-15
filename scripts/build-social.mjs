#!/usr/bin/env node
/**
 * Génère les visuels de profil pour les réseaux sociaux → assets/social/.
 *   - avatar.png       1024×1024  (photo de profil, sûr en cercle)
 *   - x-header.png     1500×500   (bannière X / Twitter)
 *   - fb-cover.png     1640×624   (couverture Page Facebook)
 *   - tiktok-ig.png    1080×1080  (carré d'annonce IG/TikTok)
 *
 * Texte mis en forme par resvg-js depuis les polices embarquées (svg-text.mjs).
 * Usage : node scripts/build-social.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { text, RESVG_FONT } from './svg-text.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'social');
mkdirSync(OUT, { recursive: true });

const COL = { bg: '#07070b', white: '#ffffff', yellow: '#ffd60a', pink: '#ff2e63', acid: '#c6f135', dim: '#a6a6c2', mute: '#6c6c86' };

const polar = (cx, cy, r, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
function arc(cx, cy, r, a0, a1, stroke, w) {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
}
const render = (inner, w, h, file) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
  const png = new Resvg(svg, { background: COL.bg, font: RESVG_FONT, fitTo: { mode: 'width', value: w } }).render().asPng();
  writeFileSync(join(OUT, file), png);
  console.log(`✓ assets/social/${file} (${(png.length / 1024).toFixed(0)} ko)`);
};

// --- AVATAR (centré, sûr quand rogné en cercle) -----------------------------
function avatar() {
  const S = 1024, c = S / 2, p = [];
  p.push(`<rect width="${S}" height="${S}" fill="${COL.bg}"/>`);
  const A0 = 150, A1 = 150 + 240, fill = A0 + 240 * 0.71, tick = A0 + 240 * 0.69;
  p.push(arc(c, c + 30, 360, A0, A1, '#1c1c28', 46));
  p.push(arc(c, c + 30, 360, A0, fill, COL.pink, 46));
  const [tx, ty] = polar(c, c + 30, 360, tick);
  p.push(`<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="14" fill="${COL.yellow}"/>`);
  p.push(text('THE', { x: c, y: c - 70, size: 70, fill: COL.dim, font: 'anton', anchor: 'middle', ls: 10 }));
  p.push(text('IDIOCRACY', { x: c, y: c + 30, size: 138, fill: COL.yellow, font: 'anton', anchor: 'middle', ls: 2 }));
  p.push(text('INDEX', { x: c, y: c + 150, size: 138, fill: COL.white, font: 'anton', anchor: 'middle', ls: 8 }));
  p.push(`<rect x="${c - 150}" y="${c + 178}" width="300" height="9" fill="${COL.pink}"/>`);
  render(p.join(''), S, S, 'avatar.png');
}

// --- BANNIÈRE générique (X header / FB cover) -------------------------------
function banner(W, H, file) {
  const p = [];
  p.push(`<rect width="${W}" height="${H}" fill="${COL.bg}"/>`);
  p.push(`<rect x="0" y="0" width="${W}" height="9" fill="${COL.yellow}"/>`);
  p.push(`<rect x="0" y="${H - 9}" width="${W}" height="9" fill="${COL.pink}"/>`);
  const lx = 70, cy = H / 2;
  p.push(text('THE IDIOCRACY INDEX', { x: lx, y: cy - 26, size: Math.min(96, W * 0.062), fill: COL.white, font: 'anton', ls: 4 }));
  p.push(text("THE WORLD'S STUPIDITY SCOREBOARD · UPDATED DAILY", { x: lx + 4, y: cy + 24, size: Math.min(30, W * 0.02), fill: COL.dim, ls: 3 }));
  p.push(text('IDIOCRACIES.COM', { x: lx + 4, y: cy + 96, size: Math.min(54, W * 0.036), fill: COL.yellow, font: 'anton', ls: 2 }));
  // gros "69" en filigrane à droite
  const rx = W - 250;
  p.push(text('69', { x: rx, y: cy + 60, size: 240, fill: COL.pink, font: 'anton', anchor: 'middle', opacity: 0.22 }));
  p.push(text('THE 69 LINE', { x: rx, y: cy + 110, size: 26, fill: COL.mute, anchor: 'middle', ls: 6 }));
  render(p.join(''), W, H, file);
}

// --- carré d'annonce IG / TikTok --------------------------------------------
function square() {
  const S = 1080, c = S / 2, p = [];
  p.push(`<rect width="${S}" height="${S}" fill="${COL.bg}"/>`);
  p.push(`<rect x="0" y="0" width="${S}" height="12" fill="${COL.yellow}"/>`);
  p.push(`<rect x="0" y="${S - 12}" width="${S}" height="12" fill="${COL.pink}"/>`);
  p.push(text('THE IDIOCRACY INDEX', { x: c, y: 150, size: 64, fill: COL.white, font: 'anton', anchor: 'middle', ls: 4 }));
  p.push(text('HOW DUMB IS THE PLANET TODAY?', { x: c, y: 215, size: 30, fill: COL.dim, anchor: 'middle', ls: 3 }));
  p.push(text('71', { x: c - 70, y: 600, size: 380, fill: COL.pink, font: 'anton', anchor: 'end' }));
  p.push(text('/100', { x: c - 40, y: 600, size: 130, fill: COL.white, font: 'anton' }));
  p.push(text('WE CROSSED THE 69 LINE. BRAWNDO WON.', { x: c, y: 720, size: 30, fill: COL.acid, anchor: 'middle', ls: 2 }));
  p.push(text('IDIOCRACIES.COM', { x: c, y: 940, size: 60, fill: COL.yellow, font: 'anton', anchor: 'middle', ls: 2 }));
  p.push(text('100% SATIRE', { x: c, y: 1000, size: 26, fill: COL.mute, anchor: 'middle', ls: 6 }));
  render(p.join(''), S, S, 'tiktok-ig.png');
}

avatar();
banner(1500, 500, 'x-header.png');
banner(1640, 624, 'fb-cover.png');
square();
console.log('\nDone. Visuels prêts à téléverser dans assets/social/.');
