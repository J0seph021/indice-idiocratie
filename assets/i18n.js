// The Idiocracy Index — internationalization (fr / en / es / de)
// Detects the browser language, lets the user override, and translates the UI.
// Content fields in data/scores.json are stored as {en,fr,es,de} objects and
// resolved via pick(); UI strings live in the I18N dictionary below.

window.LANGS = ['en', 'fr', 'es', 'de'];
window.LANG_NAMES = { en: 'EN', fr: 'FR', es: 'ES', de: 'DE' };

const I18N = {
  en: {
    satireTag: 'SATIRE', satireText: "No score is a statement of fact. It's a joke.", why: 'Why?',
    navScoreboard: 'Scoreboard', navMethodology: 'Methodology', navShop: 'Shop', live: 'LIVE', breaking: 'BREAKING',
    heroKicker: 'Global Civilizational Stupidity Index', heroTitle: 'How dumb is *the planet* today?',
    updated: 'Updated', scale: 'Scale', line69: 'the *69 line* = critical threshold',
    secDumbest: 'Dumbest Move of the Day', secContinents: 'Global Breakdown by Continent', secRankings: 'National Stupidity Rankings',
    searchPlaceholder: 'Search a country…',
    sortDumbest: 'Dumbest first', sortSmartest: 'Smartest first', sortWorse: 'Getting worse', sortAdjusted: 'Wealth-adjusted',
    over7days: 'over 7 days',
    artLegend: 'Articles driving the score', artRaises: '+ raises', artLowers: '− lowers',
    noArticles: 'No articles logged yet — check back after the daily update.',
    loadingWorld: 'Booting up the global stupidity monitor…',
    footAboutT: 'The Idiocracy Index', footAbout: 'A satirical barometer of civilizational stupidity. We rate <em>decisions</em> and <em>behaviors</em>, not peoples. No pseudo-scientific "national IQ" is ever used.',
    footLinksT: 'Links', footWordsT: 'Famous last words', footQuote: '"I\'m not a prophet. I was just off by 490 years."',
    footLegal: 'WORK OF SATIRE. Scores are humorous, hyperbolic exaggerations and are in no way verifiable statements of fact. This site targets no ethnicity, religion, or named person.',
  },
  fr: {
    satireTag: 'SATIRE', satireText: "Aucun score n'est une affirmation de fait. C'est de l'humour.", why: 'Pourquoi ?',
    navScoreboard: 'Palmarès', navMethodology: 'Méthodologie', navShop: 'Boutique', live: 'EN DIRECT', breaking: 'URGENT',
    heroKicker: "Indice mondial de connerie civilisationnelle", heroTitle: "À quel point *la planète* est-elle conne aujourd'hui ?",
    updated: 'Mis à jour', scale: 'Échelle', line69: 'la *ligne des 69* = seuil critique',
    secDumbest: 'La connerie du jour', secContinents: 'Vue mondiale par continent', secRankings: 'Palmarès national de la connerie',
    searchPlaceholder: 'Chercher un pays…',
    sortDumbest: 'Plus cons d\'abord', sortSmartest: 'Moins cons d\'abord', sortWorse: 'Ça empire', sortAdjusted: 'Ajusté à la richesse',
    over7days: 'sur 7 jours',
    artLegend: 'Articles qui pèsent sur le score', artRaises: '+ fait monter', artLowers: '− fait baisser',
    noArticles: 'Aucun article pour l\'instant — reviens après la mise à jour quotidienne.',
    loadingWorld: 'Démarrage du moniteur mondial de connerie…',
    footAboutT: "L'Indice d'Idiocratie", footAbout: 'Un baromètre satirique de la connerie civilisationnelle. On note des <em>décisions</em> et des <em>comportements</em>, pas des peuples. Aucun « QI national » pseudo-scientifique n\'est utilisé.',
    footLinksT: 'Liens', footWordsT: 'Le mot de la fin', footQuote: '« Je ne suis pas un prophète. Je me suis juste trompé de 490 ans. »',
    footLegal: 'ŒUVRE DE SATIRE. Les scores sont des exagérations humoristiques et hyperboliques, en aucun cas des affirmations de fait vérifiables. Ce site ne vise aucune ethnie, religion ni personne nommée.',
  },
  es: {
    satireTag: 'SÁTIRA', satireText: 'Ninguna puntuación es una afirmación de hecho. Es humor.', why: '¿Por qué?',
    navScoreboard: 'Ranking', navMethodology: 'Metodología', navShop: 'Tienda', live: 'EN VIVO', breaking: 'ÚLTIMA HORA',
    heroKicker: 'Índice mundial de estupidez civilizatoria', heroTitle: '¿Qué tan tonto está *el planeta* hoy?',
    updated: 'Actualizado', scale: 'Escala', line69: 'la *línea de 69* = umbral crítico',
    secDumbest: 'La estupidez del día', secContinents: 'Panorama mundial por continente', secRankings: 'Ranking nacional de estupidez',
    searchPlaceholder: 'Buscar un país…',
    sortDumbest: 'Más tontos primero', sortSmartest: 'Menos tontos primero', sortWorse: 'Va a peor', sortAdjusted: 'Ajustado por riqueza',
    over7days: 'en 7 días',
    artLegend: 'Artículos que mueven la puntuación', artRaises: '+ sube', artLowers: '− baja',
    noArticles: 'Aún no hay artículos — vuelve tras la actualización diaria.',
    loadingWorld: 'Arrancando el monitor mundial de estupidez…',
    footAboutT: 'El Índice de Idiocracia', footAbout: 'Un barómetro satírico de la estupidez civilizatoria. Calificamos <em>decisiones</em> y <em>comportamientos</em>, no a los pueblos. Nunca se usa ningún "CI nacional" pseudocientífico.',
    footLinksT: 'Enlaces', footWordsT: 'Últimas palabras', footQuote: '«No soy un profeta. Solo me equivoqué por 490 años.»',
    footLegal: 'OBRA DE SÁTIRA. Las puntuaciones son exageraciones humorísticas e hiperbólicas y de ningún modo afirmaciones de hecho verificables. Este sitio no apunta a ninguna etnia, religión ni persona nombrada.',
  },
  de: {
    satireTag: 'SATIRE', satireText: 'Keine Wertung ist eine Tatsachenbehauptung. Es ist ein Witz.', why: 'Warum?',
    navScoreboard: 'Rangliste', navMethodology: 'Methodik', navShop: 'Shop', live: 'LIVE', breaking: 'EILMELDUNG',
    heroKicker: 'Globaler Index zivilisatorischer Dummheit', heroTitle: 'Wie dumm ist *der Planet* heute?',
    updated: 'Aktualisiert', scale: 'Skala', line69: 'die *69er-Linie* = kritische Schwelle',
    secDumbest: 'Dümmster Moment des Tages', secContinents: 'Weltüberblick nach Kontinent', secRankings: 'Nationale Dummheits-Rangliste',
    searchPlaceholder: 'Land suchen…',
    sortDumbest: 'Dümmste zuerst', sortSmartest: 'Klügste zuerst', sortWorse: 'Wird schlimmer', sortAdjusted: 'Nach Wohlstand bereinigt',
    over7days: 'über 7 Tage',
    artLegend: 'Artikel, die die Wertung treiben', artRaises: '+ erhöht', artLowers: '− senkt',
    noArticles: 'Noch keine Artikel — schau nach dem täglichen Update wieder vorbei.',
    loadingWorld: 'Globaler Dummheits-Monitor startet…',
    footAboutT: 'Der Idiocracy-Index', footAbout: 'Ein satirisches Barometer zivilisatorischer Dummheit. Wir bewerten <em>Entscheidungen</em> und <em>Verhalten</em>, keine Völker. Es wird nie ein pseudowissenschaftlicher „nationaler IQ" verwendet.',
    footLinksT: 'Links', footWordsT: 'Letzte Worte', footQuote: '„Ich bin kein Prophet. Ich lag nur um 490 Jahre daneben."',
    footLegal: 'SATIRE-WERK. Die Wertungen sind humorvolle, übertriebene Hyperbeln und keinesfalls überprüfbare Tatsachenbehauptungen. Diese Seite richtet sich gegen keine Ethnie, Religion oder benannte Person.',
  },
};

Object.assign(I18N.en, { footLinkMethod: 'Methodology & disclaimer', footLinkShop: 'Satirical shop', footLinkSources: 'Data sources' });
Object.assign(I18N.fr, { footLinkMethod: 'Méthodologie & disclaimer', footLinkShop: 'Boutique satirique', footLinkSources: 'Sources de données' });
Object.assign(I18N.es, { footLinkMethod: 'Metodología y aviso', footLinkShop: 'Tienda satírica', footLinkSources: 'Fuentes de datos' });
Object.assign(I18N.de, { footLinkMethod: 'Methodik & Haftungsausschluss', footLinkShop: 'Satire-Shop', footLinkSources: 'Datenquellen' });

Object.assign(I18N.en, { shareScore: 'Share', shareHero: "📤 Share your country's score", footLinkPrivacy: 'Privacy & cookies' });
Object.assign(I18N.fr, { shareScore: 'Partager', shareHero: '📤 Partage le score de ton pays', footLinkPrivacy: 'Confidentialité & cookies' });
Object.assign(I18N.es, { shareScore: 'Compartir', shareHero: '📤 Comparte la puntuación de tu país', footLinkPrivacy: 'Privacidad y cookies' });
Object.assign(I18N.de, { shareScore: 'Teilen', shareHero: '📤 Teile die Bewertung deines Landes', footLinkPrivacy: 'Datenschutz & Cookies' });

function detectLang() {
  const saved = localStorage.getItem('ii_lang');
  if (saved && window.LANGS.includes(saved)) return saved;
  const nav = (navigator.languages || [navigator.language || 'en']);
  for (const l of nav) { const code = l.slice(0, 2).toLowerCase(); if (window.LANGS.includes(code)) return code; }
  return 'en';
}

window.LANG = detectLang();

// Resolve a multilingual content field ({en,fr,...}) or a plain string, with fallback.
window.pick = function (v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v[window.LANG] || v.en || Object.values(v)[0] || '';
  return v == null ? '' : v;
};

// UI string by key, with English fallback. Converts *…* into a highlighted span.
window.t = function (key) {
  const s = (I18N[window.LANG] && I18N[window.LANG][key]) || I18N.en[key] || key;
  return s;
};
window.tHL = function (key) {
  return window.t(key).replace(/\*([^*]+)\*/g, '<span class="hl ref-69">$1</span>');
};

// The 6 grid axes — short labels per language for the article badges.
window.AXIS_LABELS = {
  SCI:       { icon: '🧪', en: 'Science', fr: 'Science', es: 'Ciencia', de: 'Wissenschaft' },
  SPECTACLE: { icon: '🎪', en: 'Spectacle', fr: 'Spectacle', es: 'Espectáculo', de: 'Spektakel' },
  PUBLIC:    { icon: '🏛️', en: 'Public good', fr: 'Bien public', es: 'Bien público', de: 'Gemeinwohl' },
  KNOW:      { icon: '📚', en: 'Knowledge', fr: 'Savoir', es: 'Saber', de: 'Wissen' },
  CRIT:      { icon: '🧠', en: 'Critical thinking', fr: 'Esprit critique', es: 'Pensamiento crítico', de: 'Kritisches Denken' },
  FUTURE:    { icon: '⏳', en: 'Long-term', fr: 'Long terme', es: 'Largo plazo', de: 'Langfristig' },
};
window.axisLabel = function (key) { const a = window.AXIS_LABELS[key]; return a ? (a.icon + ' ' + (a[window.LANG] || a.en)) : ''; };

// Apply static UI strings to elements carrying data-i18n / data-i18n-html / data-i18n-ph.
window.applyI18n = function () {
  document.documentElement.lang = window.LANG;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = window.t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = window.tHL(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.setAttribute('placeholder', window.t(el.dataset.i18nPh)); });
};
