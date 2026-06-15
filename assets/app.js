// The Idiocracy Index, display engine (gauge, count-up, ticker, animated bars)
const $ = (s) => document.querySelector(s);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ZONES = [
  { min: 85, cls: 's-extreme', hex: '#ff2e63' },
  { min: 69, cls: 's-high',    hex: '#ff4d4d' },
  { min: 50, cls: 's-warn',    hex: '#ffb02e' },
  { min: 0,  cls: 's-safe',    hex: '#34e5a0' },
];
const zone = (s) => ZONES.find(z => s >= z.min) || ZONES[ZONES.length - 1];
const scoreClass = (s) => zone(s).cls;
const scoreColor = (s) => zone(s).hex;

function trendHTML(t) {
  if (t > 0) return `<span class="trend-up">▲ +${t}</span>`;
  if (t < 0) return `<span class="trend-down">▼ ${t}</span>`;
  return `<span class="trend-flat">▬ 0</span>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

// Share a country's score: native share sheet on mobile, else open its share page.
function shareCountry(code, name, score) {
  const url = location.origin + '/c/' + String(code).toLowerCase() + '.html';
  const text = `${name} scores ${score}/100 on The Idiocracy Index 🧠💀 (100% satire)`;
  if (navigator.share) navigator.share({ title: 'The Idiocracy Index', text, url }).catch(() => {});
  else window.open(url, '_blank', 'noopener');
}

// Flag picker: pick your country, then open its share page.
function openCountryPicker() {
  if (!DATA || !DATA.countries) return;
  let bd = document.getElementById('cp-backdrop');
  if (!bd) { bd = document.createElement('div'); bd.id = 'cp-backdrop'; bd.className = 'cp-backdrop'; document.body.appendChild(bd); }
  const list = [...DATA.countries].sort((a, b) => b.score - a.score);
  bd.innerHTML = `
    <div class="cp-panel" role="dialog" aria-modal="true" aria-label="${esc(window.t('pickCountry'))}">
      <button class="cp-close" type="button" aria-label="Close">×</button>
      <div class="cp-title">${esc(window.t('pickCountry'))}</div>
      <div class="cp-grid">
        ${list.map(c => `<button class="cp-item" type="button" data-code="${esc((c.code || '').toLowerCase())}">
          <span class="cp-flag">${c.flag || '🏳️'}</span>
          <span class="cp-name">${esc(c.name)}</span>
          <span class="cp-score ${scoreClass(c.score)}">${c.score}</span>
        </button>`).join('')}
      </div>
    </div>`;
  bd.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCountryPicker() {
  const bd = document.getElementById('cp-backdrop');
  if (bd) bd.classList.remove('open');
  document.body.style.overflow = '';
}

let DATA = null;

async function load() {
  try {
    const res = await fetch('data/scores.json?_=' + Date.now());
    DATA = await res.json();
  } catch (e) {
    $('#world-headline').textContent = "Couldn't load today's stupidity. (data/scores.json not found)";
    return;
  }
  render();
}

/* ---------- GAUGE ---------- */
const R = 100, C = 2 * Math.PI * R;
function buildGauge(score) {
  const svg = $('#gauge');
  const color = scoreColor(score);
  // 69-line tick, placed in the svg's rotated frame
  const a = 0.69 * 2 * Math.PI;
  const tx = (r) => (120 + r * Math.cos(a)).toFixed(1);
  const ty = (r) => (120 + r * Math.sin(a)).toFixed(1);
  svg.innerHTML = `
    <circle class="gauge-track" cx="120" cy="120" r="${R}"/>
    <circle class="gauge-fill" cx="120" cy="120" r="${R}"
      style="stroke:${color};color:${color};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${C.toFixed(1)}"/>
    <line class="gauge-tick" x1="${tx(88)}" y1="${ty(88)}" x2="${tx(112)}" y2="${ty(112)}"/>`;
  // animate fill after paint
  const fill = svg.querySelector('.gauge-fill');
  const offset = C * (1 - Math.max(0, Math.min(100, score)) / 100);
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.strokeDashoffset = offset.toFixed(1); }));
}

function countUp(el, target, dur = 1500) {
  if (reduceMotion) { el.textContent = target; return; }
  const start = performance.now();
  const from = 0;
  function step(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---------- TICKER ---------- */
function buildTicker(countries) {
  const items = countries
    .slice().sort((a, b) => b.score - a.score)
    .map(c => `<span class="ticker-item">${c.flag} <b>${esc(c.name)} ${c.score}</b>, ${esc(window.pick(c.headline))}</span>`)
    .join('');
  // duplicate for seamless loop
  $('#ticker').innerHTML = items + items;
}

/* ---------- RENDER ---------- */
function render() {
  const w = DATA.world;
  const ws = $('#world-score');
  ws.className = 'gauge-num ' + scoreClass(w.score);
  buildGauge(w.score);
  countUp(ws, w.score);
  $('#world-trend').innerHTML = trendHTML(w.trend);
  $('#world-label').textContent = window.pick(w.label);
  const wh = window.pick(w.headline);
  $('#world-headline').innerHTML = `<b>${esc(wh.split('.')[0])}.</b> ${esc(wh.split('.').slice(1).join('.').trim())}`;
  $('#updated-date').textContent = fmtDate(DATA.updated);
  $('#year').textContent = (DATA.updated || '2026').slice(0, 4);

  buildTicker(DATA.countries || []);

  const sp = DATA.spotlight;
  if (sp) {
    $('#spotlight-card').innerHTML = `
      <div class="spotlight-flag">${sp.flag || '🌐'}</div>
      <div class="spotlight-body">
        <div class="spotlight-country">${esc(sp.country || '')}</div>
        <div class="spotlight-headline">${esc(window.pick(sp.headline))}</div>
        <div class="spotlight-why">${esc(window.pick(sp.why))}</div>
      </div>
      <div class="spotlight-score ${scoreClass(sp.score)}">${sp.score}<small>/ 100</small></div>`;
  }

  const cg = $('#continent-grid');
  cg.innerHTML = (DATA.continents || []).slice().sort((a, b) => b.score - a.score).map(c => `
    <div class="continent-card">
      <div class="continent-name">${c.emoji || '🌐'} ${esc(c.name)}</div>
      <div class="continent-score ${scoreClass(c.score)}">${c.score}</div>
      <div class="bar has69"><i data-w="${c.score}" style="background:${scoreColor(c.score)}"></i></div>
      <div class="continent-trend">${trendHTML(c.trend)} ${window.t('over7days')}</div>
    </div>`).join('');

  renderCountries();
  animateBars();
  setupReveal();
}

function renderCountries() {
  const q = ($('#search').value || '').toLowerCase().trim();
  const sort = $('#sort').value;
  let list = (DATA.countries || []).slice();
  if (q) list = list.filter(c => c.name.toLowerCase().includes(q));

  const sorters = {
    'score-desc': (a, b) => b.score - a.score,
    'score-asc': (a, b) => a.score - b.score,
    'trend-desc': (a, b) => b.trend - a.trend,
    'adj-desc': (a, b) => (b.gdp_adjusted ?? b.score) - (a.gdp_adjusted ?? a.score),
  };
  list.sort(sorters[sort] || sorters['score-desc']);

  $('#country-list').innerHTML = list.map((c, i) => {
    const arts = c.articles || [];
    return `
    <li class="country-row-wrap ${i < 3 ? 'top' + (i + 1) : ''}">
      <div class="country-row" role="button" tabindex="0" aria-expanded="false">
        <span class="country-rank">${String(i + 1).padStart(2, '0')}</span>
        <span class="country-flag">${c.flag || '🏳️'}</span>
        <span class="country-info">
          <div class="country-name">${esc(c.name)} <span class="country-chevron">▾</span></div>
          <div class="country-headline">${esc(window.pick(c.headline))}</div>
        </span>
        <span class="country-bar"><span class="bar has69"><i data-w="${c.score}" style="background:${scoreColor(c.score)}"></i></span></span>
        <span class="country-trend">${trendHTML(c.trend)}</span>
        <span class="country-score ${scoreClass(c.score)}">${c.score}</span>
      </div>
      <div class="country-articles"><div class="articles-inner"><div class="articles-pad">
        <div class="articles-legend">${esc(window.t('artLegend'))} · <span class="up">${esc(window.t('artRaises'))}</span> · <span class="down">${esc(window.t('artLowers'))}</span></div>
        ${arts.length ? arts.map(articleHTML).join('') : `<p class="no-articles">${esc(window.t('noArticles'))}</p>`}
        <button class="country-share" data-code="${esc(c.code || '')}" data-name="${esc(c.name)}" data-score="${c.score}">📤 ${esc(window.t('shareScore'))} ${esc(c.name)}</button>
      </div></div></div>
    </li>`; }).join('');
  animateBars();
}

function articleHTML(a) {
  const up = (a.impact ?? 0) >= 0;
  const val = (up ? '+' : '−') + Math.abs(a.impact ?? 0);
  return `<a class="article" href="${esc(a.url || '#')}" target="_blank" rel="noopener">
    <span class="impact ${up ? 'up' : 'down'}">${val}</span>
    <span class="article-body">
      <span class="article-title">${esc(window.pick(a.title))}${a.axis ? ` <span class="article-axis">${esc(window.axisLabel(a.axis))}</span>` : ''}</span>
      <span class="article-meta">${esc(a.source || '')}${a.date ? ' · ' + esc(a.date) : ''}${window.pick(a.note) ? ', ' + esc(window.pick(a.note)) : ''}</span>
    </span>
    <span class="article-go">↗</span>
  </a>`;
}

function toggleCountry(row) {
  const wrap = row.closest('.country-row-wrap');
  if (!wrap) return;
  const open = wrap.classList.toggle('open');
  row.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function animateBars() {
  document.querySelectorAll('.bar > i[data-w]').forEach(el => {
    const w = el.getAttribute('data-w');
    if (reduceMotion) { el.style.width = w + '%'; return; }
    el.style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = w + '%'; }));
  });
}

function setupReveal() {
  if (reduceMotion || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(e => io.observe(e));
}

function fmtDate(iso) {
  if (!iso) return '…';
  const loc = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }[window.LANG] || 'en-US';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString(loc, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

/* ---------- LANGUAGE ---------- */
function buildLangSwitch() {
  const sel = $('#lang-switch');
  if (!sel) return;
  sel.innerHTML = window.LANGS.map(l => `<option value="${l}">${window.LANG_NAMES[l]}</option>`).join('');
  sel.value = window.LANG;
}
function setLang(l) {
  if (!window.LANGS.includes(l) || l === window.LANG) return;
  window.LANG = l;
  try { localStorage.setItem('ii_lang', l); } catch {}
  window.applyI18n();
  if (DATA) render(); // re-render data-driven content in the new language
}

document.addEventListener('input', (e) => { if (e.target.id === 'search') renderCountries(); });
document.addEventListener('change', (e) => {
  if (e.target.id === 'sort') renderCountries();
  if (e.target.id === 'lang-switch') setLang(e.target.value);
});
document.addEventListener('click', (e) => {
  const share = e.target.closest('.country-share');
  if (share) { e.stopPropagation(); shareCountry(share.dataset.code, share.dataset.name, share.dataset.score); return; }
  if (e.target.closest('#share-hero')) { openCountryPicker(); return; }
  const cpItem = e.target.closest('.cp-item');
  if (cpItem && cpItem.dataset.code) { location.href = '/c/' + cpItem.dataset.code + '.html'; return; }
  if (e.target.closest('.cp-close') || e.target.id === 'cp-backdrop') { closeCountryPicker(); return; }
  const row = e.target.closest('.country-row');
  if (row) toggleCountry(row);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCountryPicker();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('country-row')) {
    e.preventDefault();
    toggleCountry(e.target);
  }
});

window.applyI18n();
buildLangSwitch();
load();
