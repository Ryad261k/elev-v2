# ÉLEV v2 — État du projet

> Dernière mise à jour : 2026-03-28

---

## ✅ Fonctionnalités implémentées

### Architecture & Infra
- [x] Structure modulaire JS vanilla (21 fichiers JS, zéro dépendance npm)
- [x] Supabase Auth + client wrapper (`supabase.js`)
- [x] PWA : `manifest.json` + service worker (`sw.js`)
- [x] Offline support : queue d'actions + sync au retour réseau (`offline.js`)
- [x] Router SPA tabs + état global `AppState` (`app.js`)
- [x] Thème dark/light toggle (dark par défaut)
- [x] Design system v2 glass-morphism (base.css, components.css, animations.css)

### Accueil (home.js)
- [x] Salutation + sous-titre rotatif motivationnel
- [x] Ring SVG kcal animé (90px, stroke-dashoffset)
- [x] Barres macros (P/G/L)
- [x] Carte séance du jour (en cours ou terminée)
- [x] Carte prochaine routine suggérée
- [x] Stats 3 colonnes : séances semaine / poids / séances mois
- [x] Badge streak jours consécutifs
- [x] Actions rapides : ajouter repas / voir historique

### Séance — Workouts (workouts.js)
- [x] Picker de routine v2 (cartes featured)
- [x] Démarrage de séance + timer MM:SS (badge orange)
- [x] Barre de progression exercices
- [x] Cards exercice v2 (exercise-card-v2, numérotation circulaire)
- [x] Tableau sets grid 4 colonnes (28px 1fr 1fr 36px)
- [x] Warmup auto-calculé (50%×12 / 70%×6 / 85%×3) — jamais sauvegardé
- [x] Swipe-to-delete sur les sets
- [x] Validation set → état done (vert), PR → badge 🏆 or
- [x] Méthodes : AMRAP, Drop Set, Superset
- [x] Champ notes par exercice
- [x] Minuteur de repos auto après chaque set (rest-timer.js)
- [x] Fin de séance → récapitulatif (durée, sets, volume, PRs)
- [x] Note Coach IA post-séance (3 phrases analyse)
- [x] Autre sport / activité
- [x] `startRoutine(id)` exporté pour appel depuis routines.js

### Routines (routines.js)
- [x] Liste routines v2 (featured card en vert pour la première)
- [x] Créer / modifier / supprimer routine
- [x] Ajout exercices depuis bibliothèque
- [x] Réordonnancement exercices (up/down)
- [x] Remplacement exercice
- [x] Menu contextuel (Dupliquer / Supprimer)
- [x] Démarrer routine → switch tab workouts

### Nutrition (nutrition.js + food-picker.js + fooddb.js)
- [x] Ring SVG calories 100px (stroke-dasharray 251)
- [x] Barres macros P/G/L avec objectifs
- [x] Journal repas : ajout / suppression aliments
- [x] Affichage repas v2 (meal-card-v2, food-row-v2 avec colonnes P/G/L)
- [x] Navigation jour précédent/suivant
- [x] Recherche aliments (base Ciqual FR + USDA intégrée)
- [x] Scan code-barre Open Food Facts (barcode.js)
- [x] Recettes avec ratio cru/cuit (recipes.js)
- [x] Objectifs caloriques/macros éditables
- [x] Hydratation : objectif + boutons raccourcis + barre progression

### Poids & Mesures (weight.js + weight-chart.js)
- [x] Saisie poids du jour
- [x] Graphique évolution (ligne lissée + points)
- [x] Moyenne mobile 7 jours
- [x] Filtres 1S / 1M / 3M / 6M / 1A / Tout
- [x] Mesures corporelles (taille, poitrine, hanches, bras, cuisses, mollets)
- [x] IMC + interprétation
- [x] Delta vs hier + delta vs début du mois

### Historique (history.js)
- [x] Calendrier mensuel avec jours actifs surlignés
- [x] Liste 50 dernières séances avec détail sets/volume
- [x] Navigation mois précédent/suivant

### Stats (stats.js)
- [x] Records personnels (PRs) par exercice
- [x] Progression 1RM estimée (formule Epley)
- [x] Volume par groupe musculaire (barres)
- [x] Filtres 1RM par exercice
- [x] Tendances nutrition (calories/macros sur 7/30j)
- [x] Heatmap séances (style GitHub)

### Coach IA (coach.js)
- [x] Interface chat bottom sheet
- [x] Contexte enrichi (profil, historique, PRs, nutrition)
- [x] `quickAsk` pour analyse post-séance
- [x] Réponses en français

### Onboarding (onboarding.js)
- [x] 9 écrans : prénom → objectif → niveau → poids → taille/âge/sexe → jours/semaine → matériel → TDEE → programme suggéré
- [x] Calcul TDEE automatique

### Profil (profile.js)
- [x] Stats globales (séances totales, volume total, streak record)
- [x] Édition objectifs
- [x] Paramètres : unités (kg/lbs), thème, notifications
- [x] Déconnexion

---

## ❌ Manquant / Non implémenté

### Fonctionnalités prompt non faites
- [ ] **Reconnaissance photo aliments** (upload photo → IA identifie) — nécessite API vision
- [ ] **Rapport hebdomadaire IA automatique** (bilan du dimanche)
- [ ] **Notifications proactives IA** (stagnation détectée, déséquilibre push/pull, etc.)
- [ ] **Graphiques nutrition hebdo** (barres calories par jour sur 7 jours) dans l'onglet nutrition
- [ ] **Corrélation poids/calories** (graphique combiné dans Stats)
- [ ] **Taux de complétion programme** (stats régularité)
- [ ] **Templates de programmes** (Push/Pull/Legs, Full Body, etc. prédéfinis)
- [ ] **Partage post-séance** (screenshot stylisé)
- [ ] **Export données** (CSV/JSON depuis Profil)
- [ ] **Pull-to-refresh** custom (indicateur animé logo ÉLEV)
- [ ] **Transition slide horizontal** entre onglets (swipe tactile)
- [ ] **Photos de progression** (stockage local, onglet Poids)
- [ ] **Repas rapide** (répliquer un repas passé d'un clic)
- [ ] **Favoris aliments** dans food-picker

### UI/UX prompt non faits
- [x] `prefers-reduced-motion` : désactiver animations si préférence système activée ✅
- [x] Skeleton loaders : présents sur home, history, stats ✅
- [x] Transitions de page : slide horizontal entre tabs (tab-enter-right/left) ✅
- [x] Pull-to-refresh : implémenté (ptr-indicator + touchstart/end) ✅
- [ ] Validation temps réel inputs (icône ✓/✗ à droite)
- [ ] Erreurs formulaires sous les champs (pas d'alert())
- [ ] States hover/active/loading/disabled formalisés sur tous les boutons
- [ ] Feedback haptique `vibrate(6)` sur ajout aliment (actuellement absent)
- [ ] Swipe horizontal onglets (navigation par geste tactile)

---

## 🐛 Bugs connus

| # | Fichier | Description | Sévérité |
|---|---------|-------------|----------|
| 1 | `app.js` | ~~Toggle thème bogué~~ — **CORRIGÉ** : dark = pas d'attribut, light = `data-theme="light"` | ✅ |
| 2 | `animations.css` | ~~`tab-enter-right/left` et `.ptr-indicator` référencés JS mais pas définis CSS~~ — **CORRIGÉ** | ✅ |
| 3 | `workouts.js` | 564 lignes — dépasse la limite CLAUDE.md de 400 lignes | Faible |
| 4 | `routines.js` | `showRoutineMoreMenu` utilise un setTimeout de 50ms pour remplacer le handler du bouton Annuler afin d'y mettre "Dupliquer" — hack fragile | Moyen |
| 5 | `coach.js` | Si la clé API n'est pas configurée, `quickAsk` rejette silencieusement sans feedback utilisateur clair | Faible |
| 6 | `nutrition.js` | Ring SVG id `nutrition-ring` dans HTML mais `updateMacroDisplay()` cherche cet id — vérifier correspondance | À vérifier |
| 7 | `home.js` | Streak calculation : si l'utilisateur s'est entraîné aujourd'hui ET hier mais pas avant, le streak est calculé à 2 (correct) mais si la séance d'aujourd'hui n'est pas encore terminée (`ended_at` null), elle n'est pas comptée | Faible |
| 8 | `workouts.js` | `buildExerciseCard` : exIdx passe en paramètre mais si appelé depuis un autre contexte sans index, `(exIdx \|\| 0) + 1` donnera toujours 1 | Faible |
| 9 | `css/components.css` | 3679 lignes — fichier CSS très lourd, pas de séparation par module | Faible |
| 10 | `history.js` | L'onglet "Historique" cumule historique + stats, ce qui crée une navigation confuse (stats.js rendu dans tab-history) | UX moyen |

---

## 🔜 Priorités recommandées

### P1 — Bugs bloquants
1. Corriger le toggle thème (bug #1 et #2)
2. Vérifier le ring SVG nutrition (bug #6)

### P2 — Features à fort impact
1. `prefers-reduced-motion` dans animations.css (accessibilité)
2. Skeleton loaders sur historique + stats
3. Graphique nutrition semaine (barres calories/j)
4. Transition slide horizontal entre onglets

### P3 — Polish
1. Favoris aliments dans food-picker
2. Repas rapide (répliquer repas passé)
3. Export CSV données
4. Partage post-séance

---

## 📁 Structure fichiers

```
elev-v2/
├── index.html           — Structure SPA, 6 tabs (home/workouts/routines/nutrition/weight/history)
├── manifest.json        — PWA config
├── sw.js                — Service Worker (cache statique)
├── STATUS.md            — Ce fichier
├── css/
│   ├── base.css         — Variables, reset, layout, grain overlay (258 lignes)
│   ├── components.css   — Tous les composants (3679 lignes — à découper un jour)
│   └── animations.css   — Keyframes, transitions (264 lignes)
└── js/
    ├── supabase.js      — Client Supabase + auth helpers (90 lignes)
    ├── app.js           — Router, AppState, thème, toast, confirm (461 lignes)
    ├── utils.js         — Fonctions utilitaires partagées (62 lignes)
    ├── home.js          — Dashboard accueil (301 lignes)
    ├── workouts.js      — Séances en cours (564 lignes ⚠️ > 400)
    ├── routines.js      — Gestion routines (482 lignes ⚠️ > 400)
    ├── nutrition.js     — Journal nutritionnel (431 lignes ⚠️ > 400)
    ├── food-picker.js   — Recherche + ajout aliments (480 lignes ⚠️ > 400)
    ├── fooddb.js        — Base de données aliments FR (136 lignes)
    ├── recipes.js       — Recettes (247 lignes)
    ├── weight.js        — Poids & mesures (309 lignes)
    ├── weight-chart.js  — Graphique poids (146 lignes)
    ├── stats.js         — Stats & PRs (391 lignes)
    ├── history.js       — Historique séances (370 lignes)
    ├── coach.js         — Coach IA (331 lignes)
    ├── onboarding.js    — Onboarding 9 écrans (306 lignes)
    ├── profile.js       — Profil utilisateur (203 lignes)
    ├── barcode.js       — Scan code-barre (175 lignes)
    ├── rest-timer.js    — Minuteur de repos overlay (120 lignes)
    ├── swipe.js         — Swipe-to-delete générique (115 lignes)
    └── offline.js       — Queue offline + sync (98 lignes)
```
