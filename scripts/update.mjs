#!/usr/bin/env node
/**
 * L'Indice d'Idiocratie — mise à jour quotidienne.
 *
 * Pipeline :
 *   1. Pour chaque pays, on interroge GDELT (gratuit) pour récupérer les titres
 *      d'actualité des dernières 24-48 h.
 *   2. On envoie ces titres à un LLM (Claude Haiku par défaut) avec une grille
 *      satirique → score d'idiocratie 0-100 + un titre + une justification.
 *   3. On agrège par continent et pour le monde, on choisit la "Connerie du jour".
 *   4. On écrit data/scores.json (+ historique).
 *
 * Variables d'environnement :
 *   ANTHROPIC_API_KEY   (recommandé)  — scoring par Claude
 *   OPENAI_API_KEY      (alternative) — scoring par GPT (moins cher)
 *   LLM_PROVIDER        "anthropic" | "openai" | "none"   (def: auto)
 *   DRY_RUN=1           n'écrit pas le fichier, affiche seulement
 *
 * Sans aucune clé API, le script tourne en mode "secousse aléatoire" :
 * il met juste à jour les tendances de façon plausible pour tester la chaîne.
 *
 * Usage : node scripts/update.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { translateData } from './translate.mjs';

// Résout un champ potentiellement multilingue ({en,fr,...}) en anglais.
const pickEn = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v.en || Object.values(v)[0] || '') : (v == null ? '' : v);

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'scores.json');

const PROVIDER = process.env.LLM_PROVIDER ||
  (process.env.ANTHROPIC_API_KEY ? 'anthropic' :
   process.env.OPENAI_API_KEY ? 'openai' : 'none');
const DRY_RUN = process.env.DRY_RUN === '1';

const today = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// 1. ACTUALITÉS — GDELT (gratuit, pas de clé)
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Requêtes sur-mesure pour les pays où le nom seul ramène trop de bruit
// (les USA captent surtout de la géopolitique → on cible le domestique).
const QUERY_OVERRIDES = {
  'United States': '(Trump OR "White House" OR Congress OR "U.S. Senate" OR "Supreme Court" OR governor) (order OR ban OR cut OR scandal OR lawsuit OR bill OR tariff OR firing OR pardon OR ruling OR protest) sourcelang:eng',
};

async function fetchHeadlines(countryName, maxRecords = 15) {
  // GDELT DOC 2.0 — vraies actus politiques récentes (titre + URL + source).
  // GDELT rate-limite les requêtes rapprochées → on réessaie avec backoff.
  const raw = QUERY_OVERRIDES[countryName] ||
    `"${countryName}" (government OR president OR parliament OR law OR minister OR policy OR election) sourcelang:eng`;
  const query = encodeURIComponent(raw);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}` +
    `&mode=ArtList&format=json&timespan=3d&maxrecords=${maxRecords}&sort=DateDesc`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'IdiocracyIndex/1.0' } });
      if (res.status === 429 || res.status >= 500) { await sleep(5000 * (attempt + 1)); continue; }
      if (!res.ok) return [];
      const json = await res.json();
      const seen = new Set();
      return (json.articles || [])
        .filter(a => a.title && a.url && !seen.has(a.title) && seen.add(a.title))
        .map(a => ({ title: a.title, url: a.url, source: a.domain || '', date: (a.seendate || '').slice(0, 8) }))
        .slice(0, maxRecords);
    } catch { await sleep(3000); }
  }
  return [];
}

function fmtGdeltDate(d) { // "20260615" -> "Jun 15, 2026"
  if (!/^\d{8}$/.test(d)) return '';
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${M[+d.slice(4, 6) - 1]} ${+d.slice(6, 8)}, ${d.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// 2. SCORING — LLM
// ---------------------------------------------------------------------------
// The 6 "Idiocracy" axes, straight from the film, with their weights (sum = 100).
export const AXES = [
  { key: 'SCI',       w: 20, label: 'Science vs. pseudoscience' },
  { key: 'SPECTACLE', w: 20, label: 'Substance vs. spectacle in governance' },
  { key: 'PUBLIC',    w: 20, label: 'Public good vs. corporate/consumerist capture' },
  { key: 'KNOW',      w: 15, label: 'Knowledge vs. anti-intellectualism' },
  { key: 'CRIT',      w: 15, label: 'Critical thinking vs. propaganda/conformity' },
  { key: 'FUTURE',    w: 10, label: 'Long-term thinking vs. instant gratification' },
];
const weightedScore = (axes) =>
  clamp(Math.round(AXES.reduce((s, a) => s + (Number(axes && axes[a.key]) || 50) * a.w, 0) / 100), 5, 99);

const RUBRIC = `You are the editor-in-chief of "The Idiocracy Index", a SATIRE site that rates
civilizational stupidity in the spirit of the film Idiocracy (2006). For a country you score
SIX axes drawn from the film. Each axis is 0-100, where 0 = strongly RESISTING idiocracy and
100 = FULL idiocracy on that axis:

- SCI       — Science vs. pseudoscience. UP: anti-science decisions, pseudoscience as policy, ignoring experts (Brawndo "has electrolytes"). DOWN: evidence-based, science-funded policy.
- SPECTACLE — Substance vs. spectacle. UP: governing by show, meme, strongman theatrics, brute force (President Camacho). DOWN: competent, sober, "boring" governance.
- PUBLIC    — Public good vs. corporate/consumerist capture. UP: corporations capturing public institutions, profit over public good (Brawndo owning the FDA). DOWN: institutions serving citizens.
- KNOW      — Knowledge vs. anti-intellectualism. UP: mocking expertise, dumbing down, distrust of education. DOWN: education, literacy, nuance, expertise valued.
- CRIT      — Critical thinking vs. propaganda. UP: conformity, swallowed propaganda, attacks on a free press, no questioning. DOWN: skepticism, media literacy, press freedom.
- FUTURE    — Long-term vs. instant gratification. UP: short-termism, ignored consequences. DOWN: planning, sustainability.

RULES:
- Judge DECISIONS and BEHAVIORS reported in the news, never peoples/ethnicities/religions.
- NEVER use the film's dysgenic premise or any "national IQ" (racist pseudoscience).
- Be HARDER on wealthy countries (especially the USA) than on poor ones.
- Anchor: 40 = sensible, 69 = critical threshold, 90+ = Brawndo won.
- Tone: biting, funny, hyperbolic, never hateful. Short and punchy.

Respond STRICTLY in valid JSON, no surrounding text.`;

async function scoreCountry(country, articles, prevScore) {
  if (PROVIDER === 'none' || articles.length === 0) {
    // pas d'IA ou pas d'actu : on ne touche à rien (le score ne bouge que sur une nouvelle)
    return { score: prevScore, trend: 0, axes: country.axes, headline: country.headline, why: country.why, articles: country.articles || [], refreshed: false };
  }

  const list = articles.map((a, i) => `${i}. ${a.title}  [${a.source}]`).join('\n');
  const user = `COUNTRY: ${country.name}
Previous overall score: ${prevScore}

Recent REAL news headlines (index. title [source]):
${list}

1) Rate ${country.name} TODAY on the SIX axes (each 0-100): SCI, SPECTACLE, PUBLIC, KNOW, CRIT, FUTURE.
2) Pick ONLY headlines genuinely about ${country.name}'s OWN government/politics/society in clear English (skip tangential/foreign/duplicate/non-English). Aim for 4-5, fewer is fine.
   For EACH kept headline give: "i" (index), "axis" (one of SCI/SPECTACLE/PUBLIC/KNOW/CRIT/FUTURE — which axis it illustrates), "impact" (signed int -6..+6, + = toward idiocracy), "note" (one short biting sentence).
3) Give a 1-sentence "headline" (the dumbest item) and a 1-sentence "why".

Return JSON: {"axes":{"SCI":<0-100>,"SPECTACLE":<0-100>,"PUBLIC":<0-100>,"KNOW":<0-100>,"CRIT":<0-100>,"FUTURE":<0-100>},"headline":"<1 sentence>","why":"<1 biting sentence>","articles":[{"i":<idx>,"axis":"<AXIS>","impact":<int>,"note":"<short>"}]}`;

  try {
    const out = PROVIDER === 'anthropic' ? await callAnthropic(RUBRIC, user) : await callOpenAI(RUBRIC, user);
    const parsed = JSON.parse(extractJSON(out));
    const valid = AXES.map(a => a.key);
    const axes = {};
    for (const a of AXES) axes[a.key] = clamp(Math.round(Number(parsed.axes && parsed.axes[a.key]) || 50), 0, 100);
    const score = weightedScore(axes);
    const arts = (parsed.articles || [])
      .map(x => {
        const src = articles[x.i];
        if (!src) return null;
        return { title: src.title, source: src.source, date: fmtGdeltDate(src.date), url: src.url,
                 axis: valid.includes(x.axis) ? x.axis : 'SPECTACLE',
                 impact: clamp(Math.round(x.impact || 0), -6, 6), note: x.note || '' };
      })
      .filter(Boolean)
      .slice(0, 5);
    const refreshed = arts.length >= 3;
    return refreshed
      ? { score, trend: score - (prevScore ?? score), axes, headline: parsed.headline || country.headline, why: parsed.why || country.why, articles: arts, refreshed: true }
      : { score: prevScore, trend: 0, axes: country.axes, headline: country.headline, why: country.why, articles: country.articles || [], refreshed: false };
  } catch (e) {
    console.warn(`  ⚠️  scoring échoué pour ${country.name}: ${e.message}`);
    return { score: prevScore, trend: 0, axes: country.axes, headline: country.headline, why: country.why, articles: country.articles || [], refreshed: false };
  }
}

async function callAnthropic(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.content?.[0]?.text || '';
}

async function callOpenAI(system, user) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function extractJSON(s) {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}
function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log(`🧠 L'Indice d'Idiocratie — mise à jour ${today} (provider: ${PROVIDER})\n`);
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const prevWorld = data.world.score;

  // Score chaque pays (avec pause anti-rate-limit GDELT entre chaque)
  for (let i = 0; i < data.countries.length; i++) {
    const c = data.countries[i];
    if (i > 0) await sleep(4000);
    const arts = await fetchHeadlines(c.name);
    const r = await scoreCountry(c, arts, c.score);
    console.log(`  ${c.flag} ${c.name} — ${arts.length} GDELT → ${r.refreshed ? r.articles.length + ' frais · score ' + r.score : 'inchangé (curés)'}`);
    if (r.refreshed) { // on ne change le score/axes que s'il y a du neuf
      c.axes = r.axes;
      c.score = r.score;
      c.trend = r.trend;
      c.headline = r.headline;
      c.why = r.why;
      c.articles = r.articles;
      c.gdp_adjusted = clamp(Math.round(r.score * 0.95), 5, 99);
    }
  }

  // Continents = moyenne des pays
  for (const cont of data.continents) {
    const members = data.countries.filter(c => c.continent === cont.name).map(c => c.score);
    if (members.length) {
      const newScore = avg(members);
      cont.trend = newScore - cont.score;
      cont.score = newScore;
    }
  }

  // Monde = moyenne des pays
  const worldScore = avg(data.countries.map(c => c.score));
  data.world.trend = worldScore - prevWorld;
  data.world.score = worldScore;
  data.world.label = worldScore >= 69
    ? "We crossed the 69 line. Brawndo won."
    : "Still under the 69 line. Enjoy it while it lasts.";

  // Connerie du jour = plus gros score (ou plus forte hausse)
  const top = [...data.countries].sort((a, b) =>
    (b.score + b.trend * 2) - (a.score + a.trend * 2))[0];
  data.spotlight = {
    country: top.name, flag: top.flag,
    headline: top.headline, why: top.why, score: top.score,
  };
  data.world.headline = `Today's champion: ${top.name}. ${pickEn(top.headline)}`;

  // Historique
  data.updated = today;
  data.history = data.history || [];
  if (!data.history.find(h => h.date === today)) {
    data.history.push({ date: today, world: worldScore });
    data.history = data.history.slice(-90); // 90 derniers jours
  }

  console.log(`\n🌍 Score mondial : ${prevWorld} → ${worldScore} (${data.world.trend >= 0 ? '+' : ''}${data.world.trend})`);
  console.log(`🏆 Connerie du jour : ${top.name} (${top.score})`);

  if (DRY_RUN) {
    // Aperçu : montre les articles générés pour les 2 premiers pays ayant des liens GDELT frais
    const sample = data.countries.filter(c => (c.articles || []).some(a => a.url && a.url.startsWith('http') && !a.url.includes('wikipedia'))).slice(0, 2);
    for (const c of sample.length ? sample : data.countries.slice(0, 1)) {
      console.log(`\n── ${c.flag} ${c.name} (score ${c.score}) ──`);
      for (const a of c.articles || []) {
        console.log(`  ${a.impact >= 0 ? '+' : ''}${a.impact}  ${a.title.slice(0, 70)}`);
        console.log(`        ${a.source} · ${a.url}`);
        console.log(`        ↳ ${a.note}`);
      }
    }
    console.log('\n(DRY_RUN) — fichier non écrit.');
    return;
  }
  if (PROVIDER !== 'none') {
    console.log('\n🌐 Traduction des nouveaux textes (en → fr/es/de)…');
    await translateData(data); // les champs rafraîchis (chaînes EN) deviennent {en,fr,es,de}
  }
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\n✅ ${DATA_PATH} mis à jour.`);

  // Régénère l'image de partage social (og.png) avec le score du jour.
  try {
    await import('./build-og.mjs');
  } catch (e) {
    console.warn(`  ⚠️  og.png non régénéré : ${e.message}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error('💥', e); process.exit(1); });
