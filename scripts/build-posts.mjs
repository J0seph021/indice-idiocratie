#!/usr/bin/env node
/**
 * Génère des BROUILLONS de posts réseaux sociaux à partir de data/scores.json.
 *   → marketing/social/posts-AAAA-MM-JJ.md   (daté, archivé)
 *   → marketing/social/latest.md             (toujours le plus récent)
 *
 * Le dossier marketing/ est gitignoré : ces textes restent privés, à toi de
 * copier-coller et de publier toi-même. Rien n'est posté automatiquement.
 *
 * Plusieurs angles sont produits chaque jour (score mondial, connerie du jour,
 * podium, plus forte hausse) pour chaque plateforme. Tu piges ce qui te plaît.
 *
 * Usage :
 *   node scripts/build-posts.mjs            # langue FR (défaut)
 *   node scripts/build-posts.mjs --lang=en  # version anglaise
 *   npm run posts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'idiocracies.com';
const URL = 'https://idiocracies.com';
const LINE = 69; // la ligne critique de connerie

// --- args -------------------------------------------------------------------
const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};
const LANG = (arg('lang', 'fr') || 'fr').toLowerCase();

// --- data -------------------------------------------------------------------
const data = JSON.parse(readFileSync(join(ROOT, 'data', 'scores.json'), 'utf8'));
const date = data.updated || new Date().toISOString().slice(0, 10);
const T = (obj) => (obj && (obj[LANG] || obj.en || obj.fr)) || '';

// petit générateur pseudo-aléatoire ensemencé par la date :
// les posts varient d'un jour à l'autre mais sont stables si on relance.
let seed = [...date].reduce((a, c) => a + c.charCodeAt(0), 0);
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// --- vocabulaire ------------------------------------------------------------
const STR = {
  fr: {
    over: (s) => `🚨 ${s}/100 — on a franchi la ligne des ${LINE}. Brawndo a gagné.`,
    under: (s) => `${s}/100 — encore sous la ligne des ${LINE}… mais l'année est jeune.`,
    worldHooks: [
      'Indice d\'Idiocratie — bulletin du jour 🧠💀',
      'Le QI de la planète aujourd\'hui :',
      'Score mondial de connerie civilisationnelle :',
    ],
    spotlightHook: 'La connerie du jour 🏆',
    podiumHook: 'Le podium de la bêtise aujourd\'hui 🥇🥈🥉',
    moverHook: 'Plus forte hausse du jour 📈',
    why: 'Pourquoi',
    trendUp: 'en hausse',
    full: 'Palmarès complet',
    disclaimer: '⚠️ 100 % satire. On note des décisions, jamais des peuples.',
    tags: ['#Idiocratie', '#Idiocracy', '#Satire', '#Actu', '#Géopolitique'],
  },
  en: {
    over: (s) => `🚨 ${s}/100 — we crossed the ${LINE} line. Brawndo won.`,
    under: (s) => `${s}/100 — still under the ${LINE} line… but the year is young.`,
    worldHooks: [
      'The Idiocracy Index — today\'s bulletin 🧠💀',
      'The planet\'s IQ today:',
      'World civilizational-stupidity score:',
    ],
    spotlightHook: 'Stupidity of the day 🏆',
    podiumHook: 'Today\'s podium of dumb 🥇🥈🥉',
    moverHook: 'Biggest jump today 📈',
    why: 'Why',
    trendUp: 'up',
    full: 'Full scoreboard',
    disclaimer: '⚠️ 100% satire. We score decisions, never peoples.',
    tags: ['#Idiocracy', '#Satire', '#News', '#Geopolitics', '#WTF'],
  },
};
const S = STR[LANG] || STR.fr;

const worldLine = (s) => (s >= LINE ? S.over(s) : S.under(s));
const tagLine = (extra = []) => [...S.tags, ...extra].join(' ');
const sorted = [...data.countries].sort((a, b) => b.score - a.score);
const mover = [...data.countries].sort((a, b) => (b.trend || 0) - (a.trend || 0))[0];

// --- générateurs de posts ---------------------------------------------------
function postWorld() {
  const s = data.world.score;
  const head = T(data.world.headline);
  const x = `${worldLine(s)}\n\n${head}\n\n👉 ${SITE}\n\n${tagLine()}`;
  const ig =
    `${pick(S.worldHooks)}\n\n${worldLine(s)}\n\n${head}\n\n` +
    `${S.disclaimer}\n👉 ${URL}\n.\n.\n${tagLine(['#Monde', '#World'])}`;
  return { title: LANG === 'fr' ? 'Score mondial' : 'World score', x, ig };
}

function postSpotlight() {
  const sp = data.spotlight;
  const head = T(sp.headline);
  const why = T(sp.why);
  const flag = sp.flag || '';
  const x = `${S.spotlightHook}\n\n${flag} ${head}\n\n👉 ${SITE} ${tagLine()}`;
  const ig =
    `${S.spotlightHook}\n\n${flag} ${head}\n\n${S.why} : ${why}\n\n` +
    `${S.disclaimer}\n👉 ${URL}\n.\n.\n${tagLine(['#' + (sp.country || '').replace(/\s+/g, '')])}`;
  return { title: LANG === 'fr' ? 'Connerie du jour' : 'Stupidity of the day', x, ig };
}

function postPodium() {
  const top = sorted.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const lines = top.map((c, i) => `${medals[i]} ${c.flag} ${c.name} — ${c.score}/100`);
  const detail = top
    .map((c, i) => `${medals[i]} ${c.flag} ${c.name} (${c.score}/100)\n   ${T(c.headline)}`)
    .join('\n\n');
  const x = `${S.podiumHook}\n\n${lines.join('\n')}\n\n👉 ${SITE} ${tagLine()}`;
  const ig = `${S.podiumHook}\n\n${detail}\n\n${S.disclaimer}\n👉 ${URL}\n.\n.\n${tagLine()}`;
  return { title: LANG === 'fr' ? 'Podium' : 'Podium', x, ig };
}

function postMover() {
  if (!mover || (mover.trend || 0) <= 0) return null;
  const m = mover;
  const x =
    `${S.moverHook}\n\n${m.flag} ${m.name} +${m.trend} → ${m.score}/100 (${S.trendUp})\n\n` +
    `${T(m.headline)}\n\n👉 ${SITE} ${tagLine()}`;
  const ig =
    `${S.moverHook}\n\n${m.flag} ${m.name} : +${m.trend} aujourd'hui → ${m.score}/100\n\n` +
    `${T(m.headline)}\n\n${S.disclaimer}\n👉 ${URL}\n.\n.\n${tagLine()}`;
  return { title: LANG === 'fr' ? 'Plus forte hausse' : 'Biggest mover', x, ig };
}

const posts = [postWorld(), postSpotlight(), postPodium(), postMover()].filter(Boolean);

// --- rendu Markdown ---------------------------------------------------------
const charNote = (s) => `${s.length} car.`;
let md = `# Brouillons réseaux sociaux — ${date}\n\n`;
md += `> Généré par \`scripts/build-posts.mjs\` · langue : **${LANG.toUpperCase()}** · site : ${SITE}\n`;
md += `> Copie-colle l'angle qui te plaît. **Rien n'est publié automatiquement.**\n\n`;
md += `Score mondial du jour : **${data.world.score}/100** — ${data.world.score >= LINE ? `⚠️ au-dessus de la ligne des ${LINE}` : `sous la ligne des ${LINE}`}\n\n---\n\n`;

for (const p of posts) {
  md += `## ${p.title}\n\n`;
  md += `**X / Twitter / Threads** (${charNote(p.x)})\n\n\`\`\`\n${p.x}\n\`\`\`\n\n`;
  md += `**Instagram / Facebook / TikTok / LinkedIn**\n\n\`\`\`\n${p.ig}\n\`\`\`\n\n---\n\n`;
}

md += `_${S.disclaimer}_\n`;

// --- écriture ---------------------------------------------------------------
const OUT = join(ROOT, 'marketing', 'social');
mkdirSync(OUT, { recursive: true });
const dated = join(OUT, `posts-${date}-${LANG}.md`);
const latest = join(OUT, 'latest.md');
writeFileSync(dated, md);
writeFileSync(latest, md);

console.log(`✓ ${posts.length} angles générés (${LANG.toUpperCase()})`);
console.log(`✓ marketing/social/posts-${date}-${LANG}.md`);
console.log(`✓ marketing/social/latest.md`);
console.log(`\nAstuce : node scripts/build-posts.mjs --lang=en  pour la version anglaise.`);
