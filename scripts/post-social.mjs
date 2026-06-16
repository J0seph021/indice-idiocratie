#!/usr/bin/env node
/**
 * Publie la mise à jour quotidienne de l'Indice d'Idiocratie
 * sur Facebook Page, Threads et Instagram.
 *
 * Variables d'environnement requises (GitHub Secrets) :
 *   META_PAGE_ID              — ID de la page Facebook ("1114398978432645")
 *   META_PAGE_ACCESS_TOKEN    — Page Access Token (Graph API)
 *   THREADS_USER_ID           — ID utilisateur Threads
 *   THREADS_USER_TOKEN        — Threads Access Token
 *   INSTAGRAM_USER_ID         — ID du compte Instagram Business
 *   INSTAGRAM_ACCESS_TOKEN    — Instagram Access Token
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
// THREADS
// ---------------------------------------------------------------------------
async function postToThreads(message, imageUrl) {
  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_USER_TOKEN;
  if (!userId || !token) {
    console.log('⏭  Threads : secrets manquants (THREADS_USER_ID / THREADS_USER_TOKEN), skip.');
    return;
  }

  if (DRY_RUN) { console.log('🔵 [DRY] Threads post simulé.'); return; }

  // Étape 1 — créer le container
  const containerBody = imageUrl
    ? { media_type: 'IMAGE', image_url: imageUrl, text: message, access_token: token }
    : { media_type: 'TEXT', text: message, access_token: token };

  const containerRes = await fetch(`https://graph.threads.net/${userId}/threads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(containerBody),
  });
  const container = await containerRes.json();
  if (!containerRes.ok) throw new Error(`container: ${JSON.stringify(container)}`);

  await sleep(3000); // attendre que le container soit traité

  // Étape 2 — publier
  const pubRes = await fetch(`https://graph.threads.net/${userId}/threads_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const published = await pubRes.json();
  if (!pubRes.ok) throw new Error(`publish: ${JSON.stringify(published)}`);
  console.log(`✅ Threads — post id: ${published.id}`);
}

// ---------------------------------------------------------------------------
// INSTAGRAM (compte Business relié à la Page Facebook)
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
  const { short, long } = buildPost(data);
  const imageUrl = getImageUrl();

  console.log('── Message court (Threads) ──');
  console.log(short);
  console.log(`\n── Message long (FB/Insta) ──`);
  console.log(long);
  console.log(`\n── Image URL ──\n${imageUrl || '(aucune — GITHUB_REPOSITORY non défini)'}\n`);

  const results = await Promise.allSettled([
    postToFacebook(long, imageUrl),
    postToThreads(short, imageUrl),
    postToInstagram(long, imageUrl),
  ]);

  const errors = results.filter(r => r.status === 'rejected');
  if (errors.length) {
    for (const e of errors) console.error('❌', e.reason?.message || e.reason);
    process.exit(1);
  }
}

main().catch(e => { console.error('💥', e); process.exit(1); });
