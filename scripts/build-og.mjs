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
 * Le texte est mis en forme par resvg-js à partir des polices embarquées
 * (voir scripts/svg-text.mjs).  Usage : node scripts/build-og.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { text, measure, wrap, wrapClamp, RESVG_FONT } from './svg-text.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const W = 1200, H = 630;
const COL = {
  bg: '#07070b', white: '#ffffff', yellow: '#ffd60a', pink: '#ff2e63',
  acid: '#c6f135', dim: '#a6a6c2', mute: '#6c6c86',
};

const pickEn = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v.en || Object.values(v)[0] || '') : (v || '');

function buildSvg(data) {
  const score = data.world?.score ?? 0;
  const over69 = score >= 69;
  const scoreColor = over69 ? COL.pink : COL.acid;
  const country = (data.spotlight?.country || '').toUpperCase();
  const headline = pickEn(data.spotlight?.headline);

  const p = [];
  p.push(`<rect width="${W}" height="${H}" fill="${COL.bg}"/>`);
  p.push(`<rect x="0" y="0" width="${W}" height="10" fill="${COL.yellow}"/>`);
  p.push(`<rect x="0" y="${H - 10}" width="${W}" height="10" fill="${COL.pink}"/>`);

  // en-tête
  p.push(text('THE IDIOCRACY INDEX', { x: 70, y: 108, size: 50, fill: COL.white, font: 'anton', ls: 6 }));
  p.push(text("THE WORLD'S STUPIDITY SCOREBOARD", { x: 72, y: 150, size: 22, fill: COL.mute, ls: 5 }));

  // gros score à gauche
  const numY = 410, numSize = 290, numX = 64;
  p.push(text(String(score), { x: numX, y: numY, size: numSize, fill: scoreColor, font: 'anton', ls: 4 }));
  const numW = measure('anton', String(score), numSize, 4);
  p.push(text('/100', { x: numX + numW + 24, y: numY, size: 92, fill: COL.white, font: 'anton', ls: 2 }));
  p.push(text('GLOBAL STUPIDITY · TODAY', { x: 70, y: numY + 56, size: 22, fill: COL.dim, ls: 4 }));

  // colonne droite : connerie du jour
  const rx = 660;
  p.push(text("TODAY'S DUMBEST MOVE", { x: rx, y: 250, size: 24, fill: COL.pink, ls: 3 }));
  let cy = 312;
  for (const ln of wrap('anton', country, 56, W - rx - 60).slice(0, 2)) {
    p.push(text(ln, { x: rx, y: cy, size: 56, fill: COL.yellow, font: 'anton', ls: 2 }));
    cy += 60;
  }
  cy += 6;
  for (const ln of wrapClamp('mono', headline, 27, W - rx - 60, 4)) {
    p.push(text(ln, { x: rx, y: cy, size: 27, fill: COL.white }));
    cy += 38;
  }

  // bas
  p.push(text('IDIOCRACIES.COM', { x: 70, y: H - 42, size: 40, fill: COL.yellow, font: 'anton', ls: 2 }));
  p.push(text('100% SATIRE · UPDATED DAILY', { x: W - 70, y: H - 46, size: 22, fill: COL.mute, anchor: 'end', ls: 3 }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p.join('')}</svg>`;
}

// ---------------------------------------------------------------------------
// Image carrée 1080×1080 pour Instagram — centrée, lisible dans la grille
// ---------------------------------------------------------------------------
function buildSquareSvg(data) {
  const S = 1080, c = S / 2;
  const score = data.world?.score ?? 0;
  const over69 = score >= 69;
  const scoreColor = over69 ? COL.pink : COL.acid;
  const country = (data.spotlight?.country || '').toUpperCase();
  const headline = pickEn(data.spotlight?.headline) || '';

  const p = [];
  p.push(`<rect width="${S}" height="${S}" fill="${COL.bg}"/>`);
  // barres de couleur
  p.push(`<rect x="0" y="0" width="${S}" height="12" fill="${COL.yellow}"/>`);
  p.push(`<rect x="0" y="${S - 12}" width="${S}" height="12" fill="${COL.pink}"/>`);

  // en-tête
  p.push(text('THE IDIOCRACY INDEX', { x: c, y: 108, size: 58, fill: COL.white, font: 'anton', anchor: 'middle', ls: 4 }));
  p.push(text("TODAY'S STUPIDITY SCORE", { x: c, y: 158, size: 26, fill: COL.mute, anchor: 'middle', ls: 4 }));

  // ligne de séparation
  p.push(`<rect x="80" y="180" width="${S - 160}" height="2" fill="${COL.mute}" opacity="0.3"/>`);

  // pays (sans emoji — resvg ne supporte pas les emoji drapeaux)
  const countryLines = wrap('anton', country, 72, S - 100).slice(0, 2);
  let cy = 310;
  for (const ln of countryLines) {
    p.push(text(ln, { x: c, y: cy, size: 72, fill: COL.yellow, font: 'anton', anchor: 'middle', ls: 2 }));
    cy += 82;
  }

  // score — gros chiffre centré
  const scoreStr = String(score);
  const scoreSize = 240;
  const scoreW = measure('anton', scoreStr, scoreSize, 4);
  const slashW = measure('anton', '/100', 80, 2);
  const totalW = scoreW + 16 + slashW;
  const sx = c - totalW / 2;
  p.push(text(scoreStr, { x: sx, y: 580, size: scoreSize, fill: scoreColor, font: 'anton', ls: 4 }));
  p.push(text('/100', { x: sx + scoreW + 16, y: 580, size: 80, fill: COL.white, font: 'anton', ls: 2 }));

  // barre de progression
  const barX = 100, barY = 610, barW = S - 200, barH = 14, barR = 7;
  p.push(`<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${barR}" fill="${COL.mute}" opacity="0.2"/>`);
  const fill = Math.round((score / 100) * barW);
  p.push(`<rect x="${barX}" y="${barY}" width="${fill}" height="${barH}" rx="${barR}" fill="${scoreColor}" opacity="0.85"/>`);
  p.push(`<line x1="${barX + Math.round(69 / 100 * barW)}" y1="${barY - 6}" x2="${barX + Math.round(69 / 100 * barW)}" y2="${barY + barH + 6}" stroke="${COL.yellow}" stroke-width="2" opacity="0.6"/>`);

  // séparateur
  p.push(`<rect x="80" y="646" width="${S - 160}" height="2" fill="${COL.mute}" opacity="0.3"/>`);

  // headline
  const headLines = wrapClamp('mono', headline, 28, S - 160, 3);
  let hy = 700;
  for (const ln of headLines) {
    p.push(text(ln, { x: c, y: hy, size: 28, fill: COL.white, anchor: 'middle' }));
    hy += 42;
  }

  // pied
  p.push(text('IDIOCRACIES.COM', { x: c, y: 940, size: 54, fill: COL.yellow, font: 'anton', anchor: 'middle', ls: 2 }));
  p.push(text('100% SATIRE · UPDATED DAILY', { x: c, y: 988, size: 22, fill: COL.mute, anchor: 'middle', ls: 4 }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${p.join('')}</svg>`;
}

function main() {
  const data = JSON.parse(readFileSync(join(root, 'data', 'scores.json'), 'utf8'));

  const ogSvg = buildSvg(data);
  const ogPng = new Resvg(ogSvg, { background: COL.bg, font: RESVG_FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(join(root, 'assets', 'og.png'), ogPng);
  console.log(`✓ assets/og.png (${(ogPng.length / 1024).toFixed(0)} ko) — score mondial ${data.world?.score}, connerie du jour ${data.spotlight?.country}`);

  const igSvg = buildSquareSvg(data);
  const igPng = new Resvg(igSvg, { background: COL.bg, font: RESVG_FONT, fitTo: { mode: 'width', value: 1080 } }).render().asPng();
  writeFileSync(join(root, 'assets', 'ig.png'), igPng);
  console.log(`✓ assets/ig.png (${(igPng.length / 1024).toFixed(0)} ko) — carré Instagram 1080×1080`);
}

main();
