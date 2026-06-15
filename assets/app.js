// L'Indice d'Idiocratie — logique d'affichage
const $ = (s) => document.querySelector(s);

function scoreClass(s) {
  if (s >= 85) return 'score-extreme';
  if (s >= 69) return 'score-high';
  if (s >= 50) return 'score-mid';
  return 'score-low';
}
function trendHTML(t) {
  if (t > 0) return `<span class="trend-up">▲ +${t}</span>`;
  if (t < 0) return `<span class="trend-down">▼ ${t}</span>`;
  return `<span class="trend-flat">▬ 0</span>`;
}
function barColor(s) {
  if (s >= 85) return '#ff3e6e';
  if (s >= 69) return '#ff3e3e';
  if (s >= 50) return '#ff9f2e';
  return '#3ee08a';
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

function render() {
  // World
  const w = DATA.world;
  const ws = $('#world-score');
  ws.textContent = w.score;
  $('#world-trend').innerHTML = trendHTML(w.trend);
  $('#world-label').textContent = w.label || '';
  $('#world-headline').textContent = w.headline || '';
  $('#updated-date').textContent = formatDate(DATA.updated);
  $('#year').textContent = (DATA.updated || '2026').slice(0, 4);

  // Spotlight
  const sp = DATA.spotlight;
  if (sp) {
    $('#spotlight-card').innerHTML = `
      <div class="spotlight-flag">${sp.flag || '🌐'}</div>
      <div class="spotlight-body">
        <div class="spotlight-country">${sp.country || ''}</div>
        <div class="spotlight-headline">${escapeHTML(sp.headline || '')}</div>
        <div class="spotlight-why">${escapeHTML(sp.why || '')}</div>
      </div>
      <div class="spotlight-score ${scoreClass(sp.score)}">${sp.score}<small>/100</small></div>`;
  }

  // Continents
  const cg = $('#continent-grid');
  cg.innerHTML = (DATA.continents || []).slice().sort((a, b) => b.score - a.score).map(c => `
    <div class="continent-card">
      <div class="continent-name">${c.emoji || '🌐'} ${c.name}</div>
      <div class="continent-score ${scoreClass(c.score)}">${c.score}</div>
      <div class="continent-bar"><i style="width:${c.score}%;background:${barColor(c.score)}"></i></div>
      <div style="font-size:.8rem;color:var(--text-dim);margin-top:6px">${trendHTML(c.trend)} over 7 days</div>
    </div>`).join('');

  renderCountries();
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

  $('#country-list').innerHTML = list.map((c, i) => `
    <li class="country-row">
      <span class="country-rank">${i + 1}</span>
      <span class="country-flag">${c.flag || '🏳️'}</span>
      <span class="country-info">
        <div class="country-name">${c.name}</div>
        <div class="country-headline">${escapeHTML(c.headline || '')}</div>
      </span>
      <span class="country-trend">${trendHTML(c.trend)}</span>
      <span class="country-score ${scoreClass(c.score)}">${c.score}</span>
    </li>`).join('');
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}
function escapeHTML(s) {
  return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'search') renderCountries();
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'sort') renderCountries();
});

load();
