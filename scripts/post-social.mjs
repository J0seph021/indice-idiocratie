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

  // Version courte (≤ 500 chars) pour Threads
  const short = [
    `${scoreEmoji} Stupidity Score: ${score}/100`,
    ``,
    `${flag} ${country}: "${headline.slice(0, 120)}${headline.length > 120 ? '…' : ''}"`,
    ``,
    `${why.slice(0, 100)}${why.length > 100 ? '…' : ''}`,
    ``,
    `100% satire · idiocracies.com`,
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

// URL publique de og.png (disponible après le git push du workflow)
function getImageUrl() {
  const repo = process.env.GITHUB_REPOSITORY; // fourni automatiquement par GitHub Actions
  if (!repo) return null;
  return `https://raw.githubusercontent.com/${repo}/main/assets/og.png`;
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

  // On poste texte + lien (l'aperçu og.png s'affiche automatiquement via les balises Open Graph)
  const url = `https://graph.facebook.com/${pageId}/feed`;
  const body = {
    message,
    link: 'https://idiocracies.com',
    access_token: token,
  };

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
async function postToX(message) {
  const apiKey        = process.env.X_API_KEY;
  const apiSecret     = process.env.X_API_SECRET;
  const accessToken   = process.env.X_ACCESS_TOKEN;
  const accessSecret  = process.env.X_ACCESS_SECRET;
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.log('⏭  X : secrets manquants (X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET), skip.');
    return;
  }

  if (DRY_RUN) { console.log('🔵 [DRY] X post simulé.'); return; }

  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';

  // OAuth 1.0a signature
  const { createHmac } = await import('node:crypto');
  const enc = s => encodeURIComponent(s);
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const ts = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams };
  const paramStr = Object.keys(allParams).sort()
    .map(k => `${enc(k)}=${enc(allParams[k])}`).join('&');
  const baseStr = `${method}&${enc(url)}&${enc(paramStr)}`;
  const sigKey = `${enc(apiSecret)}&${enc(accessSecret)}`;
  const sig = createHmac('sha1', sigKey).update(baseStr).digest('base64');

  const authHeader = 'OAuth ' + Object.entries({ ...oauthParams, oauth_signature: sig })
    .map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ');

  // Truncate to 280 chars
  const text = message.length > 280 ? message.slice(0, 277) + '…' : message;

  const res = await fetch(url, {
    method,
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
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
  const imageUrl = getImageUrl();

  console.log('── Message court (X) ──');
  console.log(short);
  console.log(`\n── Message long (FB/Insta) ──`);
  console.log(long);
  console.log(`\n── Image URL ──\n${imageUrl || '(aucune — GITHUB_REPOSITORY non défini)'}\n`);

  const tasks = [];
  if (PLATFORM === 'all' || PLATFORM === 'facebook')  tasks.push(postToFacebook(long, imageUrl));
  if (PLATFORM === 'all' || PLATFORM === 'x')         tasks.push(postToX(short));
  if (PLATFORM === 'all' || PLATFORM === 'instagram') tasks.push(postToInstagram(long, imageUrl));

  const results = await Promise.allSettled(tasks);

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length) {
    for (const e of errors) console.error('❌', e.reason?.message || e.reason);
    process.exit(1);
  }
}

main().catch(e => { console.error('💥', e); process.exit(1); });
