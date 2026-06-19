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
  const lineNote = score >= 69 ? 'We crossed the 69 line.' : 'Still under the 69 line.';

  // Lien profond vers la page du pays vedette (carte OG fraîche) ; sinon l'accueil.
  const cc = (data.countries || []).find((c) => c.name === country);
  const code = cc && cc.code ? cc.code.toLowerCase() : '';
  const link = code ? `https://idiocracies.com/c/${code}.html` : 'https://idiocracies.com';

  const countryTag = '#' + country.replace(/[^A-Za-z0-9]/g, '');
  const tags = `${countryTag} #Idiocracy #Satire`;

  // X (≤ 280) — PAS de lien dans le tweet : un lien externe écrase la portée
  // (−50 à −90 %). Le lien part en RÉPONSE (voir postToX). L'image native porte
  // le visuel ; le 1er vers est l'accroche. Filet final « … » dans postToX().
  const short = [
    `${scoreEmoji} Global Stupidity Index: ${score}/100. ${lineNote}`,
    ``,
    `Today's dumbest move — ${flag} ${country}:`,
    `"${headline}"`,
    ``,
    tags,
  ].join('\n');

  // Facebook / Instagram — légende longue. Sur FB le lien reste cliquable (post
  // photo natif) ; sur IG non → CTA « link in bio ».
  const long = [
    `${scoreEmoji} Global Stupidity Index: ${score}/100 — ${lineNote}`,
    ``,
    `📰 Today's Dumbest Move: ${flag} ${country}`,
    `"${headline}"`,
    ``,
    why,
    ``,
    `Full daily scoreboard 👉 idiocracies.com (link in bio)`,
    ``,
    `100% satire. We score decisions, never peoples.`,
    tags,
  ].join('\n');

  // Texte alternatif (accessibilité, ≤ 1000 pour X).
  const alt = `Editorial score card — The Idiocracy Index. Global stupidity score ${score} out of 100, ${lineNote} Today's dumbest move: ${country}. ${headline}`.slice(0, 990);

  return { short, long, link, alt };
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

Rewrite the two posts below so they sound like a real person wrote them — someone with a dark sense of humor, not a template. Keep all factual info (country, score, headline, the "100% satire" disclaimer). Keep emojis but place them naturally.
The SHORT version is for X/Twitter: it MUST stay under 270 characters and must NOT contain any URL or link (the link is posted separately as a reply). Keep the hashtags.
The LONG version is for Facebook & Instagram: keep the "link in bio / idiocracies.com" call to action.

SHORT VERSION (for X/Twitter, <270 chars, NO link):
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
    const m = text.match(/\{[\s\S]*\}/); // Claude encadre parfois le JSON dans ```json … ``` → on extrait l'objet.
    const parsed = JSON.parse(m ? m[0] : text);
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
  if (!repo) return { og: null, ig: null, carousel: [] };
  let ref = 'main';
  try {
    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    if (/^[0-9a-f]{7,40}$/.test(sha)) ref = sha;
  } catch { /* fallback sur main */ }
  const base = `https://raw.githubusercontent.com/${repo}/${ref}/assets`;
  return { og: `${base}/og.png`, ig: `${base}/ig.png`, carousel: [1, 2, 3].map((n) => `${base}/og/post-${n}.png`) };
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
async function postToX(message, imagePath, replyLink, altText) {
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
      // Texte alternatif (accessibilité) — best-effort, n'interrompt pas le post.
      if (altText) {
        try {
          const metaUrl = 'https://upload.twitter.com/1.1/media/metadata/create.json';
          const metaAuth = oauthSign('POST', metaUrl);
          await fetch(metaUrl, { method: 'POST', headers: { Authorization: metaAuth, 'Content-Type': 'application/json' }, body: JSON.stringify({ media_id: mediaId, alt_text: { text: String(altText).slice(0, 1000) } }) });
        } catch { /* alt text best-effort */ }
      }
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

  // Le lien part en RÉPONSE au tweet (un lien dans le post principal écrase la
  // portée sur X). Best-effort : un échec ici n'invalide pas le tweet publié.
  if (replyLink && json.data?.id) {
    try {
      const replyAuth = oauthSign('POST', tweetUrl);
      const rRes = await fetch(tweetUrl, {
        method: 'POST',
        headers: { Authorization: replyAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Full daily scoreboard 👉 ${replyLink}`, reply: { in_reply_to_tweet_id: json.data.id } }),
      });
      if (rRes.ok) console.log('✅ X — lien posté en réponse');
      else console.warn(`⚠️  Réponse-lien X refusée : ${JSON.stringify(await rRes.json())}`);
    } catch (e) { console.warn(`⚠️  Réponse-lien X échouée (${e.message}).`); }
  }
}

// ---------------------------------------------------------------------------
// INSTAGRAM (Instagram Business Account lié à la Page Facebook)
// ---------------------------------------------------------------------------
async function postToInstagram(message, carouselUrls, fallbackUrl) {
  const userId = process.env.INSTAGRAM_USER_ID;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!userId || !token) {
    console.log('⏭  Instagram : secrets manquants (INSTAGRAM_USER_ID / INSTAGRAM_ACCESS_TOKEN), skip.');
    return;
  }
  const slides = (carouselUrls || []).filter(Boolean);
  const single = fallbackUrl || slides[0];
  if (!slides.length && !single) {
    console.log('⏭  Instagram : pas d\'URL d\'image (GITHUB_REPOSITORY manquant ?), skip.');
    return;
  }
  if (DRY_RUN) { console.log(`🔵 [DRY] Instagram ${slides.length >= 2 ? 'carrousel ' + slides.length + ' slides' : 'post'} simulé.`); return; }

  const api = (path, body) => fetch(`https://graph.facebook.com/${userId}/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  });

  let creationId;
  if (slides.length >= 2) {
    // Carrousel : 1) un container par slide, 2) un container CAROUSEL, 3) publier.
    const children = [];
    for (const url of slides) {
      const r = await api('media', { image_url: url, is_carousel_item: true });
      const j = await r.json();
      if (!r.ok) throw new Error(`carousel item: ${JSON.stringify(j)}`);
      children.push(j.id);
    }
    const cr = await api('media', { media_type: 'CAROUSEL', children: children.join(','), caption: message });
    const cj = await cr.json();
    if (!cr.ok) throw new Error(`carousel container: ${JSON.stringify(cj)}`);
    creationId = cj.id;
  } else {
    const r = await api('media', { image_url: single, caption: message });
    const j = await r.json();
    if (!r.ok) throw new Error(`container: ${JSON.stringify(j)}`);
    creationId = j.id;
  }

  await sleep(8000); // Instagram met du temps à traiter le média

  const pubRes = await api('media_publish', { creation_id: creationId });
  const published = await pubRes.json();
  if (!pubRes.ok) throw new Error(`publish: ${JSON.stringify(published)}`);
  console.log(`✅ Instagram — ${slides.length >= 2 ? 'carrousel' : 'post'} id: ${published.id}`);
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
  const { og: ogUrl, ig: igUrl, carousel: carouselUrls } = getImageUrls();
  const ogPath = join(__dirname, '..', 'assets', 'og.png');

  console.log('── Message court (X) ──');
  console.log(short);
  console.log(`\n── Message long (FB/Insta) ──`);
  console.log(long);
  console.log(`\n── OG image ──\n${ogUrl || '(aucune — GITHUB_REPOSITORY non défini)'}`);
  console.log(`── IG image ──\n${igUrl || '(aucune — GITHUB_REPOSITORY non défini)'}\n`);

  const tasks = [];
  if (PLATFORM === 'all' || PLATFORM === 'facebook')  tasks.push(postToFacebook(long, igUrl || ogUrl));
  if (PLATFORM === 'all' || PLATFORM === 'x')         tasks.push(postToX(short, ogPath, raw.link, raw.alt));
  if (PLATFORM === 'all' || PLATFORM === 'instagram') tasks.push(postToInstagram(long, carouselUrls, igUrl));

  const results = await Promise.allSettled(tasks);

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length) {
    for (const e of errors) console.error('❌', e.reason?.message || e.reason);
    process.exit(1);
  }
}

main().catch(e => { console.error('💥', e); process.exit(1); });
