#!/usr/bin/env node
/**
 * Publie AUTOMATIQUEMENT le tweet du jour sur X (Twitter), via l'API v2 et le
 * palier GRATUIT (write-only, ~1 500 posts/mois — 1/jour reste très en dessous).
 *
 * Pas d'upload média : le tweet contient le lien profond vers la page du pays,
 * et X affiche l'image via la carte de prévisualisation (balises OG du site).
 * Ça évite l'API média v1.1 (capricieuse hors palier payant) → 100 % gratuit.
 *
 * Auth : OAuth 1.0a (contexte utilisateur), signé en HMAC-SHA1, sans dépendance.
 *
 * --- Secrets (GitHub Actions) -----------------------------------------------
 *   X_API_KEY        API Key (consumer key)        de ton app X
 *   X_API_SECRET     API Key Secret (consumer)     de ton app X
 *   X_ACCESS_TOKEN   Access Token         (du compte qui poste)
 *   X_ACCESS_SECRET  Access Token Secret  (du compte qui poste)
 *   POST_ANGLE       spotlight | world | podium | mover  (défaut spotlight)
 *   POST_LANG        fr | en                              (défaut fr)
 *   DRY_RUN=1        n'appelle pas l'API, log seulement
 *
 * Sans les 4 clés, le script sort proprement (code 0) sans rien publier.
 * Usage :  node scripts/publish-x.mjs   ·   DRY_RUN=1 node scripts/publish-x.mjs
 */
import { readFileSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://api.twitter.com/2/tweets';

const env = (k, d = '') => process.env[k] || d;
const ANGLE = env('POST_ANGLE', 'spotlight');
const LANG = env('POST_LANG', 'fr');
const DRY = env('DRY_RUN') === '1' || env('DRY_RUN') === 'true';

const KEY = env('X_API_KEY'), SECRET = env('X_API_SECRET');
const TOKEN = env('X_ACCESS_TOKEN'), TOKEN_SECRET = env('X_ACCESS_SECRET');

// --- charge le tweet du jour ------------------------------------------------
const jsonPath = join(ROOT, 'marketing', 'social', LANG === 'en' ? 'latest-en.json' : 'latest.json');
let day;
try {
  day = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  console.error(`✗ ${jsonPath} introuvable. Lance d'abord :  node scripts/build-posts.mjs --lang=${LANG}`);
  process.exit(1);
}
const post = day.posts.find((p) => p.key === ANGLE) || day.posts[0];
const text = post.tweet;
console.log(`📅 ${day.date} · angle « ${post.title} » · ${LANG.toUpperCase()} · ${text.length} car.`);

if (DRY) {
  console.log('\n🧪 DRY_RUN — rien n’est publié. Tweet :\n');
  console.log(text);
  process.exit(0);
}
if (!KEY || !SECRET || !TOKEN || !TOKEN_SECRET) {
  console.log('\nℹ️  Clés X absentes → publication ignorée (configure les 4 secrets pour activer).');
  process.exit(0);
}

// --- OAuth 1.0a -------------------------------------------------------------
const enc = (s) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function authHeader(method, url) {
  const oauth = {
    oauth_consumer_key: KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: TOKEN,
    oauth_version: '1.0',
  };
  // Corps JSON : non inclus dans la signature (seuls les paramètres oauth_*).
  const paramStr = Object.keys(oauth).sort().map((k) => `${enc(k)}=${enc(oauth[k])}`).join('&');
  const base = `${method}&${enc(url)}&${enc(paramStr)}`;
  const signingKey = `${enc(SECRET)}&${enc(TOKEN_SECRET)}`;
  oauth.oauth_signature = createHmac('sha1', signingKey).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

// --- publication ------------------------------------------------------------
try {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: authHeader('POST', ENDPOINT), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors || data.error) {
    throw new Error(`${res.status} ${JSON.stringify(data.errors || data.detail || data)}`);
  }
  console.log(`✅ X publié — tweet id=${data.data?.id}`);
} catch (e) {
  console.error(`✗ X : ${e.message}`);
  process.exit(1);
}
