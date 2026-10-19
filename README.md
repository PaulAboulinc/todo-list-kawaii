# Mochi Todo 🍡

Une todo liste kawaii, sous forme de **PWA** (application web installable) : HTML/CSS/JS sans dépendances ni build.
Elle s'installe sur Android comme une vraie appli (icône, plein écran, fonctionne hors-ligne).

Les tâches sont stockées sur l'appareil (`localStorage`) : pas de compte ni de serveur.
Si tu désinstalles l'appli, les tâches sont perdues.

## Utilisation

- **Cocher** : la tâche est finie.
- **🌙** : « j'ai avancé, la suite demain ». La tâche passe *en cours*, compte comme une victoire du jour et revient le lendemain. Le compteur de jours d'effort s'affiche dessus.
- La barre de progression et Mochi suivent **la journée** : quand tout est fini ou mis « à demain », la journée est bouclée.
- Toucher le texte d'une tâche permet de le modifier.
- L'interface suit la langue de l'appareil : français, anglais, espagnol, portugais, allemand, italien, russe, japonais, chinois simplifié et coréen. Pour toute autre langue, elle s'affiche en anglais.

## Tester sur l'ordinateur

```sh
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000.

## Mettre l'appli sur Android

### 1. Aperçu rapide (même Wi-Fi)

Lance le serveur ci-dessus, puis ouvre `http://<IP-de-ton-PC>:8000` dans Chrome sur le téléphone.
L'appli fonctionne, mais Chrome n'autorise ni l'installation ni le mode hors-ligne sans HTTPS.

### 2. Installer comme une appli (recommandé)

1. Héberge le dossier en HTTPS, gratuitement :
   - [Netlify Drop](https://app.netlify.com/drop) : glisser-déposer le dossier, ou
   - GitHub Pages.
2. Ouvre l'URL dans **Chrome sur Android**, puis menu ⋮ → **Installer l'application**.

### 3. Générer un vrai fichier APK

1. Va sur [PWABuilder](https://www.pwabuilder.com) et colle l'URL HTTPS.
2. *Package for stores* → **Android**. Tu obtiens un zip contenant :
   - un `.apk` à installer directement sur le téléphone,
   - un `.aab` pour le Play Store,
   - la **clé de signature**. Garde-la précieusement, elle est indispensable pour publier des mises à jour, et ne la committe jamais.
3. Pour que l'APK n'affiche pas de barre d'adresse, dépose le fichier `assetlinks.json` fourni dans le dossier `.well-known/` du site.

## Mettre à jour

Après une modification, incrémente `CACHE` dans `sw.js` (par exemple `mochi-todo-v2` → `mochi-todo-v3`) puis redéploie.
Sinon, les téléphones garderont l'ancienne version en cache.
L'appli se recharge d'elle-même dès que la nouvelle version est prise en compte.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page et mascotte Mochi (SVG) |
| `style.css` | Thème pastel (clair et sombre automatiques) |
| `app.js` | Logique : ajout, édition, filtres, sauvegarde |
| `i18n.js` | Textes de l'interface dans chaque langue |
| `sw.js` | Service worker pour le mode hors-ligne |
| `manifest.webmanifest` | Nom, couleurs et icônes pour l'installation |
| `icons/` | Icône source `icon.svg` et PNG 192/512 générés à partir de celle-ci |
