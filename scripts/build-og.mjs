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
// Palette éditoriale « faux quotidien » : papier, encre, UN rouge iconique.
const COL = {
  paper: '#F7F5EF', ink: '#16130D', soft: '#6b6459', faint: '#8d8678',
  line: '#dcd6c8', red: '#E3120B',
};

const pickEn = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v.en || Object.values(v)[0] || '') : (v || '');

function buildSvg(data) {
  const score = data.world?.score ?? 0;
  const sc = score >= 69 ? COL.red : COL.ink;
  const country = (data.spotlight?.country || '').toUpperCase();
  const headline = pickEn(data.spotlight?.headline);

  const p = [];
  p.push(`<rect width="${W}" height="${H}" fill="${COL.paper}"/>`);
  p.push(`<rect x="0" y="0" width="${W}" height="8" fill="${COL.red}"/>`);

  // bandeau-titre
  p.push(text('The Idiocracy Index', { x: 60, y: 86, size: 50, fill: COL.ink, font: 'serif' }));
  p.push(text("THE WORLD'S STUPIDITY SCOREBOARD", { x: 62, y: 120, size: 18, fill: COL.soft, ls: 4 }));
  p.push(`<rect x="60" y="138" width="${W - 120}" height="2" fill="${COL.ink}"/>`);

  // gros score mondial (gauche)
  const numY = 396, numSize = 258, numX = 56;
  p.push(text(String(score), { x: numX, y: numY, size: numSize, fill: sc, font: 'serif' }));
  const numW = measure('serif', String(score), numSize, 0);
  p.push(text('/100', { x: numX + numW + 18, y: numY, size: 70, fill: COL.ink, font: 'serif' }));
  p.push(text('GLOBAL STUPIDITY · TODAY', { x: 60, y: numY + 50, size: 22, fill: COL.soft, ls: 3 }));

  // cadran-seuil (motif « horloge »)
  const dlX = 60, dlY = numY + 92, dlW = 520, dlH = 12;
  p.push(`<rect x="${dlX}" y="${dlY}" width="${dlW}" height="${dlH}" fill="none" stroke="${COL.line}" stroke-width="1.5"/>`);
  p.push(`<rect x="${dlX}" y="${dlY}" width="${Math.round(Math.min(100, Math.max(0, score)) / 100 * dlW)}" height="${dlH}" fill="${sc}"/>`);
  const m69 = dlX + Math.round(69 / 100 * dlW);
  p.push(`<rect x="${m69 - 1}" y="${dlY - 5}" width="2" height="${dlH + 10}" fill="${COL.red}"/>`);
  p.push(text('0', { x: dlX, y: dlY + 30, size: 14, fill: COL.faint }));
  p.push(text('69 · THE LINE', { x: m69, y: dlY + 30, size: 14, fill: COL.red, anchor: 'middle', ls: 1 }));
  p.push(text('100', { x: dlX + dlW, y: dlY + 30, size: 14, fill: COL.faint, anchor: 'end' }));

  // colonne droite : connerie du jour
  const rx = 648;
  p.push(text("TODAY'S DUMBEST MOVE", { x: rx, y: 198, size: 19, fill: COL.red, ls: 3 }));
  let cy = 254;
  for (const ln of wrap('serif', country, 56, W - rx - 56).slice(0, 2)) {
    p.push(text(ln, { x: rx, y: cy, size: 54, fill: COL.ink, font: 'serif' }));
    cy += 58;
  }
  cy += 22;
  for (const ln of wrapClamp('mono', headline, 22, W - rx - 56, 5)) {
    p.push(text(ln, { x: rx, y: cy, size: 22, fill: COL.ink }));
    cy += 31;
  }

  // bas
  p.push(`<rect x="60" y="${H - 56}" width="${W - 120}" height="1" fill="${COL.line}"/>`);
  p.push(text('IDIOCRACIES.COM', { x: 60, y: H - 24, size: 32, fill: COL.ink, font: 'serif', ls: 1 }));
  p.push(text('100% SATIRE · UPDATED DAILY', { x: W - 60, y: H - 26, size: 18, fill: COL.soft, anchor: 'end', ls: 2 }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p.join('')}</svg>`;
}

// ---------------------------------------------------------------------------
// Image carrée 1080×1080 pour Instagram — centrée, lisible dans la grille
// ---------------------------------------------------------------------------
function buildSquareSvg(data) {
  const S = 1080, c = S / 2;
  const score = data.world?.score ?? 0;
  const sc = score >= 69 ? COL.red : COL.ink;
  const country = (data.spotlight?.country || '').toUpperCase();
  const headline = pickEn(data.spotlight?.headline) || '';

  const p = [];
  p.push(`<rect width="${S}" height="${S}" fill="${COL.paper}"/>`);
  p.push(`<rect x="0" y="0" width="${S}" height="10" fill="${COL.red}"/>`);

  // bandeau-titre
  p.push(text('The Idiocracy Index', { x: c, y: 118, size: 62, fill: COL.ink, font: 'serif', anchor: 'middle' }));
  p.push(text("THE WORLD'S STUPIDITY SCOREBOARD", { x: c, y: 156, size: 20, fill: COL.soft, anchor: 'middle', ls: 3 }));
  p.push(`<rect x="90" y="182" width="${S - 180}" height="2" fill="${COL.ink}"/>`);

  // ===== SCORE MONDIAL (en haut, clairement étiqueté GLOBAL) =====
  // Ce chiffre est le score du MONDE, pas du pays vedette. On le pose tout en
  // haut, SÉPARÉ de la « connerie du jour », pour qu'on ne lise jamais
  // « United States = 50 ».
  const scoreStr = String(score);
  const scoreSize = 238;
  const scoreW = measure('serif', scoreStr, scoreSize, 0);
  const slashW = measure('serif', '/100', 76, 0);
  const sx = c - (scoreW + 16 + slashW) / 2;
  p.push(text(scoreStr, { x: sx, y: 406, size: scoreSize, fill: sc, font: 'serif' }));
  p.push(text('/100', { x: sx + scoreW + 16, y: 406, size: 76, fill: COL.ink, font: 'serif' }));
  p.push(text('GLOBAL STUPIDITY · TODAY', { x: c, y: 456, size: 24, fill: COL.soft, anchor: 'middle', ls: 3 }));

  // cadran-seuil (repère de la ligne 69)
  const barX = 130, barY = 502, barW = S - 260, barH = 14;
  p.push(`<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" fill="none" stroke="${COL.line}" stroke-width="1.5"/>`);
  const fillW = Math.round(Math.min(100, Math.max(0, score)) / 100 * barW);
  p.push(`<rect x="${barX}" y="${barY}" width="${fillW}" height="${barH}" fill="${sc}"/>`);
  const m69 = barX + Math.round(69 / 100 * barW);
  p.push(`<rect x="${m69 - 1}" y="${barY - 6}" width="2" height="${barH + 12}" fill="${COL.red}"/>`);
  p.push(text('69 · THE LINE', { x: m69, y: barY + 36, size: 15, fill: COL.red, anchor: 'middle', ls: 1 }));

  // séparateur
  p.push(`<rect x="100" y="588" width="${S - 200}" height="1" fill="${COL.line}"/>`);

  // ===== CONNERIE DU JOUR (section distincte, sous le score) =====
  p.push(text("TODAY'S DUMBEST MOVE", { x: c, y: 650, size: 26, fill: COL.red, anchor: 'middle', ls: 3 }));
  const countryLines = wrap('serif', country, 62, S - 140).slice(0, 2);
  let cy = 720;
  for (const ln of countryLines) {
    p.push(text(ln, { x: c, y: cy, size: 60, fill: COL.ink, font: 'serif', anchor: 'middle' }));
    cy += 66;
  }
  cy += 16;
  for (const ln of wrapClamp('mono', headline, 24, S - 150, 3)) {
    p.push(text(ln, { x: c, y: cy, size: 25, fill: COL.ink, anchor: 'middle' }));
    cy += 36;
  }

  // pied
  p.push(`<rect x="90" y="${S - 88}" width="${S - 180}" height="1" fill="${COL.line}"/>`);
  p.push(text('IDIOCRACIES.COM', { x: c, y: S - 50, size: 46, fill: COL.ink, font: 'serif', anchor: 'middle', ls: 1 }));
  p.push(text('100% SATIRE · UPDATED DAILY', { x: c, y: S - 22, size: 20, fill: COL.soft, anchor: 'middle', ls: 2 }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${p.join('')}</svg>`;
}

function main() {
  const data = JSON.parse(readFileSync(join(root, 'data', 'scores.json'), 'utf8'));

  const ogSvg = buildSvg(data);
  const ogPng = new Resvg(ogSvg, { background: COL.paper, font: RESVG_FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(join(root, 'assets', 'og.png'), ogPng);
  console.log(`✓ assets/og.png (${(ogPng.length / 1024).toFixed(0)} ko) — score mondial ${data.world?.score}, connerie du jour ${data.spotlight?.country}`);

  const igSvg = buildSquareSvg(data);
  const igPng = new Resvg(igSvg, { background: COL.paper, font: RESVG_FONT, fitTo: { mode: 'width', value: 1080 } }).render().asPng();
  writeFileSync(join(root, 'assets', 'ig.png'), igPng);
  console.log(`✓ assets/ig.png (${(igPng.length / 1024).toFixed(0)} ko) — carré Instagram 1080×1080`);
}

main();
