/**
 * build-sitemap.mjs
 *
 * Rend les fiches pays decouvrables par Google. Deux sorties, une seule source
 * de verite (data/scores.json) :
 *
 *   1. sitemap.xml          — les pages statiques + une entree par fiche pays
 *   2. index.html           — l'index des pays, entre les marqueurs
 *                             BEGIN/END:country-links, en vrais liens HTML
 *
 * Pourquoi : avant ce script, les 15 fiches c/*.html etaient orphelines. Le
 * sitemap ne declarait que 4 URL et la seule facon d'atteindre une fiche etait
 * un `location.href` dans un gestionnaire de clic — que Googlebot ne suit pas.
 * L'inspection d'URL de Search Console repondait « Google ne reconnait pas
 * cette URL » pour chacune d'elles.
 *
 * Lance automatiquement par update.mjs, apres build-country.mjs.
 * Manuellement : npm run sitemap
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_PATH = join(ROOT, 'data', 'scores.json');
const SITEMAP_PATH = join(ROOT, 'sitemap.xml');
const INDEX_PATH = join(ROOT, 'index.html');

const ORIGIN = 'https://idiocracies.com';

// Identique a build-country.mjs : les deux doivent produire le meme nom de
// fichier, sinon le sitemap pointerait vers des pages inexistantes.
const slug = (c) => String(c.code || c.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');

const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// Pages fixes. Pas de lastmod sur celles qui ne bougent pas au rythme des
// donnees : annoncer une date du jour sur privacy.html serait faux.
const STATIC_PAGES = [
  { loc: '/', changefreq: 'daily', priority: '1.0', dated: true },
  { loc: '/merch.html', changefreq: 'weekly', priority: '0.7' },
  { loc: '/about.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/privacy.html', changefreq: 'yearly', priority: '0.2' },
];

function buildSitemap(countries, updated) {
  const entry = ({ loc, changefreq, priority, dated }) => [
    '  <url>',
    `    <loc>${ORIGIN}${loc}</loc>`,
    ...(dated && updated ? [`    <lastmod>${updated}</lastmod>`] : []),
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');

  const pages = [
    ...STATIC_PAGES,
    ...countries.map((c) => ({
      loc: `/c/${slug(c)}.html`,
      changefreq: 'daily',
      priority: '0.8',
      dated: true,
    })),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map(entry),
    '</urlset>',
    '',
  ].join('\n');
}

function injectCountryLinks(countries) {
  let html = readFileSync(INDEX_PATH, 'utf8');
  const NL = html.includes('\r\n') ? '\r\n' : '\n';
  const BEGIN = '<!-- BEGIN:country-links -->';
  const END = '<!-- END:country-links -->';

  const start = html.indexOf(BEGIN);
  const end = html.indexOf(END);
  if (start === -1 || end === -1) {
    console.warn('  ⚠️  marqueurs country-links absents de index.html, injection ignoree');
    return 0;
  }

  // Ordre alphabetique plutot que par score : un index se parcourt, et cela
  // evite que index.html soit reecrit a chaque changement de classement.
  const sorted = [...countries].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'en'));

  const links = sorted.map((c) => {
    const href = `c/${slug(c)}.html`;
    const flag = c.flag || '🏳️';
    return `        <li><a class="ci-item" href="${href}">` +
      `<span class="ci-flag" aria-hidden="true">${flag}</span>` +
      `<span class="ci-name">${esc(c.name)}</span></a></li>`;
  }).join(NL);

  html = html.slice(0, start + BEGIN.length) + NL + links + NL + '        ' + html.slice(end);
  writeFileSync(INDEX_PATH, html, 'utf8');
  return sorted.length;
}

function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const countries = data.countries || [];
  if (!countries.length) throw new Error('data/scores.json ne contient aucun pays');

  writeFileSync(SITEMAP_PATH, buildSitemap(countries, data.updated), 'utf8');
  const n = injectCountryLinks(countries);

  console.log(
    `✓ sitemap.xml → ${STATIC_PAGES.length + countries.length} URL ` +
    `(${countries.length} fiches pays) · index.html → ${n} liens explorables`
  );
}

main();
