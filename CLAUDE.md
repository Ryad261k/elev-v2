# Élev v2 — Gym & Nutrition Tracker

## Contexte projet
Application web progressive (PWA) de suivi musculation + nutrition, en français, pensée mobile-first.
Remplace Élev v1 (single-file HTML trop monolithique). L'utilisateur principal est Louis (louis.david650@gmail.com).

## Stack technique
- **Frontend** : HTML / CSS / JS vanilla — zéro framework, zéro dépendance npm
- **Backend** : Supabase (nouveau projet vierge) — URL et anon key à définir dans `js/supabase.js`
- **PWA** : manifest.json + service worker basique pour installabilité
- **Fonts** : DM Serif Display (italic pour titres) + DM Sans (corps de texte), via Google Fonts
- **Hébergement** : prévu pour GitHub Pages ou Netlify (fichiers statiques)

## Palette de couleurs (Soft Premium)
```css
--bg-dark:     #1a1a18;   /* fond principal sombre */
--bg-card:     #242420;   /* cartes */
--bg-surface:  #2e2e2a;   /* surfaces secondaires */
--cream:       #f5f0e8;   /* texte principal */
--cream-dim:   #b8b0a0;   /* texte secondaire */
--accent:      #7AB893;   /* vert accent (macros, progress) */
--accent-warm: #c8956c;   /* orange chaud (calories) */
--border:      #3a3a36;   /* séparateurs */
--radius:      12px;      /* border-radius cartes */
```

## Structure des fichiers
```
elev-v2/
├── index.html
├── manifest.json
├── sw.js                  ← service worker
├── css/
│   ├── base.css           ← reset, variables, typography
│   ├── components.css     ← cartes, boutons, inputs, modals
│   └── animations.css     ← transitions, swipe, loaders
├── js/
│   ├── supabase.js        ← init client Supabase + helpers auth
│   ├── app.js             ← router SPA, navigation tabs, état global
│   ├── workouts.js        ← séances, exercices, sets, warmup
│   ├── routines.js        ← création/édition routines
│   ├── nutrition.js       ← repas, calories, macros du jour
│   ├── recipes.js         ← recettes, ratio cru/cuit
│   ├── history.js         ← historique séances + calendrier
│   └── stats.js           ← graphiques, records, progression
└── icons/                 ← icônes PWA (192x192, 512x512)
```

## Architecture JS — Règles absolues
- **Aucun fichier JS ne dépasse 400 lignes** — si ça déborde, extraire dans un sous-module
- **État global dans `app.js`** uniquement : `window.AppState = { user, currentTab, ... }`
- **Chaque module exporte ses fonctions** via `window.Workouts = { ... }` etc. (pas d'import/export ES6, compatibilité maximale)
- **Toutes les requêtes Supabase passent par des fonctions wrapper** dans le module concerné — jamais d'appel `.from()` direct dans le HTML ou dans `app.js`
- **Gestion d'erreurs systématique** : chaque appel async dans un try/catch, erreur loggée + feedback UI

## Tabs de navigation (ordre)
1. 🏠 Accueil — résumé du jour (séance + nutrition)
2. 💪 Séance — démarrer/suivre une séance en cours
3. 📋 Routines — gérer ses routines
4. 🥗 Nutrition — repas + macros du jour
5. 📊 Historique — calendrier + stats

## Fonctionnalités clés — Séances
- Sélectionner une routine → lancer la séance
- Pour chaque exercice : afficher sets, reps, poids ; afficher les perfs de la session précédente
- Warmup auto-calculé (50%×12, 70%×6, 85%×3 du poids de travail) — sets warmup JAMAIS sauvegardés comme sets de travail
- Bouton "note" pour ajouter une note à l'exercice
- Swipe-to-delete sur les sets (bug connu dans v1 à corriger proprement)
- "Autre sport" → modal durée + type d'activité
- Fin de séance → sauvegarde + résumé

## Fonctionnalités clés — Nutrition
- Ajouter des repas (aliments + quantité)
- Calcul auto calories + macros (protéines, glucides, lipides)
- Barres de progression macros en `--accent` (#7AB893)
- Rings SVG de progression repas
- Navigation jour précédent/suivant
- Système de recettes avec ratio cru/cuit

## Fonctionnalités clés — Routines
- Créer/éditer/supprimer des routines
- Ajouter des exercices depuis une bibliothèque
- Réordonner les exercices (drag ou boutons up/down)
- Remplacer un exercice dans une routine existante

## Schema Supabase (tables à créer)
```sql
-- Exercices (bibliothèque globale)
exercises (id, name, muscle_group, equipment, created_at)

-- Routines utilisateur
routines (id, user_id, name, created_at)
routine_exercises (id, routine_id, exercise_id, order_index, sets, reps, weight)

-- Séances
sessions (id, user_id, routine_id, started_at, ended_at, notes)
session_sets (id, session_id, exercise_id, set_number, reps, weight, is_warmup, created_at)

-- Nutrition
meals (id, user_id, date, name, created_at)
meal_items (id, meal_id, food_name, quantity_g, calories, protein, carbs, fat)
recipes (id, user_id, name, raw_cooked_ratio, created_at)
recipe_ingredients (id, recipe_id, food_name, quantity_g, calories, protein, carbs, fat)
```

## Règles UI/UX — Mobile first
- Tout est conçu pour **375px de large minimum** (iPhone SE)
- Les overlays/modals ont toujours un backdrop semi-transparent cliquable pour fermer
- **z-index hiérarchie stricte** : contenu=1, navbar=10, overlay-backdrop=100, modal=200, toast=300
- Jamais deux overlays ouverts en même temps
- Les listes longues utilisent la virtualisation légère (ne render que les items visibles)
- Feedback visuel immédiat sur chaque action (loader, toast, vibration si dispo)
- Swipe gestures gérées proprement avec pointerId (pas de touche brute)

## Ce qu'on NE fait PAS (leçons de v1)
- ❌ Pas de logique métier dans le HTML inline
- ❌ Pas de `setTimeout` pour corriger des bugs de timing — résoudre la cause racine
- ❌ Pas de `!important` dans le CSS sauf exception documentée
- ❌ Pas de variables globales en vrac — tout dans `AppState`
- ❌ Pas de duplication de code entre modules — factoriser dans `app.js` ou un `utils.js`

## Workflow de développement recommandé
1. Construire `index.html` + `css/base.css` + navigation tabs vide en premier
2. Brancher Supabase (`js/supabase.js`) + auth
3. Module `workouts.js` (cœur de l'app)
4. Module `nutrition.js`
5. Module `routines.js`
6. Module `history.js` + `stats.js`
7. PWA (manifest + service worker) en dernier

## Commandes utiles
```bash
# Lancer un serveur local
python3 -m http.server 8080
# ou
npx serve .
```
