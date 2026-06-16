#!/usr/bin/env node
/**
 * Génère des BROUILLONS de posts réseaux sociaux à partir de data/scores.json.
 *   → marketing/social/posts-AAAA-MM-JJ-LANG.md   (texte, daté)
 *   → marketing/social/latest.md                  (toujours le plus récent)
 *   → marketing/social/img/*.png                  (images du jour, prêtes à joindre)
 *
 * Recette marketing : Accroche → vraie actu sourcée → punchline → image → CTA.
 * On cite les vrais articles (titre + source) de data/scores.json : la satire
 * frappe plus fort quand c'est VRAI ("oui, source : CNN"). Chaque post indique
 * quelle carte image joindre (assets/og/<code>.png).
 *
 * Le dossier marketing/ est gitignoré : brouillons privés, à copier-coller.
 * Rien n'est publié automatiquement.
 *
 * Usage : node scripts/build-posts.mjs [--lang=fr|en]   ·   npm run posts
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'idiocracies.com';
const URL = 'https://idiocracies.com';
const LINE = 69;

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};
const LANG = (arg('lang', 'fr') || 'fr').toLowerCase();

const data = JSON.parse(readFileSync(join(ROOT, 'data', 'scores.json'), 'utf8'));
const date = data.updated || new Date().toISOString().slice(0, 10);
const T = (o) => (o && (o[LANG] || o.en || o.fr)) || '';

// PRNG ensemencé par la date : varie chaque jour, stable si on relance.
let seed = [...date].reduce((a, c) => a + c.charCodeAt(0), 7);
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// --- vocabulaire & punchlines ----------------------------------------------
const STR = {
  fr: {
    worldHooks: ["Indice d'Idiocratie, bulletin du jour 🧠💀", 'Le QI de la planète aujourd’hui :', 'Score mondial de connerie civilisationnelle :'],
    spotHook: 'La connerie du jour 🏆', podiumHook: 'Le podium de la bêtise du jour 🥇🥈🥉', moverHook: 'Plus forte hausse du jour 📈',
    real: 'Oui, c’est réel', realNews: 'Ce qui a fait grimper le score (vraies sources) :', source: 'source',
    rank: (n) => `n°${n} des plus cons aujourd’hui`, over: `on a franchi la ligne des ${LINE}.`, under: `encore sous la ligne des ${LINE}.`,
    attach: 'Image à joindre', disclaimer: '⚠️ 100 % satire. On note des décisions, jamais des peuples.',
    tags: ['#Idiocratie', '#Idiocracy', '#Satire', '#Actu', '#Géopolitique'],
    kick: {
      hi: ['À ce stade ce n’est plus un pays, c’est un épisode pilote.', 'La science a été prévenue. Elle n’est pas venue.', 'On a vérifié trois fois : ce n’est pas un sketch.'],
      mid: ['Le futur appelle, personne ne décroche.', 'Brawndo approuve ce message.', 'On gouverne au mème, on récolte au facepalm.'],
      low: ['Encore à peu près fréquentable. Profitez-en.', 'Des signes d’intelligence ont été détectés. Enquête en cours.', 'Étonnamment raisonnable — méfiance.'],
    },
  },
  en: {
    worldHooks: ['The Idiocracy Index — today’s bulletin 🧠💀', 'The planet’s IQ today:', 'World civilizational-stupidity score:'],
    spotHook: 'Stupidity of the day 🏆', podiumHook: 'Today’s podium of dumb 🥇🥈🥉', moverHook: 'Biggest jump today 📈',
    real: 'Yes, this is real', realNews: 'What pushed the score up (real sources):', source: 'source',
    rank: (n) => `#${n} dumbest today`, over: `we crossed the ${LINE} line.`, under: `still under the ${LINE} line.`,
    attach: 'Image to attach', disclaimer: '⚠️ 100% satire. We score decisions, never peoples.',
    tags: ['#Idiocracy', '#Satire', '#News', '#Geopolitics', '#WTF'],
    kick: {
      hi: ['At this point it’s not a country, it’s a pilot episode.', 'Science was warned. Science did not show up.', 'We checked three times: not a sketch.'],
      mid: ['The future is calling. Nobody’s picking up.', 'Brawndo approves this message.', 'Govern by meme, harvest the facepalm.'],
      low: ['Still mostly presentable. Enjoy it.', 'Signs of intelligence detected. Investigation ongoing.', 'Suspiciously reasonable — stay alert.'],
    },
  },
};
const S = STR[LANG] || STR.fr;
const tagLine = (extra = []) => [...S.tags, ...extra].join(' ');
const kicker = (sc) => pick(sc >= 85 ? S.kick.hi : sc >= LINE ? S.kick.mid : S.kick.low);
const lineWord = (sc) => (sc >= LINE ? S.over : S.under);

const sorted = [...data.countries].sort((a, b) => b.score - a.score);
const byName = (name) => data.countries.find((c) => c.name === name);
const code = (c) => (c && c.code ? c.code.toLowerCase() : null);
const articlesOf = (c) => [...((c && c.articles) || [])].sort((a, b) => (b.impact || 0) - (a.impact || 0));
const imgFor = (c) => (code(c) ? `assets/og/${code(c)}.png` : 'assets/og.png');
const newsLines = (c, n = 2) => articlesOf(c).filter((a) => (a.impact || 0) >= 0).slice(0, n)
  .map((a) => `• ${T(a.title)} (${a.source})`).join('\n');

// X/Twitter ≤ 280 : on assemble et on coupe le superflu si ça déborde.
function fitX(parts, tags) {
  for (let drop = 0; drop <= 2; drop++) {
    const body = parts.slice(0, parts.length - drop).filter(Boolean).join('\n\n');
    const txt = `${body}\n\n👉 ${SITE} ${tags}`;
    if (txt.length <= 280) return txt;
  }
  const body = parts.slice(0, 2).filter(Boolean).join('\n\n');
  return `${body}\n\n👉 ${SITE}`.slice(0, 277).replace(/\s+\S*$/, '') + '…';
}

// --- générateurs ------------------------------------------------------------
function postSpotlight() {
  const sp = data.spotlight, c = byName(sp.country);
  const sc = sp.score ?? (c && c.score) ?? data.world.score;
  const head = T(sp.headline), flag = sp.flag || (c && c.flag) || '';
  const news = newsLines(c, 2), kick = kicker(sc);
  const x = fitX([`${S.spotHook}`, `${flag} ${head}`, `📰 ${S.real}.`, kick], tagLine());
  const ig =
    `${S.spotHook} — ${date}\n\n${flag} ${(sp.country || '').toUpperCase()} : ${sc}/100\n\n« ${head} »\n\n` +
    (news ? `📰 ${S.realNews}\n${news}\n\n` : '') +
    `${kick}\n\n${S.disclaimer}\n👉 ${URL}\n.\n.\n${tagLine(['#' + (sp.country || '').replace(/\s+/g, '')])}`;
  return { title: LANG === 'fr' ? 'Connerie du jour ⭐' : 'Stupidity of the day ⭐', img: imgFor(c), x, ig };
}

function postWorld() {
  const sc = data.world.score, head = T(data.world.headline);
  const x = fitX([pick(S.worldHooks), `${sc}/100 — ${lineWord(sc)}`, head, kicker(sc)], tagLine());
  const ig =
    `${pick(S.worldHooks)}\n\n🌍 ${sc}/100 — ${lineWord(sc)}\n\n${head}\n\n${kicker(sc)}\n\n` +
    `${S.disclaimer}\n👉 ${URL}\n.\n.\n${tagLine(['#Monde', '#World'])}`;
  return { title: LANG === 'fr' ? 'Score mondial' : 'World score', img: 'assets/og.png', x, ig };
}

function postPodium() {
  const top = sorted.slice(0, 3), medals = ['🥇', '🥈', '🥉'];
  const short = top.map((c, i) => `${medals[i]} ${c.flag} ${c.name} — ${c.score}/100`).join('\n');
  const long = top.map((c, i) => {
    const a = articlesOf(c).find((x) => (x.impact || 0) >= 0);
    return `${medals[i]} ${c.flag} ${c.name} (${c.score}/100)\n   « ${T(c.headline)} »` + (a ? `\n   📰 ${a.source}` : '');
  }).join('\n\n');
  const x = fitX([S.podiumHook, short], tagLine());
  const ig = `${S.podiumHook} — ${date}\n\n${long}\n\n${S.disclaimer}\n👉 ${URL}\n.\n.\n${tagLine()}`;
  return { title: LANG === 'fr' ? 'Podium' : 'Podium', img: imgFor(top[0]), x, ig };
}

function postMover() {
  const m = [...data.countries].sort((a, b) => (b.trend || 0) - (a.trend || 0))[0];
  if (!m || (m.trend || 0) <= 0) return null;
  const a = articlesOf(m).find((x) => (x.impact || 0) >= 0);
  const x = fitX([S.moverHook, `${m.flag} ${m.name} +${m.trend} → ${m.score}/100`, `« ${T(m.headline)} »`, kicker(m.score)], tagLine());
  const ig =
    `${S.moverHook} — ${date}\n\n${m.flag} ${m.name} : +${m.trend} aujourd’hui → ${m.score}/100\n\n« ${T(m.headline)} »\n\n` +
    (a ? `📰 ${S.real} (${a.source}).\n\n` : '') + `${kicker(m.score)}\n\n${S.disclaimer}\n👉 ${URL}\n.\n.\n${tagLine()}`;
  return { title: LANG === 'fr' ? 'Plus forte hausse' : 'Biggest mover', img: imgFor(m), x, ig };
}

const KEYS = ['spotlight', 'world', 'podium', 'mover'];
const posts = [postSpotlight(), postWorld(), postPodium(), postMover()]
  .map((p, i) => (p ? { key: KEYS[i], ...p } : null))
  .filter(Boolean);

// --- copie des images du jour dans le bundle de brouillons ------------------
const OUT = join(ROOT, 'marketing', 'social');
const IMGDIR = join(OUT, 'img');
mkdirSync(IMGDIR, { recursive: true });
const copied = new Set();
for (const p of posts) {
  const src = join(ROOT, p.img);
  const base = p.img.split('/').pop();
  if (existsSync(src) && !copied.has(base)) { copyFileSync(src, join(IMGDIR, base)); copied.add(base); }
}

// --- rendu Markdown ---------------------------------------------------------
let md = `# Brouillons réseaux sociaux — ${date}\n\n`;
md += `> \`scripts/build-posts.mjs\` · ${LANG.toUpperCase()} · ${SITE} · **rien n’est publié automatiquement.**\n`;
md += `> Recette : accroche → vraie actu sourcée → punchline → **image jointe** → lien.\n`;
md += `> Les images du jour sont copiées dans \`marketing/social/img/\`.\n\n`;
md += `Monde : **${data.world.score}/100** — ${data.world.score >= LINE ? `⚠️ au-dessus de la ligne des ${LINE}` : `sous la ligne des ${LINE}`}\n\n---\n\n`;
for (const p of posts) {
  md += `## ${p.title}\n\n`;
  md += `🖼️ **${S.attach} :** \`marketing/social/img/${p.img.split('/').pop()}\`\n\n`;
  md += `**X / Twitter / Threads** (${p.x.length} car.)\n\n\`\`\`\n${p.x}\n\`\`\`\n\n`;
  md += `**Instagram / Facebook / LinkedIn / TikTok** (texte + image ci-dessus)\n\n\`\`\`\n${p.ig}\n\`\`\`\n\n---\n\n`;
}
md += `_${S.disclaimer}_\n`;

writeFileSync(join(OUT, `posts-${date}-${LANG}.md`), md);
writeFileSync(join(OUT, 'latest.md'), md);

// Sortie machine pour l'auto-publication (scripts/publish-social.mjs).
const json = {
  date, lang: LANG, site: SITE,
  posts: posts.map((p) => ({
    key: p.key, title: p.title,
    image: p.img,                              // chemin local servi par le site
    image_url: `${URL}/${p.img}`,              // URL publique (requise par Instagram)
    caption: p.ig,                             // légende longue (FB/IG)
    tweet: p.x,                                // version courte (X)
  })),
};
writeFileSync(join(OUT, `latest-${LANG}.json`), JSON.stringify(json, null, 2));
if (LANG === 'fr') writeFileSync(join(OUT, 'latest.json'), JSON.stringify(json, null, 2));

console.log(`✓ ${posts.length} angles (${LANG.toUpperCase()}) avec vraies actus + punchlines`);
console.log(`✓ ${copied.size} image(s) du jour → marketing/social/img/`);
console.log(`✓ marketing/social/latest.md`);
console.log(`\nAstuce : node scripts/build-posts.mjs --lang=en  pour la version anglaise.`);
