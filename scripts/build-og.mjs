#!/usr/bin/env node
/**
 * Génère l'image de partage social (Open Graph) — assets/og.png, 1200×630.
 *
 * C'est l'image qui s'affiche quand quelqu'un colle idiocracies.com sur
 * Facebook, X/Twitter, WhatsApp, LinkedIn, iMessage, Discord, Slack…
 * On la régénère CHAQUE JOUR à partir de data/scores.json pour qu'elle montre
 * le score mondial et la « connerie du jour » à jour (un partage frais = plus
 * de clics).
 *
 * Reuse: opentype.js (déjà une dépendance) transforme le texte en tracés, donc
 * le rendu est pixel-parfait sans dépendre des polices du système. @resvg/resvg-js
 * rastérise le SVG en PNG.
 *
 * Usage : node scripts/build-og.mjs
 */
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const W = 1200, H = 630;
const COL = {
  bg: '#07070b', white: '#ffffff', yellow: '#ffd60a', pink: '#ff2e63',
  acid: '#c6f135', green: '#7bb800', dim: '#a6a6c2', mute: '#6c6c86',
};

// --- polices ---------------------------------------------------------------
function loadFont(file) {
  const buf = readFileSync(join(__dirname, 'fonts', file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
const FONTS = { anton: loadFont('Anton-Regular.ttf'), mono: loadFont('SpaceMono-Bold.ttf') };

// largeur d'encrage d'une chaîne (en px) pour une taille donnée
function measure(font, text, size, ls = 0) {
  const scale = size / font.unitsPerEm;
  let w = 0;
  for (const ch of [...text]) w += font.charToGlyph(ch).advanceWidth * scale + ls;
  return w - ls;
}

// transforme une chaîne en <path> SVG, ancre gauche, baseline à y
function textPath(font, text, x, y, size, fill, ls = 0, extra = '') {
  const scale = size / font.unitsPerEm;
  const all = new opentype.Path();
  let px = x;
  for (const ch of [...text]) {
    const g = font.charToGlyph(ch);
    all.commands.push(...g.getPath(px, y, size).commands);
    px += g.advanceWidth * scale + ls;
  }
  return `<path d="${all.toPathData(2)}" fill="${fill}"${extra}/>`;
}

// découpe une chaîne en lignes qui tiennent dans maxW
function wrap(font, text, size, maxW, ls = 0) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (measure(font, test, size, ls) > maxW && cur) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

const pickEn = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v.en || Object.values(v)[0] || '') : (v || '');

// --- carte -----------------------------------------------------------------
function buildSvg(data) {
  const score = data.world?.score ?? 0;
  const over69 = score >= 69;
  const scoreColor = over69 ? COL.pink : COL.acid;
  const spot = data.spotlight || {};
  const country = (spot.country || '').toUpperCase();
  const headline = pickEn(spot.headline);
  const label = over69 ? 'WE CROSSED THE 69 LINE. BRAWNDO WON.'
                       : 'STILL UNDER THE 69 LINE. ENJOY IT.';

  const p = [];
  // fond + barres d'accent
  p.push(`<rect width="${W}" height="${H}" fill="${COL.bg}"/>`);
  p.push(`<rect x="0" y="0" width="${W}" height="10" fill="${COL.yellow}"/>`);
  p.push(`<rect x="0" y="${H - 10}" width="${W}" height="10" fill="${COL.pink}"/>`);

  // en-tête
  p.push(textPath(FONTS.anton, 'THE IDIOCRACY INDEX', 70, 108, 50, COL.white, 6));
  p.push(textPath(FONTS.mono, "THE WORLD'S STUPIDITY SCOREBOARD", 72, 150, 22, COL.mute, 5));

  // gros score (à gauche)
  const numY = 410, numSize = 290;
  const numStr = String(score);
  p.push(textPath(FONTS.anton, numStr, 64, numY, numSize, scoreColor, 4));
  const numW = measure(FONTS.anton, numStr, numSize, 4);
  p.push(textPath(FONTS.anton, '/100', 64 + numW + 24, numY, 92, COL.white, 2));
  p.push(textPath(FONTS.mono, 'GLOBAL STUPIDITY · TODAY', 70, numY + 56, 22, COL.dim, 4));

  // colonne droite : connerie du jour
  const rx = 660;
  p.push(textPath(FONTS.mono, "TODAY'S DUMBEST MOVE", rx, 250, 24, COL.pink, 3));
  const cLines = wrap(FONTS.anton, country, 56, W - rx - 60);
  let cy = 312;
  for (const ln of cLines.slice(0, 2)) { p.push(textPath(FONTS.anton, ln, rx, cy, 56, COL.yellow, 2)); cy += 60; }
  const hLines = wrap(FONTS.mono, headline, 27, W - rx - 60);
  cy += 6;
  for (const ln of hLines.slice(0, 4)) { p.push(textPath(FONTS.mono, ln, rx, cy, 27, COL.white, 0)); cy += 38; }

  // bas
  p.push(textPath(FONTS.anton, 'IDIOCRACIES.COM', 70, H - 42, 40, COL.yellow, 2));
  const tag = '100% SATIRE · UPDATED DAILY';
  const tagW = measure(FONTS.mono, tag, 22, 3);
  p.push(textPath(FONTS.mono, tag, W - 70 - tagW, H - 46, 22, COL.mute, 3));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p.join('')}</svg>`;
}

function main() {
  const data = JSON.parse(readFileSync(join(root, 'data', 'scores.json'), 'utf8'));
  const svg = buildSvg(data);
  const resvg = new Resvg(svg, { background: COL.bg, fitTo: { mode: 'width', value: W } });
  const png = resvg.render().asPng();
  writeFileSync(join(root, 'assets', 'og.png'), png);
  console.log(`✓ assets/og.png (${(png.length / 1024).toFixed(0)} ko) — score mondial ${data.world?.score}, connerie du jour ${data.spotlight?.country}`);
}

main();
