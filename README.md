# 🧠💀 L'Indice d'Idiocratie

Le palmarès mondial **satirique** de la connerie civilisationnelle. Chaque pays, continent et la planète entière est noté sur une échelle de 0 à 100 (la **« ligne des 69 »** = seuil critique). Le site se met à jour **chaque jour** en lisant les actualités du monde entier et en les notant via une IA, dans l'esprit du film *Idiocracy* (2006).

> ⚠️ **Œuvre de satire.** Aucun score n'est une affirmation de fait. On note des *décisions* et des *comportements*, jamais des peuples. Aucun « QI national » pseudo-scientifique n'est utilisé.

## 🗂️ Structure

```
index.html              Palmarès (score mondial, continents, pays, connerie du jour)
about.html              Méthodologie + disclaimer juridique
merch.html              Boutique print-on-demand (monétisation)
assets/style.css        Thème
assets/app.js           Affichage (lit data/scores.json)
data/scores.json        Les scores (mis à jour par le script)
scripts/update.mjs      ⭐ La routine quotidienne : actu GDELT → scoring LLM → JSON
scripts/build-posts.mjs Brouillons de posts réseaux sociaux (FR/EN) → marketing/social/
scripts/serve.mjs       Serveur local de test
scripts/install-windows-task.ps1   Routine quotidienne via Windows
.github/workflows/daily-update.yml Routine quotidienne via GitHub Actions
```

## 🚀 Lancer en local

```powershell
node scripts/serve.mjs      # puis ouvrir http://localhost:8080
```

## 🔄 La routine de mise à jour

```powershell
# 1. Copier la config et mettre votre clé API
copy .env.example .env       # puis remplir ANTHROPIC_API_KEY (ou OPENAI_API_KEY)

# 2. Charger la clé dans la session, puis lancer
$env:ANTHROPIC_API_KEY="sk-ant-..."
node scripts/update.mjs
```

Sans clé API, le script tourne quand même (mode démo : dérive aléatoire des scores) — utile pour tester la chaîne. Le scoring réel coûte **~4 $/mois** pour 1 000 articles/jour (Claude Haiku) ou moins avec GPT-4o-mini.

### Automatiser tous les jours

| Méthode | Quand | Comment |
|---|---|---|
| **GitHub Actions** *(recommandé si hébergé sur GitHub Pages)* | Site sur GitHub | Pousser le repo, ajouter le secret `ANTHROPIC_API_KEY` dans *Settings → Secrets*, c'est tout. Le workflow tourne à 11h UTC et committe `data/scores.json`. |
| **Windows Task Scheduler** *(si vous hébergez vous-même)* | PC toujours allumé | `.\scripts\install-windows-task.ps1` |

## 📣 Posts réseaux sociaux (semi-automatique)

Le contenu se prête parfaitement aux réseaux (un « score du jour » + une « connerie du jour »).
Le script ne **publie rien** tout seul — il te prépare des brouillons prêts à copier-coller, et
**toi** tu gardes le doigt sur le bouton « publier » (le 100 % auto = spam = comptes bannis).

```powershell
npm run posts                 # version FR → marketing/social/latest.md
node scripts/build-posts.mjs --lang=en   # version anglaise
```

Quatre angles sont générés à chaque fois (score mondial, connerie du jour, podium, plus forte
hausse), formatés pour X/Threads (≤ 280 car.) et pour Instagram/Facebook/TikTok/LinkedIn.
La routine quotidienne (`update.mjs` + GitHub Actions) les régénère automatiquement : en local
ils atterrissent dans `marketing/social/`, et dans GitHub Actions ils sont téléchargeables en
**artifact `social-posts`** (dossier `marketing/` gitignoré → jamais publié sur le site).

## 🌐 Déploiement (gratuit)

Le site est 100 % statique → déployable tel quel sur :
- **GitHub Pages** (gratuit, marche avec le workflow ci-dessus)
- **Netlify** / **Vercel** / **Cloudflare Pages** (glisser-déposer le dossier)

## 💰 Monétisation (plan recommandé)

Combo gagnant = **pub display premium + merch satirique POD** :

1. **Jour 1** — Google AdSense (emplacements déjà prévus dans `index.html`, classe `.ad-slot`) + boutique **Printful/Printify** (designs originaux, zéro stock, pas de douane). Brancher les boutons de `merch.html` sur vos vrais produits.
2. **À 25 000 pages vues/mois** — basculer sur **Raptive** ou **Mediavine** (RPM 11-20 $ vs ~1-3 $ AdSense). C'est le levier n°1.
3. **Communauté établie** — abonnement **Substack/Patreon** (« Rapport annuel de la connerie mondiale », classements premium).

➡️ Le **dropshipping AliExpress est déconseillé** (aucun lien avec le contenu, délais, nouvelles douanes 2025-2026). Détails dans le document de recherche fourni.

## ⚖️ Prudence juridique
- Garder le **disclaimer satirique** partout (déjà en place : bandeau + footer + page méthodo).
- **Designs merch 100 % originaux** — ne pas reproduire Brawndo/Camacho/les logos du film (Disney détient l'IP).
- Viser **pays/gouvernements/comportements**, jamais des ethnies ou personnes nommées.
- Avant lancement commercial : consulter un avocat québécois en droit des médias/PI.

---
*« Je ne suis pas un prophète, je me suis juste trompé de 490 ans. »*
