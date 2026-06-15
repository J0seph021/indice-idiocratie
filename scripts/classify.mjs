#!/usr/bin/env node
/**
 * Classe les articles curés existants dans la grille des 6 axes et attribue à
 * chaque pays ses 6 sous-notes (0-100). Recalcule le score = moyenne pondérée.
 * À lancer une fois pour aligner les données curées sur la nouvelle méthodologie.
 * Usage : OPENAI_API_KEY=... node scripts/classify.mjs   (ou ANTHROPIC_API_KEY)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data', 'scores.json');
const PROVIDER = process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pickEn = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v.en || Object.values(v)[0] || '') : (v == null ? '' : v);

const AXES = [
  { key: 'SCI', w: 20 }, { key: 'SPECTACLE', w: 20 }, { key: 'PUBLIC', w: 20 },
  { key: 'KNOW', w: 15 }, { key: 'CRIT', w: 15 }, { key: 'FUTURE', w: 10 },
];
const weightedScore = (axes) => clamp(Math.round(AXES.reduce((s, a) => s + (Number(axes && axes[a.key]) || 50) * a.w, 0) / 100), 5, 99);

const SYS = `You classify satirical news into the 6 "Idiocracy" axes:
SCI (science vs pseudoscience), SPECTACLE (substance vs spectacle/strongman), PUBLIC (public good vs corporate capture),
KNOW (knowledge vs anti-intellectualism), CRIT (critical thinking vs propaganda/press attacks), FUTURE (long-term vs short-term).
Each axis is 0-100 (0 = resisting idiocracy, 100 = full idiocracy). Respond STRICT JSON only.`;

async function llm(user) {
  if (PROVIDER === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 600, system: SYS, messages: [{ role: 'user', content: user }] }) });
    if (!r.ok) throw new Error('Anthropic ' + r.status); return (await r.json()).content?.[0]?.text || '';
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', max_tokens: 600, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYS }, { role: 'user', content: user }] }) });
  if (!r.ok) throw new Error('OpenAI ' + r.status); return (await r.json()).choices?.[0]?.message?.content || '';
}
const extractJSON = (s) => { const m = s.match(/\{[\s\S]*\}/); return m ? m[0] : s; };

async function main() {
  const data = JSON.parse(await readFile(DATA, 'utf8'));
  console.log(`🗂️  Classification dans la grille (provider: ${PROVIDER})\n`);
  for (let i = 0; i < data.countries.length; i++) {
    const c = data.countries[i];
    const arts = (c.articles || []).map((a, j) => `${j}. [impact ${a.impact}] ${pickEn(a.title)}`).join('\n');
    const user = `COUNTRY: ${c.name} (current overall stupidity score: ${c.score})
Articles:
${arts || '(none)'}

Give: "axes" = the 6 axis sub-scores (0-100) that, weighted (SCI/SPECTACLE/PUBLIC 20% each, KNOW/CRIT 15%, FUTURE 10%), land NEAR ${c.score}; and "axis" = an array assigning ONE axis to each article above, in order.
Return JSON: {"axes":{"SCI":n,"SPECTACLE":n,"PUBLIC":n,"KNOW":n,"CRIT":n,"FUTURE":n},"axis":["AXIS",...]}`;
    if (i > 0) await sleep(2500);
    let p;
    try { p = JSON.parse(extractJSON(await llm(user))); }
    catch (e) { console.warn(`  ⚠️  ${c.name}: ${e.message}`); continue; }
    const axes = {}; for (const a of AXES) axes[a.key] = clamp(Math.round(Number(p.axes && p.axes[a.key]) || 50), 0, 100);
    c.axes = axes;
    c.score = weightedScore(axes);
    const valid = AXES.map(a => a.key);
    (c.articles || []).forEach((a, j) => { const ax = (p.axis || [])[j]; a.axis = valid.includes(ax) ? ax : 'SPECTACLE'; });
    console.log(`  ✓ ${c.flag} ${c.name} → score ${c.score}  [${AXES.map(a => a.key + ':' + axes[a.key]).join(' ')}]`);
  }
  // recompute continents + world from the new scores
  const avg = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
  for (const cont of data.continents) {
    const m = data.countries.filter(c => c.continent === cont.name).map(c => c.score);
    if (m.length) cont.score = avg(m);
  }
  data.world.score = avg(data.countries.map(c => c.score));
  await writeFile(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\n✅ Données classées. Score mondial: ${data.world.score}`);
}
main().catch(e => { console.error('💥', e); process.exit(1); });
