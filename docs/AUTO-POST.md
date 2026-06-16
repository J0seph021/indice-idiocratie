# 🤖 Publication automatique sur Facebook & Instagram (gratuit)

Une fois ce **setup unique** fait, la routine quotidienne publie toute seule
la « connerie du jour » (image + légende) sur ta Page Facebook et, en option,
sur Instagram. **Aucun outil tiers, aucun frais** : on passe par l'API Graph
officielle de Meta, qui est gratuite pour du contenu organique sur *tes propres
comptes*.

> Tu ne fais ce setup **qu'une seule fois**. Ensuite : zéro intervention.

> **Page ≠ profil perso.** Les posts partent au nom de **la Page** (ton nom perso
> n'apparaît jamais dessus). Ton compte perso sert juste d'**admin invisible** de
> la Page — c'est lui qui génère le jeton. L'API Meta **ne peut poster que sur une
> Page**, donc créer une Page dédiée est exactement ce qu'il faut. Vérifie juste
> que ton compte perso est **admin** de la Page : sinon `GET /me/accounts` (étape 3.5)
> ne la listera pas. (Seul détail public : la « Transparence de la Page » montre le
> *pays* des gestionnaires, jamais leur nom.)

---

## A. Facebook (≈ 15 min) — le minimum

### 1. Créer une app Meta (gratuit)
1. Va sur https://developers.facebook.com/apps → **Créer une application**.
2. Type **« Entreprise »** (Business). Donne-lui un nom (ex. « Idiocracy Bot »).

### 2. Récupérer l'ID de ta Page
- Sur ta Page Facebook → **À propos** → tout en bas, **« ID de la Page »**
  (un nombre). C'est ton `FB_PAGE_ID`.

### 3. Générer un jeton de Page longue durée
1. Ouvre le **Graph API Explorer** : https://developers.facebook.com/tools/explorer
2. En haut à droite, choisis ton app, puis **« Get User Access Token »**.
3. Coche ces permissions : `pages_show_list`, `pages_read_engagement`,
   `pages_manage_posts`. Génère le jeton, accepte les pop-ups.
4. Échange-le contre un jeton **longue durée** (sinon il expire en 1 h) :
   - Ouvre l'**Access Token Debugger** : https://developers.facebook.com/tools/debug/accesstoken
   - Colle ton jeton → **Debug** → en bas, **« Extend Access Token »**.
5. Récupère le **jeton de PAGE** (différent du jeton utilisateur) :
   - Dans le Graph API Explorer, appelle `GET /me/accounts` → copie le champ
     `access_token` de ta Page. Ce jeton de Page est **sans expiration** tant
     que ton mot de passe ne change pas. C'est ton `FB_PAGE_TOKEN`.

> 💡 Comme tu es admin de ta propre Page et que l'app reste en mode
> *développement*, **aucune App Review n'est nécessaire** pour publier chez toi.

### 4. Mettre les secrets dans GitHub
Dans ton repo → **Settings → Secrets and variables → Actions → New repository secret** :

| Nom du secret | Valeur |
|---|---|
| `FB_PAGE_ID` | l'ID de ta Page (étape 2) |
| `FB_PAGE_TOKEN` | le jeton de Page longue durée (étape 3.5) |

✅ **C'est tout.** Au prochain passage quotidien (11 h UTC), le post part tout seul.

---

## B. Instagram (optionnel, +10 min) — plus de portée

Prérequis : un compte **Instagram Business** (ou Créateur) **relié à ta Page
Facebook** (dans l'app Instagram → Paramètres → Compte → passer en Pro, puis
relier la Page).

1. Ajoute la permission `instagram_basic` et `instagram_content_publish` à ton
   jeton (même Graph API Explorer qu'au-dessus).
2. Trouve l'**ID du compte IG** : `GET /{FB_PAGE_ID}?fields=instagram_business_account`
   → le champ `id` renvoyé est ton `IG_USER_ID`.
3. Ajoute deux secrets GitHub :

| Nom du secret | Valeur |
|---|---|
| `IG_USER_ID` | l'ID du compte Instagram Business |
| `IG_TOKEN` | *(facultatif)* un jeton avec `instagram_content_publish`. Si absent, le `FB_PAGE_TOKEN` est réutilisé. |

> Instagram exige que l'image soit accessible à une **URL publique** : c'est déjà
> le cas (`https://idiocracies.com/assets/og/<pays>.png`).

---

## C. Tester sans rien publier

```bash
npm run posts          # génère le post du jour (marketing/social/latest.json)
npm run publish:dry    # affiche EXACTEMENT ce qui serait posté — ne publie rien
```

Pour déclencher une vraie publication à la demande : onglet **Actions** du repo →
workflow **« Mise a jour quotidienne »** → **Run workflow**.

---

## D. Réglages

Dans `.github/workflows/main.yml`, étape *« Publier sur Facebook / Instagram »* :

- `POST_ANGLE` : `spotlight` (défaut, la connerie du jour), `world`, `podium`, `mover`.
- `POST_LANG` : `fr` (défaut) ou `en`.

L'étape a `continue-on-error: true` : si Meta a un hoquet un jour, ça **n'empêche
pas** la mise à jour des scores.

---

## ⚠️ À garder en tête
- La publication est **entièrement automatique** : personne ne relit avant que ça
  parte. C'est de la satire sur de l'actu réelle — le disclaimer « 100 % satire »
  est inclus dans chaque légende, mais garde un œil de temps en temps.
- Un jeton de Page peut être révoqué si tu changes ton mot de passe Facebook : il
  faudra alors régénérer `FB_PAGE_TOKEN` (étape 3).
