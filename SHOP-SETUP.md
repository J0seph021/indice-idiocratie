# 🛒 Lancer la boutique — Printify Pop-Up Store (gratuit)

Objectif : une boutique POD **sans frais mensuels, sans inventaire**, qui garde ta marque, reliée au bouton **Shop** du site.

> 🔒 Ces étapes touchent à ton compte et à ton paiement → **c'est toi qui les fais**. Je t'ai préparé les designs (`shop-designs/`) et le câblage du site.

---

## Étape 1 — Créer le compte Printify
1. Va sur **printify.com** → *Sign up* (gratuit).
2. Dans *My new store* → choisis **« Pop-Up Store »** comme canal de vente. C'est une vraie boutique hébergée par Printify, gratuite, qui te donne une URL du type `https://ton-nom.printify.me`.
3. Renseigne tes infos de **paiement/encaissement** (pour recevoir l'argent des ventes).

## Étape 2 — Créer les produits
Pour chaque design (`shop-designs/`) :
1. **Catalog** → choisis un produit (ex. *Unisex Heavy Cotton Tee — Gildan 5000*, valeur sûre).
2. Ouvre l'éditeur → **Upload** ton fichier de design (voir tableau ci-dessous).
3. Centre-le sur la poitrine, choisis la **couleur de chandail recommandée**.
4. **Fixe ton prix** : vise ~40 % de marge. Ex. coût de base ~9-12 $ → prix de vente **29,99 $**.
5. Publie. Copie l'**URL de la page produit**.

### Designs fournis et réglages

| Fichier | Produit | Couleur de chandail | Prix conseillé |
|---|---|---|---|
| `shop-designs/69-line.svg` | T-shirt | **Noir / charbon** | 29,99 $ |
| `shop-designs/documentary.svg` | T-shirt | **Rose vif** ou blanc | 29,99 $ |
| `shop-designs/voters-crave.svg` | T-shirt | **Noir / charbon** | 29,99 $ |

> 💡 **Format de fichier** : Printify accepte le PNG (idéal) et souvent le SVG. Si l'upload SVG est refusé, ouvre le `.svg` dans Chrome → clic droit → ou utilise un convertisseur (ex. *cloudconvert.com*) en **PNG ~4500 px**, fond transparent. Les designs utilisent la police gratuite **Anton** (Google Fonts) — déjà intégrée si tu convertis via un outil qui charge les polices web, sinon recrée le texte directement dans l'éditeur Printify (texte pur, très simple) avec la police « Anton » ou une grasse condensée équivalente.

## Étape 3 — Relier au site
1. Copie l'URL de ta boutique (`https://ton-nom.printify.me`).
2. Ouvre **`merch.html`**, trouve la ligne :
   ```js
   const STORE_URL = "https://YOUR-STORE.printify.me";
   ```
   Remplace par ton URL. *(Optionnel : sur chaque bouton `Buy`, ajoute `data-url="lien-exact-du-produit"` pour pointer vers le bon produit.)*
3. Commit + push → le bouton **Buy** ouvre ta boutique. ✅

## Étape 4 (plus tard) — Designs supplémentaires
Les autres concepts du site (mug « Electrolytes », sticker « Champion », poster « Annual Report ») peuvent devenir de vrais produits : demande-moi de générer leurs fichiers d'impression quand tu veux.

---

### Spécs des designs (si tu les recrées dans l'éditeur Printify)

**« Survived the 69 »** (chandail noir)
- `SURVIVED` / `THE 69` — police Anton, blanc, « 69 » en jaune `#ffd60a`
- filet jaune, puis `WORLD SCORE · 2026` (Space Mono, gris)
- `BRAWNDO WON.` en rose `#ff2e63`

**« Idiocracy Was a Documentary »** (chandail rose ou blanc)
- pastille rouge + `REC`
- `IDIOCRACY` / `WAS A` (noir) / `DOCUMENTARY` (blanc contour noir)

**« It's Got What Voters Crave »** (chandail noir)
- `IT'S GOT` / `WHAT` en vert acide `#c6f135`
- `VOTERS` / `CRAVE` en blanc
- signature `— THE IDIOCRACY INDEX —`
