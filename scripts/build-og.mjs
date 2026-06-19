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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
// Image PORTRAIT 4:5 (1080×1350) pour Instagram ET Facebook — format vertical,
// recommandé pour le feed mobile (prend plus de place, meilleure portée).
// Hiérarchie : gros chiffre en haut, « connerie du jour » dessous.
// ---------------------------------------------------------------------------
function buildPortraitSvg(data) {
  const S = 1080, H = 1350, c = S / 2;
  const score = data.world?.score ?? 0;
  const sc = score >= 69 ? COL.red : COL.ink;
  const country = (data.spotlight?.country || '').toUpperCase();
  const headline = pickEn(data.spotlight?.headline) || '';

  const p = [];
  p.push(`<rect width="${S}" height="${H}" fill="${COL.paper}"/>`);
  p.push(`<rect x="0" y="0" width="${S}" height="12" fill="${COL.red}"/>`);

  // bandeau-titre
  p.push(text('The Idiocracy Index', { x: c, y: 138, size: 66, fill: COL.ink, font: 'serif', anchor: 'middle' }));
  p.push(text("THE WORLD'S STUPIDITY SCOREBOARD", { x: c, y: 180, size: 21, fill: COL.soft, anchor: 'middle', ls: 3 }));
  p.push(`<rect x="90" y="208" width="${S - 180}" height="2" fill="${COL.ink}"/>`);

  // ===== SCORE MONDIAL (gros chiffre en haut) =====
  p.push(text('GLOBAL STUPIDITY · TODAY', { x: c, y: 326, size: 26, fill: COL.soft, anchor: 'middle', ls: 4 }));
  const scoreStr = String(score), scoreSize = 320;
  const scoreW = measure('serif', scoreStr, scoreSize, 0);
  const slashW = measure('serif', '/100', 92, 0);
  const sx = c - (scoreW + 20 + slashW) / 2;
  p.push(text(scoreStr, { x: sx, y: 580, size: scoreSize, fill: sc, font: 'serif' }));
  p.push(text('/100', { x: sx + scoreW + 20, y: 580, size: 92, fill: COL.ink, font: 'serif' }));

  // cadran-seuil (repère de la ligne 69)
  const barX = 130, barY = 646, barW = S - 260, barH = 16;
  p.push(`<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" fill="none" stroke="${COL.line}" stroke-width="1.5"/>`);
  const fillW = Math.round(Math.min(100, Math.max(0, score)) / 100 * barW);
  p.push(`<rect x="${barX}" y="${barY}" width="${fillW}" height="${barH}" fill="${sc}"/>`);
  const m69 = barX + Math.round(69 / 100 * barW);
  p.push(`<rect x="${m69 - 1}" y="${barY - 7}" width="2" height="${barH + 14}" fill="${COL.red}"/>`);
  p.push(text('0', { x: barX, y: barY + 42, size: 16, fill: COL.faint }));
  p.push(text('69 · THE LINE', { x: m69, y: barY + 42, size: 16, fill: COL.red, anchor: 'middle', ls: 1 }));
  p.push(text('100', { x: barX + barW, y: barY + 42, size: 16, fill: COL.faint, anchor: 'end' }));

  // séparateur
  p.push(`<rect x="100" y="772" width="${S - 200}" height="1" fill="${COL.line}"/>`);

  // ===== CONNERIE DU JOUR (section distincte, sous le score) =====
  p.push(text("TODAY'S DUMBEST MOVE", { x: c, y: 842, size: 30, fill: COL.red, anchor: 'middle', ls: 3 }));
  const countryLines = wrap('serif', country, 64, S - 130).slice(0, 2);
  let cy = 926;
  for (const ln of countryLines) {
    p.push(text(ln, { x: c, y: cy, size: 66, fill: COL.ink, font: 'serif', anchor: 'middle' }));
    cy += 74;
  }
  cy += 20;
  for (const ln of wrapClamp('mono', headline, 26, S - 140, 4)) {
    p.push(text(ln, { x: c, y: cy, size: 27, fill: COL.ink, anchor: 'middle' }));
    cy += 38;
  }

  // pied
  p.push(`<rect x="90" y="${H - 96}" width="${S - 180}" height="1" fill="${COL.line}"/>`);
  p.push(text('IDIOCRACIES.COM', { x: c, y: H - 52, size: 50, fill: COL.ink, font: 'serif', anchor: 'middle', ls: 1 }));
  p.push(text('100% SATIRE · UPDATED DAILY', { x: c, y: H - 22, size: 21, fill: COL.soft, anchor: 'middle', ls: 2 }));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${H}" viewBox="0 0 ${S} ${H}">${p.join('')}</svg>`;
}

// ---------------------------------------------------------------------------
// CARROUSEL Instagram — 3 slides 4:5 (1080×1350) : score mondial → connerie du
// jour → top 5 du classement. Le carrousel est le format le plus performant sur
// Instagram. Slides servies à des URLs publiques (assets/og/post-{1,2,3}.png).
// ---------------------------------------------------------------------------
function carouselSlides(data) {
  const S = 1080, H = 1350, c = S / 2;
  const world = data.world?.score ?? 0;
  const spot = data.spotlight || {};
  const ranked = [...(data.countries || [])].sort((a, b) => b.score - a.score);
  const wrapSvg = (p) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${H}" viewBox="0 0 ${S} ${H}">${p.join('')}</svg>`;

  // chrome commun : bandeau-titre + pied + indicateur n/3
  function frame(idx) {
    const p = [];
    p.push(`<rect width="${S}" height="${H}" fill="${COL.paper}"/>`);
    p.push(`<rect x="0" y="0" width="${S}" height="12" fill="${COL.red}"/>`);
    p.push(text('The Idiocracy Index', { x: c, y: 104, size: 50, fill: COL.ink, font: 'serif', anchor: 'middle' }));
    p.push(`<rect x="90" y="132" width="${S - 180}" height="2" fill="${COL.ink}"/>`);
    p.push(`<rect x="90" y="${H - 92}" width="${S - 180}" height="1" fill="${COL.line}"/>`);
    p.push(text('IDIOCRACIES.COM', { x: 90, y: H - 46, size: 30, fill: COL.ink, font: 'serif', ls: 1 }));
    p.push(text(`${idx} / 3`, { x: S - 90, y: H - 46, size: 22, fill: COL.soft, anchor: 'end' }));
    p.push(text('100% SATIRE · UPDATED DAILY', { x: 90, y: H - 22, size: 16, fill: COL.faint, ls: 1 }));
    return p;
  }

  // Slide 1 — score mondial (accroche)
  const sc1 = world >= 69 ? COL.red : COL.ink;
  const s1 = frame(1);
  s1.push(text('GLOBAL STUPIDITY · TODAY', { x: c, y: 330, size: 28, fill: COL.soft, anchor: 'middle', ls: 4 }));
  const w1 = String(world), ww = measure('serif', w1, 360, 0), sw = measure('serif', '/100', 100, 0);
  const sx1 = c - (ww + 22 + sw) / 2;
  s1.push(text(w1, { x: sx1, y: 630, size: 360, fill: sc1, font: 'serif' }));
  s1.push(text('/100', { x: sx1 + ww + 22, y: 630, size: 100, fill: COL.ink, font: 'serif' }));
  const bX = 130, bY = 716, bW = S - 260, bH = 18;
  s1.push(`<rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" fill="none" stroke="${COL.line}" stroke-width="1.5"/>`);
  s1.push(`<rect x="${bX}" y="${bY}" width="${Math.round(Math.min(100, Math.max(0, world)) / 100 * bW)}" height="${bH}" fill="${sc1}"/>`);
  const mm = bX + Math.round(69 / 100 * bW);
  s1.push(`<rect x="${mm - 1}" y="${bY - 7}" width="2" height="${bH + 14}" fill="${COL.red}"/>`);
  s1.push(text('0', { x: bX, y: bY + 44, size: 16, fill: COL.faint }));
  s1.push(text('69 · THE LINE', { x: mm, y: bY + 44, size: 16, fill: COL.red, anchor: 'middle', ls: 1 }));
  s1.push(text('100', { x: bX + bW, y: bY + 44, size: 16, fill: COL.faint, anchor: 'end' }));
  s1.push(text(world >= 69 ? 'We crossed the 69 line.' : 'Still under the 69 line — for now.', { x: c, y: 882, size: 28, fill: COL.ink, anchor: 'middle' }));
  s1.push(text("SWIPE FOR TODAY'S DUMBEST MOVE", { x: c, y: 1090, size: 22, fill: COL.red, anchor: 'middle', ls: 2 }));

  // Slide 2 — connerie du jour
  const spScore = spot.score ?? 0, sc2 = spScore >= 69 ? COL.red : COL.ink;
  const country = (spot.country || '').toUpperCase();
  const headline = pickEn(spot.headline) || '', why = pickEn(spot.why) || '';
  const s2 = frame(2);
  s2.push(text("TODAY'S DUMBEST MOVE", { x: c, y: 250, size: 30, fill: COL.red, anchor: 'middle', ls: 3 }));
  s2.push(text(String(spScore), { x: c, y: 480, size: 200, fill: sc2, font: 'serif', anchor: 'middle' }));
  let cy = 596;
  for (const ln of wrap('serif', country, 60, S - 130).slice(0, 2)) { s2.push(text(ln, { x: c, y: cy, size: 58, fill: COL.ink, font: 'serif', anchor: 'middle' })); cy += 64; }
  cy += 24;
  for (const ln of wrapClamp('mono', headline, 24, S - 130, 4)) { s2.push(text(ln, { x: c, y: cy, size: 28, fill: COL.ink, anchor: 'middle' })); cy += 40; }
  cy += 16;
  for (const ln of wrapClamp('mono', why, 32, S - 160, 3)) { s2.push(text(ln, { x: c, y: cy, size: 20, fill: COL.soft, anchor: 'middle' })); cy += 30; }

  // Slide 3 — top 5 du classement
  const s3 = frame(3);
  s3.push(text("TODAY'S DUMBEST NATIONS", { x: c, y: 250, size: 30, fill: COL.red, anchor: 'middle', ls: 3 }));
  let ry = 372;
  for (let i = 0; i < Math.min(5, ranked.length); i++) {
    const cc = ranked[i], crit = cc.score >= 69;
    s3.push(text(String(i + 1), { x: 110, y: ry, size: 46, fill: crit ? COL.red : COL.faint, font: 'serif' }));
    for (const ln of wrap('serif', cc.name, 36, S - 360).slice(0, 1)) s3.push(text(ln, { x: 200, y: ry - 4, size: 38, fill: COL.ink, font: 'serif' }));
    s3.push(text(String(cc.score), { x: S - 110, y: ry, size: 58, fill: crit ? COL.red : COL.ink, font: 'serif', anchor: 'end' }));
    s3.push(`<rect x="90" y="${ry + 28}" width="${S - 180}" height="1" fill="${COL.line}"/>`);
    ry += 144;
  }
  s3.push(text('FULL RANKING AT IDIOCRACIES.COM', { x: c, y: H - 150, size: 24, fill: COL.ink, anchor: 'middle', ls: 2 }));

  return [wrapSvg(s1), wrapSvg(s2), wrapSvg(s3)];
}

function main() {
  const data = JSON.parse(readFileSync(join(root, 'data', 'scores.json'), 'utf8'));

  const ogSvg = buildSvg(data);
  const ogPng = new Resvg(ogSvg, { background: COL.paper, font: RESVG_FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(join(root, 'assets', 'og.png'), ogPng);
  console.log(`✓ assets/og.png (${(ogPng.length / 1024).toFixed(0)} ko) — score mondial ${data.world?.score}, connerie du jour ${data.spotlight?.country}`);

  const igSvg = buildPortraitSvg(data);
  const igPng = new Resvg(igSvg, { background: COL.paper, font: RESVG_FONT, fitTo: { mode: 'width', value: 1080 } }).render().asPng();
  writeFileSync(join(root, 'assets', 'ig.png'), igPng);
  console.log(`✓ assets/ig.png (${(igPng.length / 1024).toFixed(0)} ko) — portrait 4:5 Instagram/Facebook 1080×1350`);

  // Carrousel Instagram (3 slides 4:5) → assets/og/post-{1,2,3}.png
  mkdirSync(join(root, 'assets', 'og'), { recursive: true });
  carouselSlides(data).forEach((svg, i) => {
    const png = new Resvg(svg, { background: COL.paper, font: RESVG_FONT, fitTo: { mode: 'width', value: 1080 } }).render().asPng();
    writeFileSync(join(root, 'assets', 'og', `post-${i + 1}.png`), png);
  });
  console.log('✓ assets/og/post-1..3.png — carrousel Instagram 4:5 (score / connerie / classement)');
}

main();
