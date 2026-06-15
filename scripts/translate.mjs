#!/usr/bin/env node
/**
 * Traduit les champs texte de data/scores.json en {en, fr, es, de}.
 * Idempotent : un champ déjà multilingue (objet) est ignoré.
 * Usage : OPENAI_API_KEY=... node scripts/translate.mjs   (ou ANTHROPIC_API_KEY)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data', 'scores.json');
const TARGETS = ['fr', 'es', 'de'];
const PROVIDER = process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SYS = `You are a professional translator for a SATIRICAL news site (The Idiocracy Index).
Translate the given English strings into French (fr), Spanish (es) and German (de).
Keep the biting, humorous tone. Keep it natural and idiomatic, not literal.
Do NOT translate proper nouns, brand names or coined terms (Idiocracy, Brawndo, Camacho, country/person names, NEET, etc.).
Return STRICT JSON only.`;

async function llm(user) {
  if (PROVIDER === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 2000, system: SYS, messages: [{ role: 'user', content: user }] }),
    });
    if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + await r.text());
    return (await r.json()).content?.[0]?.text || '';
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', max_tokens: 2000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error('OpenAI ' + r.status + ': ' + await r.text());
  return (await r.json()).choices?.[0]?.message?.content || '';
}

function extractJSON(s) { const m = s.match(/\{[\s\S]*\}/); return m ? m[0] : s; }

// Translate a flat {key: english} batch -> {key: {en,fr,es,de}}
async function translateBatch(label, strings) {
  const keys = Object.keys(strings).filter(k => typeof strings[k] === 'string' && strings[k].trim());
  if (!keys.length) return {};
  const payload = Object.fromEntries(keys.map(k => [k, strings[k]]));
  const user = `Translate every value below. Return JSON {"fr":{<same keys>},"es":{<same keys>},"de":{<same keys>}}.\n\n${JSON.stringify(payload, null, 1)}`;
  let out;
  for (let i = 0; i < 3; i++) {
    try { out = JSON.parse(extractJSON(await llm(user))); break; }
    catch (e) { console.warn(`  retry ${label}: ${e.message}`); await sleep(3000); }
  }
  if (!out) { console.warn(`  ⚠️  échec ${label}, on garde l'anglais`); out = {}; }
  const res = {};
  for (const k of keys) {
    res[k] = { en: strings[k] };
    for (const t of TARGETS) res[k][t] = (out[t] && out[t][k]) || strings[k];
  }
  return res;
}

const needsT = (v) => typeof v === 'string'; // string = pas encore traduit

export async function translateData(data) {
  console.log(`🌐 Traduction (provider: ${PROVIDER}) → ${TARGETS.join(', ')}\n`);

  // World + spotlight
  const wsStr = {};
  if (needsT(data.world.label)) wsStr.world_label = data.world.label;
  if (needsT(data.world.headline)) wsStr.world_headline = data.world.headline;
  if (data.spotlight && needsT(data.spotlight.headline)) wsStr.spot_headline = data.spotlight.headline;
  if (data.spotlight && needsT(data.spotlight.why)) wsStr.spot_why = data.spotlight.why;
  if (Object.keys(wsStr).length) {
    const t = await translateBatch('world/spotlight', wsStr);
    if (t.world_label) data.world.label = t.world_label;
    if (t.world_headline) data.world.headline = t.world_headline;
    if (t.spot_headline) data.spotlight.headline = t.spot_headline;
    if (t.spot_why) data.spotlight.why = t.spot_why;
    console.log('  ✓ world / spotlight');
  }

  // Countries (un batch par pays : headline, why, et chaque article title+note)
  for (let i = 0; i < data.countries.length; i++) {
    const c = data.countries[i];
    const str = {};
    if (needsT(c.headline)) str.headline = c.headline;
    if (needsT(c.why)) str.why = c.why;
    (c.articles || []).forEach((a, j) => {
      if (needsT(a.title)) str[`a${j}_title`] = a.title;
      if (needsT(a.note)) str[`a${j}_note`] = a.note;
    });
    if (!Object.keys(str).length) { console.log(`  ⏭  ${c.name} (déjà traduit)`); continue; }
    if (i > 0) await sleep(2500);
    const t = await translateBatch(c.name, str);
    if (t.headline) c.headline = t.headline;
    if (t.why) c.why = t.why;
    (c.articles || []).forEach((a, j) => {
      if (t[`a${j}_title`]) a.title = t[`a${j}_title`];
      if (t[`a${j}_note`]) a.note = t[`a${j}_note`];
    });
    console.log(`  ✓ ${c.flag} ${c.name}`);
  }

  return data;
}

async function main() {
  const data = JSON.parse(await readFile(DATA, 'utf8'));
  await translateData(data);
  await writeFile(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('\n✅ data/scores.json traduit (en/fr/es/de).');
}
// Exécution directe uniquement (pas quand importé par update.mjs)
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error('💥', e); process.exit(1); });
