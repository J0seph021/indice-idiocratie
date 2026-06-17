#!/usr/bin/env node
/**
 * Publie la mise à jour quotidienne de l'Indice d'Idiocratie
 * sur Facebook Page, Threads et Instagram.
 *
 * Variables d'environnement requises (GitHub Secrets) :
 *   META_PAGE_ID              — ID de la page Facebook ("1114398978432645")
 *   META_PAGE_ACCESS_TOKEN    — Page Access Token (Graph API)
 *   X_API_KEY                 — X (Twitter) API Key
 *   X_API_SECRET              — X (Twitter) API Secret
 *   X_ACCESS_TOKEN            — X (Twitter) Access Token
 *   X_ACCESS_SECRET           — X (Twitter) Access Token Secret
 *   INSTAGRAM_USER_ID         — ID du compte Instagram Business
 *   INSTAGRAM_ACCESS_TOKEN    — Instagram Access Token
 *   ANTHROPIC_API_KEY         — Pour humaniser le texte avant publication (optionnel)
 *
 * Usage : node scripts/post-social.mjs
 * Test  : DRY_RUN=1 node scripts/post-social.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'scores.json');

const DRY_RUN = process.env.DRY_RUN === '1';
const PLATFORM = (process.env.TEST_PLATFORM || 'all').toLowerCase();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pickEn = (v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? v.en || Object.values(v)[0] || ''
    : v || '';

// ---------------------------------------------------------------------------
// Compose le texte du post (≤ 500 chars pour Threads)
// ---------------------------------------------------------------------------
function buildPost(data) {
  const score = data.world?.score ?? 0;
  const spot = data.spotlight || {};
  const flag = spot.flag || '';
  const country = spot.country || '';
  const headline = pickEn(spot.headline) || '';
  const why = pickEn(spot.why) || '';

  const scoreEmoji = score >= 69 ? '🔴' : score >= 50 ? '🟠' : '🟡';

  // Hashtags pour X
  const countryTag = '#' + country.replace(/\s+/g, '');
  const hashtags = `${countryTag} #Satire #Politics #Idiocracy`;

  // Version courte (≤ 280 chars pour X)
  const short = [
    `${scoreEmoji} Stupidity Score: ${score}/100`,
    ``,
    `${flag} ${country}: "${headline.slice(0, 100)}${headline.length > 100 ? '…' : ''}"`,
    ``,
    `idiocracies.com`,
    ``,
    hashtags,
  ].join('\n');

  // Version longue pour Facebook / Instagram (pas de limite stricte)
  const long = [
    `${scoreEmoji} Global Stupidity Score: ${score}/100`,
    ``,
    `${flag} Today's Dumbest Move: ${country}`,
    `"${headline}"`,
    ``,
    why,
    ``,
    `100% satire. Updated daily.`,
    `🌍 idiocracies.com`,
  ].join('\n');

  return { short, long };
}

// ---------------------------------------------------------------------------
// Humanise les posts via Claude — sonne moins robot, garde le ton satirique
// ---------------------------------------------------------------------------
async function humanizePost(short, long, context) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.log('ℹ️  ANTHROPIC_API_KEY absent → texte original conservé.');
    return { short, long };
  }

  const prompt = `You write social media posts for "Idiocracy Index" (idiocracies.com), a satirical site that scores countries on how dumb their leaders' decisions are. The tone is dry, witty, slightly deadpan — like a news anchor who's quietly given up on humanity but still shows up.

Today's context:
- Country spotlight: ${context.country} ${context.flag} (score: ${context.score}/100)
- Headline: "${context.headline}"
- Why: "${context.why}"

Rewrite the two posts below so they sound like a real person wrote them — someone with a dark sense of humor, not a template. Keep all factual info (country, score, headline, the link idiocracies.com, the "100% satire" disclaimer). Keep emojis but place them naturally. The short version must stay under 500 characters.

SHORT VERSION (for Threads, ≤500 chars):
${short}

LONG VERSION (for Facebook & Instagram):
${long}

Respond with ONLY a JSON object, no markdown, no explanation:
{"short": "...", "long": "..."}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data.error));
    const text = data.content?.[0]?.text?.trim() || '';
    const parsed = JSON.parse(text);
    if (parsed.short && parsed.long) {
      console.log('✨ Posts humanisés via Claude.');
      return parsed;
    }
  } catch (e) {
    console.warn(`⚠️  Humanisation échouée (${e.message}) → texte original conservé.`);
  }
  return { short, long };
}

// URLs publiques des images (disponibles après le git push du workflow).
// IMPORTANT : on épingle l'URL au SHA du commit courant, PAS à `main`.
// `raw.githubusercontent.com/.../main/assets/ig.png` est servi par un CDN qui
// cache ~5 min, et l'URL est identique chaque jour : Instagram récupère alors
// la version périmée de la veille pile pendant la fenêtre de cache. Une URL au
// SHA n'a jamais été vue par le CDN → toujours fraîche, jamais de course.
// (On lit HEAD localement, pas GITHUB_SHA qui pointe sur le commit parent du bot.)
function getImageUrls() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return { og: null, ig: null };
  let ref = 'main';
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    if (/^[0-9a-f]{7,40}$/.test(sha)) ref = sha;
  } catch { /* fallback sur main */ }
  const base = `https://raw.githubusercontent.com/${repo}/${ref}/assets`;
  return { og: `${base}/og.png`, ig: `${base}/ig.png` };
}

// ---------------------------------------------------------------------------
// FACEBOOK PAGE
// ---------------------------------------------------------------------------
async function postToFacebook(message, imageUrl) {
  const pageId = process.env.META_PAGE_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) {
    console.log('⏭  Facebook : secrets manquants (META_PAGE_ID / META_PAGE_ACCESS_TOKEN), skip.');
    return;
  }

  if (DRY_RUN) { console.log('🔵 [DRY] Facebook post simulé.'); return; }

  // On poste l'IMAGE directement (/photos) plutôt qu'un lien. Avec /feed + link,
  // FB scrape og:image de l'URL constante idiocracies.com et garde ce cache des
  // jours : il ressert l'image périmée de la veille. /photos + URL épinglée au
  // SHA → FB récupère exactement l'image du jour. Le lien reste dans la légende.
  // Sans URL d'image (GITHUB_REPOSITORY absent), on retombe sur un post texte.
  const url = imageUrl
    ? `https://graph.facebook.com/${pageId}/photos`
    : `https://graph.facebook.com/${pageId}/feed`;
  const body = imageUrl
    ? { url: imageUrl, caption: message, access_token: token }
    : { message, access_token: token };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  console.log(`✅ Facebook — post id: ${json.id || json.post_id}`);
}

// ---------------------------------------------------------------------------
// X (Twitter) — OAuth 1.0a + API v2
// ---------------------------------------------------------------------------
async function postToX(message, imagePath) {
  const apiKey       = process.env.X_API_KEY;
  const apiSecret    = process.env.X_API_SECRET;
  const accessToken  = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.log('⏭  X : secrets manquants (X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET), skip.');
    return;
  }

  if (DRY_RUN) { console.log('🔵 [DRY] X post simulé.'); return; }

  const { createHmac } = await import('node:crypto');
  const enc = s => encodeURIComponent(s);

  function oauthSign(method, url, extraParams = {}) {
    const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const ts = Math.floor(Date.now() / 1000).toString();
    const base = {
      oauth_consumer_key: apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: ts,
      oauth_token: accessToken,
      oauth_version: '1.0',
    };
    const all = { ...base, ...extraParams };
    const paramStr = Object.keys(all).sort().map(k => `${enc(k)}=${enc(all[k])}`).join('&');
    const baseStr = `${method}&${enc(url)}&${enc(paramStr)}`;
    const sigKey = `${enc(apiSecret)}&${enc(accessSecret)}`;
    const sig = createHmac('sha1', sigKey).update(baseStr).digest('base64');
    return 'OAuth ' + Object.entries({ ...base, oauth_signature: sig })
      .map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ');
  }

  // Upload image (API v1.1 media/upload) en multipart/form-data.
  // Pourquoi multipart : avec x-www-form-urlencoded, les paramètres du corps
  // (media_data, media_category) DOIVENT être inclus dans la base de signature
  // OAuth, sinon X rejette avec « code 32 — Could not authenticate you ». En
  // multipart, le corps binaire n'entre PAS dans la signature → l'auth est
  // calculée sur les seuls params OAuth, c'est plus simple et fiable.
  let mediaId = null;
  if (imagePath) {
    try {
      const imgBuf = readFileSync(imagePath);
      const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
      const auth = oauthSign('POST', uploadUrl);
      const boundary = '----IdiocracyBoundary' + Math.random().toString(36).slice(2);
      const CRLF = '\r\n';
      const head = Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="media"; filename="og.png"${CRLF}` +
        `Content-Type: image/png${CRLF}${CRLF}`
      );
      const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
      const body = Buffer.concat([head, imgBuf, tail]);
      const upRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body,
      });
      const upJson = await upRes.json();
      if (!upRes.ok) throw new Error(JSON.stringify(upJson));
      mediaId = upJson.media_id_string;
      console.log(`🖼️  X media uploadé — id: ${mediaId}`);
    } catch (e) {
      console.warn(`⚠️  Upload image X échoué (${e.message}) → tweet sans image.`);
    }
  }

  // Publier le tweet (API v2)
  const tweetUrl = 'https://api.twitter.com/2/tweets';
  const auth = oauthSign('POST', tweetUrl);
  const txt = message.length > 280 ? message.slice(0, 277) + '…' : message;
  const body = { text: txt };
  if (mediaId) body.media = { media_ids: [mediaId] };

  const res = await fetch(tweetUrl, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  console.log(`✅ X — tweet id: ${json.data?.id}`);
}

// ---------------------------------------------------------------------------
// INSTAGRAM (Instagram Business Account lié à la Page Facebook)
// ---------------------------------------------------------------------------
async function postToInstagram(message, imageUrl) {
  const userId = process.env.INSTAGRAM_USER_ID;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!userId || !token) {
    console.log('⏭  Instagram : secrets manquants (INSTAGRAM_USER_ID / INSTAGRAM_ACCESS_TOKEN), skip.');
    return;
  }
  if (!imageUrl) {
    console.log('⏭  Instagram : pas d\'URL d\'image (GITHUB_REPOSITORY manquant ?), skip.');
    return;
  }

  if (DRY_RUN) { console.log('🔵 [DRY] Instagram post simulé.'); return; }

  // Étape 1 — créer le container média
  const containerRes = await fetch(`https://graph.facebook.com/${userId}/media`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption: message, access_token: token }),
  });
  const container = await containerRes.json();
  if (!containerRes.ok) throw new Error(`container: ${JSON.stringify(container)}`);

  await sleep(8000); // Instagram prend plus de temps à traiter l'image

  // Étape 2 — publier
  const pubRes = await fetch(`https://graph.facebook.com/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const published = await pubRes.json();
  if (!pubRes.ok) throw new Error(`publish: ${JSON.stringify(published)}`);
  console.log(`✅ Instagram — post id: ${published.id}`);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log(`📱 Publication sur les réseaux sociaux${DRY_RUN ? ' [DRY RUN]' : ''}…\n`);

  const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const raw = buildPost(data);
  const spot = data.spotlight || {};
  const { short, long } = await humanizePost(raw.short, raw.long, {
    country: spot.country || '',
    flag: spot.flag || '',
    score: data.world?.score ?? 0,
    headline: pickEn(spot.headline) || '',
    why: pickEn(spot.why) || '',
  });
  const { og: ogUrl, ig: igUrl } = getImageUrls();
  const ogPath = join(__dirname, '..', 'assets', 'og.png');

  console.log('── Message court (X) ──');
  console.log(short);
  console.log(`\n── Message long (FB/Insta) ──`);
  console.log(long);
  console.log(`\n── OG image ──\n${ogUrl || '(aucune — GITHUB_REPOSITORY non défini)'}`);
  console.log(`── IG image ──\n${igUrl || '(aucune — GITHUB_REPOSITORY non défini)'}\n`);

  const tasks = [];
  if (PLATFORM === 'all' || PLATFORM === 'facebook')  tasks.push(postToFacebook(long, ogUrl));
  if (PLATFORM === 'all' || PLATFORM === 'x')         tasks.push(postToX(short, ogPath));
  if (PLATFORM === 'all' || PLATFORM === 'instagram') tasks.push(postToInstagram(long, igUrl));

  const results = await Promise.allSettled(tasks);

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length) {
    for (const e of errors) console.error('❌', e.reason?.message || e.reason);
    process.exit(1);
  }
}

main().catch(e => { console.error('💥', e); process.exit(1); });
