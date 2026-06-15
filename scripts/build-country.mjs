#!/usr/bin/env node
/**
 * Moteur viral « Partage le score de TON pays ».
 *
 * Pour CHAQUE pays, génère :
 *   1. assets/og/<code>.png, une carte image 1200×630 (score + rang + connerie du jour)
 *   2. c/<code>.html, une page de partage statique dont les balises Open Graph
 *      pointent vers cette carte → quand on partage le lien, l'aperçu social montre
 *      LE score de CE pays.  C'est le mécanisme de croissance auto-alimentée.
 *
 * Régénéré chaque jour par update.mjs (les cartes PNG se rafraîchissent ; les pages
 * HTML sont idempotentes donc ne créent pas de bruit git).
 *
 * Usage : node scripts/build-country.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { text, measure, wrap, RESVG_FONT } from './svg-text.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OG_DIR = join(root, 'assets', 'og');
const C_DIR = join(root, 'c');
mkdirSync(OG_DIR, { recursive: true });
mkdirSync(C_DIR, { recursive: true });

const W = 1200, H = 630;
const COL = { bg: '#07070b', white: '#ffffff', yellow: '#ffd60a', pink: '#ff2e63', dim: '#a6a6c2', mute: '#6c6c86' };
// mêmes zones que assets/app.js
const zoneColor = (s) => s >= 85 ? '#ff2e63' : s >= 69 ? '#ff4d4d' : s >= 50 ? '#ffb02e' : '#34e5a0';
const pickEn = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v.en || Object.values(v)[0] || '') : (v || '');
const slug = (c) => String(c.code || c.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const esc = (s) => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const enc = encodeURIComponent;

function card(country, rank, total, date) {
  const score = country.score;
  const zc = zoneColor(score);
  const name = (country.name || '').toUpperCase();
  const headline = pickEn(country.headline);
  const t = country.trend || 0;
  const trendStr = t > 0 ? `▲ +${t} VS YESTERDAY` : t < 0 ? `▼ ${t} VS YESTERDAY` : 'NO CHANGE VS YESTERDAY';
  const trendCol = t > 0 ? COL.pink : t < 0 ? '#34e5a0' : COL.mute;

  const p = [];
  p.push(`<rect width="${W}" height="${H}" fill="${COL.bg}"/>`);
  p.push(`<rect x="0" y="0" width="${W}" height="10" fill="${COL.yellow}"/>`);
  p.push(`<rect x="0" y="${H - 10}" width="${W}" height="10" fill="${zc}"/>`);

  p.push(text('THE IDIOCRACY INDEX', { x: 70, y: 100, size: 46, fill: COL.white, font: 'anton', ls: 6 }));
  p.push(text('NATIONAL STUPIDITY INDEX', { x: 72, y: 140, size: 20, fill: COL.mute, ls: 4 }));

  // bloc score (gauche)
  const numY = 400, numSize = 280, numX = 64;
  p.push(text(String(score), { x: numX, y: numY, size: numSize, fill: zc, font: 'anton', ls: 4 }));
  const numW = measure('anton', String(score), numSize, 4);
  p.push(text('/100', { x: numX + numW + 22, y: numY, size: 88, fill: COL.white, font: 'anton', ls: 2 }));
  p.push(text(`RANK #${rank} OF ${total} DUMBEST`, { x: 70, y: numY + 54, size: 24, fill: COL.dim, ls: 2 }));
  p.push(text(trendStr, { x: 70, y: numY + 92, size: 22, fill: trendCol, ls: 2 }));

  // bloc pays (droite)
  const rx = 624, maxW = W - rx - 56;
  p.push(text('THE NATION', { x: rx, y: 232, size: 22, fill: zc, ls: 4 }));
  let cy = 292;
  for (const ln of wrap('anton', name, 58, maxW).slice(0, 2)) {
    p.push(text(ln, { x: rx, y: cy, size: 58, fill: COL.yellow, font: 'anton', ls: 1 }));
    cy += 62;
  }
  cy += 18;
  p.push(text("TODAY'S DUMBEST MOVE", { x: rx, y: cy, size: 21, fill: COL.pink, ls: 3 }));
  cy += 40;
  for (const ln of wrap('mono', headline, 25, maxW).slice(0, 4)) {
    p.push(text(ln, { x: rx, y: cy, size: 25, fill: COL.white }));
    cy += 35;
  }

  p.push(text('IDIOCRACIES.COM', { x: 70, y: H - 40, size: 38, fill: COL.yellow, font: 'anton', ls: 2 }));
  p.push(text(`100% SATIRE · ${date}`, { x: W - 70, y: H - 44, size: 20, fill: COL.mute, anchor: 'end', ls: 2 }));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p.join('')}</svg>`;
  return new Resvg(svg, { background: COL.bg, font: RESVG_FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
}

function page(country, rank, total) {
  const s = slug(country);
  const score = country.score;
  const name = country.name;
  const flag = country.flag || '🏳️';
  const headline = pickEn(country.headline);
  const pageUrl = `https://idiocracies.com/c/${s}.html`;
  const imgUrl = `https://idiocracies.com/assets/og/${s}.png`;
  const title = `${name} scores ${score}/100 on The Idiocracy Index`;
  const desc = `${flag} ${name} ranks #${rank} of ${total} on the world's daily stupidity scoreboard. ${headline} 100% satire.`;
  const shareText = `${name} scores ${score}/100 on The Idiocracy Index 🧠💀, rank #${rank} of ${total} dumbest. 100% satire.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${pageUrl}" />
  <meta property="og:site_name" content="The Idiocracy Index" />
  <meta property="og:title" content="${esc(title)} 🧠💀" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${imgUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)} 🧠💀" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${imgUrl}" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/style.css" />
</head>
<body>
  <div class="satire-bar"><span class="tape-txt">⚠ SATIRE</span> &nbsp; No score is a statement of fact. It's a joke. <a href="/about.html#disclaimer">Why?</a></div>
  <header class="site-header">
    <a class="brand" href="/"><span class="brand-logo">🧠💀</span><span class="brand-text">The<strong>Idiocracy Index</strong></span></a>
    <nav class="nav"><a href="/">Scoreboard</a><a href="/about.html">Methodology</a><a href="/merch.html">Shop</a></nav>
  </header>

  <main class="page" style="max-width:920px;text-align:center">
    <h1 style="font-size:1.5rem;margin-bottom:6px">${flag} ${esc(name)}, ${score}/100</h1>
    <p style="color:var(--ink-dim);margin-top:0">Rank #${rank} of ${total} on today's global stupidity scoreboard.</p>
    <img class="country-card-img" src="/assets/og/${s}.png" alt="${esc(title)}" width="1200" height="630" />
    <div class="share-cta-row">
      <a class="btn" href="/">See the full live scoreboard →</a>
    </div>
    <p class="share-label">Share this score:</p>
    <div class="share-row">
      <a class="share-btn x" href="https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(pageUrl)}" target="_blank" rel="noopener">Post on X</a>
      <a class="share-btn fb" href="https://www.facebook.com/sharer/sharer.php?u=${enc(pageUrl)}" target="_blank" rel="noopener">Facebook</a>
      <a class="share-btn wa" href="https://wa.me/?text=${enc(shareText + ' ' + pageUrl)}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="share-btn rd" href="https://www.reddit.com/submit?url=${enc(pageUrl)}&title=${enc(shareText)}" target="_blank" rel="noopener">Reddit</a>
      <button class="share-btn copy" type="button" data-copy="${pageUrl}">Copy link</button>
    </div>
    <p style="margin-top:26px"><a href="/#rankings">← How does another country score?</a></p>
  </main>

  <footer class="site-footer">
    <div class="wrap"><p class="footer-legal">⚠ WORK OF SATIRE. No score is a verifiable statement of fact. This site targets no ethnicity, religion, or named person.</p></div>
  </footer>
  <script>
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.share-btn.copy'); if (!b) return;
      navigator.clipboard.writeText(b.dataset.copy).then(function () {
        var o = b.textContent; b.textContent = 'Copied! ✓'; setTimeout(function () { b.textContent = o; }, 1600);
      });
    });
  </script>
</body>
</html>
`;
}

function main() {
  const data = JSON.parse(readFileSync(join(root, 'data', 'scores.json'), 'utf8'));
  const date = data.updated || '';
  const ranked = [...data.countries].sort((a, b) => b.score - a.score);
  const total = ranked.length;
  ranked.forEach((country, i) => {
    const rank = i + 1;
    const s = slug(country);
    writeFileSync(join(OG_DIR, `${s}.png`), card(country, rank, total, date));
    writeFileSync(join(C_DIR, `${s}.html`), page(country, rank, total));
  });
  console.log(`✓ ${total} cartes pays → assets/og/*.png + c/*.html (maj ${date})`);
}

main();
