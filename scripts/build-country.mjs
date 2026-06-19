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
import { text, measure, wrap, wrapClamp, RESVG_FONT } from './svg-text.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OG_DIR = join(root, 'assets', 'og');
const C_DIR = join(root, 'c');
mkdirSync(OG_DIR, { recursive: true });
mkdirSync(C_DIR, { recursive: true });

const W = 1200, H = 630;
// Palette éditoriale « faux quotidien » : papier, encre, UN rouge iconique.
const COL = { paper: '#F7F5EF', ink: '#16130D', soft: '#6b6459', faint: '#8d8678', line: '#dcd6c8', red: '#E3120B' };
// rouge = au-dessus de la ligne 69 (seuil critique) ; encre sinon. cf. assets/app.js
const zoneColor = (s) => (s >= 69 ? COL.red : COL.ink);
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
  const trendCol = t > 0 ? COL.red : COL.soft;

  const p = [];
  p.push(`<rect width="${W}" height="${H}" fill="${COL.paper}"/>`);
  p.push(`<rect x="0" y="0" width="${W}" height="8" fill="${COL.red}"/>`);

  // bandeau-titre
  p.push(text('The Idiocracy Index', { x: 60, y: 78, size: 46, fill: COL.ink, font: 'serif' }));
  p.push(text('NATIONAL STUPIDITY INDEX · DAILY', { x: 62, y: 110, size: 17, fill: COL.soft, ls: 3 }));
  p.push(`<rect x="60" y="128" width="${W - 120}" height="2" fill="${COL.ink}"/>`);

  // bloc score (gauche)
  const numY = 372, numSize = 250, numX = 56;
  p.push(text(String(score), { x: numX, y: numY, size: numSize, fill: zc, font: 'serif' }));
  const numW = measure('serif', String(score), numSize, 0);
  p.push(text('/100', { x: numX + numW + 18, y: numY, size: 66, fill: COL.ink, font: 'serif' }));
  p.push(text(`RANK #${rank} OF ${total} DUMBEST`, { x: 60, y: numY + 48, size: 22, fill: COL.soft, ls: 2 }));
  p.push(text(trendStr, { x: 60, y: numY + 82, size: 20, fill: trendCol, ls: 2 }));

  // cadran-seuil (motif « horloge »)
  const dlX = 60, dlY = numY + 112, dlW = 510, dlH = 12;
  p.push(`<rect x="${dlX}" y="${dlY}" width="${dlW}" height="${dlH}" fill="none" stroke="${COL.line}" stroke-width="1.5"/>`);
  p.push(`<rect x="${dlX}" y="${dlY}" width="${Math.round(Math.min(100, Math.max(0, score)) / 100 * dlW)}" height="${dlH}" fill="${zc}"/>`);
  const m69 = dlX + Math.round(69 / 100 * dlW);
  p.push(`<rect x="${m69 - 1}" y="${dlY - 5}" width="2" height="${dlH + 10}" fill="${COL.red}"/>`);
  p.push(text('0', { x: dlX, y: dlY + 30, size: 14, fill: COL.faint }));
  p.push(text('69 · THE LINE', { x: m69, y: dlY + 30, size: 14, fill: COL.red, anchor: 'middle', ls: 1 }));
  p.push(text('100', { x: dlX + dlW, y: dlY + 30, size: 14, fill: COL.faint, anchor: 'end' }));

  // bloc pays (droite)
  const rx = 640, maxW = W - rx - 56;
  p.push(text('THE NATION', { x: rx, y: 174, size: 19, fill: COL.red, ls: 4 }));
  let cy = 232;
  for (const ln of wrap('serif', name, 56, maxW).slice(0, 2)) {
    p.push(text(ln, { x: rx, y: cy, size: 56, fill: COL.ink, font: 'serif' }));
    cy += 60;
  }
  cy += 24;
  p.push(text("TODAY'S DUMBEST MOVE", { x: rx, y: cy, size: 18, fill: COL.red, ls: 3 }));
  cy += 38;
  for (const ln of wrapClamp('mono', headline, 22, maxW, 5)) {
    p.push(text(ln, { x: rx, y: cy, size: 22, fill: COL.ink }));
    cy += 31;
  }

  p.push(`<rect x="60" y="${H - 56}" width="${W - 120}" height="1" fill="${COL.line}"/>`);
  p.push(text('IDIOCRACIES.COM', { x: 60, y: H - 24, size: 30, fill: COL.ink, font: 'serif', ls: 1 }));
  p.push(text(`100% SATIRE · ${date}`, { x: W - 60, y: H - 26, size: 18, fill: COL.soft, anchor: 'end', ls: 2 }));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${p.join('')}</svg>`;
  return new Resvg(svg, { background: COL.paper, font: RESVG_FONT, fitTo: { mode: 'width', value: W } }).render().asPng();
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
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..600&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/style.css" />
</head>
<body>
  <div class="satire-bar"><span class="tape-txt">⚠ SATIRE</span> &nbsp; No score is a statement of fact. It's a joke. <a href="/about.html#disclaimer">Why?</a></div>
  <header class="site-header">
    <a class="brand" href="/"><span class="brand-logo">🧠💀</span><span class="brand-text">The<strong>Idiocracy Index</strong></span></a>
    <nav class="nav"><a href="/">Scoreboard</a><a href="/about.html">Methodology</a><a href="/merch.html">Shop</a></nav>
  </header>

  <main class="page-article" style="max-width:880px;text-align:center">
    <p style="font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--soft);margin-bottom:6px">National Stupidity Index · Daily</p>
    <h1 style="font-family:var(--serif);font-weight:900;font-size:clamp(30px,6vw,50px);line-height:1.02;letter-spacing:-.02em;margin:0 0 8px">${flag} ${esc(name)}</h1>
    <div style="font-family:var(--serif);font-weight:900;font-size:clamp(76px,15vw,128px);line-height:.86;letter-spacing:-.03em;color:${score >= 69 ? 'var(--red)' : 'var(--ink)'}">${score}<span style="font-family:var(--mono);font-weight:700;font-size:20px;color:var(--faint)"> /100</span></div>
    <p style="font-family:var(--mono);font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--soft);margin:8px 0 0">Rank #${rank} of ${total} on today's global stupidity scoreboard</p>
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
