#!/usr/bin/env node
/**
 * Génère les favicons + icônes du site à partir du logo (profile.jpg, 1024×1024).
 *   - assets/favicon-16.png / favicon-32.png  → onglet navigateur (cercle, coins transparents)
 *   - assets/apple-touch-icon.png (180)       → écran d'accueil iOS (carré plein)
 *   - assets/icon-192.png / icon-512.png      → PWA / Android (carré plein)
 *   - assets/logo.png (512)                   → usage général / photo de profil
 *
 * Rastérisation via resvg-js, qui embarque le JPEG dans un <image> SVG.
 * Usage : node scripts/build-icons.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'profile.jpg');
const dataUri = 'data:image/jpeg;base64,' + readFileSync(SRC).toString('base64');

// rend le logo à la taille S. circle=true → masque circulaire + coins transparents.
function make(S, file, { circle = false } = {}) {
  const clip = circle
    ? `<defs><clipPath id="c"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}"/></clipPath></defs>`
    : '';
  const cp = circle ? ' clip-path="url(#c)"' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
    `${clip}<image href="${dataUri}" x="0" y="0" width="${S}" height="${S}"${cp}/></svg>`;
  // pas de background → coins transparents quand circle=true
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: S } }).render().asPng();
  writeFileSync(join(root, 'assets', file), png);
  console.log(`✓ assets/${file} (${S}×${S}, ${(png.length / 1024).toFixed(0)} ko)${circle ? ' cercle' : ''}`);
}

make(16, 'favicon-16.png', { circle: true });
make(32, 'favicon-32.png', { circle: true });
make(180, 'apple-touch-icon.png');
make(192, 'icon-192.png');
make(512, 'icon-512.png');
make(512, 'logo.png');
console.log('\nDone.');
