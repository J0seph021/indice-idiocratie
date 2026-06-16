#!/usr/bin/env node
/**
 * Publie AUTOMATIQUEMENT le post du jour sur Facebook (Page) et/ou Instagram,
 * via l'API Graph officielle de Meta — gratuit pour du contenu organique sur
 * TES propres comptes. Aucun service tiers (pas de Buffer).
 *
 * Lit marketing/social/latest.json (généré par build-posts.mjs) et publie
 * l'angle choisi (par défaut « Connerie du jour »), image + légende.
 *
 * --- Variables d'environnement (mettre en SECRETS GitHub Actions) -----------
 *   FB_PAGE_ID       ID numérique de ta Page Facebook            (requis FB)
 *   FB_PAGE_TOKEN    jeton d'accès longue durée de la Page       (requis FB)
 *   IG_USER_ID       ID du compte Instagram Business             (optionnel)
 *   IG_TOKEN         jeton avec instagram_content_publish        (optionnel,
 *                    défaut = FB_PAGE_TOKEN si la Page est reliée à l'IG)
 *   POST_ANGLE       spotlight | world | podium | mover  (défaut spotlight)
 *   POST_LANG        fr | en                              (défaut fr)
 *   DRY_RUN=1        n'appelle pas l'API, log seulement (sûr pour tester)
 *
 * Sans FB_PAGE_TOKEN, le script ne publie rien et sort proprement (code 0) :
 * la routine quotidienne ne casse pas tant que le jeton n'est pas configuré.
 *
 * Usage :  node scripts/publish-social.mjs            # publie (si jeton présent)
 *          DRY_RUN=1 node scripts/publish-social.mjs  # simulation
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRAPH = 'https://graph.facebook.com/v21.0';

const env = (k, d = '') => process.env[k] || d;
const ANGLE = env('POST_ANGLE', 'spotlight');
const LANG = env('POST_LANG', 'fr');
const DRY = env('DRY_RUN') === '1' || env('DRY_RUN') === 'true';

const FB_PAGE_ID = env('FB_PAGE_ID');
const FB_PAGE_TOKEN = env('FB_PAGE_TOKEN');
const IG_USER_ID = env('IG_USER_ID');
const IG_TOKEN = env('IG_TOKEN', FB_PAGE_TOKEN);

// --- charge le post du jour -------------------------------------------------
const jsonPath = join(ROOT, 'marketing', 'social', LANG === 'en' ? 'latest-en.json' : 'latest.json');
let day;
try {
  day = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  console.error(`✗ ${jsonPath} introuvable. Lance d'abord :  node scripts/build-posts.mjs --lang=${LANG}`);
  process.exit(1);
}
const post = day.posts.find((p) => p.key === ANGLE) || day.posts[0];
if (!post) { console.error('✗ Aucun post à publier.'); process.exit(1); }

console.log(`📅 ${day.date} · angle « ${post.title} » · ${LANG.toUpperCase()}`);
console.log(`🖼️  ${post.image_url}`);
console.log(`📝 ${post.caption.split('\n')[0]} …`);

// --- garde-fous -------------------------------------------------------------
if (DRY) {
  console.log('\n🧪 DRY_RUN — rien n’est publié. Légende complète :\n');
  console.log(post.caption);
  process.exit(0);
}
if (!FB_PAGE_TOKEN || !FB_PAGE_ID) {
  console.log('\nℹ️  FB_PAGE_ID / FB_PAGE_TOKEN absents → publication ignorée (configure les secrets pour activer).');
  process.exit(0);
}

// --- helpers Graph ----------------------------------------------------------
async function graph(path, form) {
  const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`Graph ${path} → ${res.status} ${JSON.stringify(data.error || data)}`);
  }
  return data;
}
const fileBlob = async () => {
  const buf = readFileSync(join(ROOT, post.image));
  return new Blob([buf], { type: 'image/png' });
};

// --- Facebook : upload des octets de l'image + légende ----------------------
async function postFacebook() {
  const form = new FormData();
  form.append('caption', post.caption);
  form.append('access_token', FB_PAGE_TOKEN);
  form.append('source', await fileBlob(), `${day.date}.png`);
  const r = await graph(`${FB_PAGE_ID}/photos`, form);
  console.log(`✅ Facebook publié — post_id=${r.post_id || r.id}`);
}

// --- Instagram : conteneur (image_url public) puis publication --------------
async function postInstagram() {
  const c = new FormData();
  c.append('image_url', post.image_url);
  c.append('caption', post.caption);
  c.append('access_token', IG_TOKEN);
  const created = await graph(`${IG_USER_ID}/media`, c);

  const pub = new FormData();
  pub.append('creation_id', created.id);
  pub.append('access_token', IG_TOKEN);
  const r = await graph(`${IG_USER_ID}/media_publish`, pub);
  console.log(`✅ Instagram publié — media_id=${r.id}`);
}

// --- run --------------------------------------------------------------------
let failed = false;
try { await postFacebook(); } catch (e) { failed = true; console.error(`✗ Facebook : ${e.message}`); }
if (IG_USER_ID) {
  try { await postInstagram(); } catch (e) { failed = true; console.error(`✗ Instagram : ${e.message}`); }
} else {
  console.log('ℹ️  IG_USER_ID absent → Instagram ignoré (optionnel).');
}
process.exit(failed ? 1 : 0);
