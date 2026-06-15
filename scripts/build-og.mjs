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
import { text, measure, wrap, RESVG_FONT } from './svg-text.mjs';

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
  for (const ln of wrap('mono', headline, 27, W - rx - 60).slice(0, 4)) {
    p.push(text(ln, { x: rx, y: cy, size: 27, fill: COL.white }));
    cy += 38;
  }

  // bas
  p.push(text('IDIOCRACIES.COM', { x: 70, y: H - 42, size: 40, fill: COL.yellow, font: 'anton', ls: 2 }));
  p.push(text('100% SATIRE · UPDATED DAILY', { x: W - 70, y: H - 46, size: 22, fill: COL.mute, anchor: 'end', ls: 3 }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p.join('')}</svg>`;
}

function main() {
  const data = JSON.parse(readFileSync(join(root, 'data', 'scores.json'), 'utf8'));
  const svg = buildSvg(data);
  const png = new Resvg(svg, { background: COL.bg, font: RESVG_FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(join(root, 'assets', 'og.png'), png);
  console.log(`✓ assets/og.png (${(png.length / 1024).toFixed(0)} ko) — score mondial ${data.world?.score}, connerie du jour ${data.spotlight?.country}`);
}

main();
