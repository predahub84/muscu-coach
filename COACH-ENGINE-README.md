# Muscu Coach — moteur adaptatif + stockage relationnel V1.1

Cette version part du projet actuellement déployé et ajoute le moteur de coaching déterministe ainsi que le branchement réel aux nouvelles tables Supabase.

## Fichiers ajoutés

- `coach-domain.js` : schémas, normalisation, validateurs et politiques versionnées.
- `coach-engine.js` : `generateMassGainProgram()` déterministe, sans IA.
- `coach-storage.js` : miroir local + repository Supabase relationnel + réconciliation.
- `supabase-coach-schema.sql` : migration additive des tables de coaching.

## Tables utilisées

- `coach_programs` : programmes générés.
- `coach_weekly_reviews` : bilans hebdomadaires.
- `coach_progression_events` : événements de progression exercice par exercice.
- `coach_notebooks` reste actif comme sauvegarde atomique du carnet actuel pendant la transition.

## Ce qui est branché maintenant

- Un programme généré avec `persist: true` est enregistré dans le carnet actuel puis envoyé dans `coach_programs` si l'utilisateur est connecté.
- Un bilan hebdomadaire créé via l'API est enregistré dans le carnet puis dans `coach_weekly_reviews`.
- À chaque séance terminée, les propositions de charge (hausse, maintien, réduction) créent un événement local et sont envoyées dans `coach_progression_events`.
- À la connexion, l'app réconcilie le miroir local avec les trois tables relationnelles puis repousse les éléments manquants. Les opérations sont idempotentes par identifiant.
- Le bouton de synchronisation du compte force également une réconciliation relationnelle.

## Règles du moteur

- `gainPace` UI (`controlled | normal | aggressive`) est converti en cible numérique `% du poids corporel / semaine`.
- `targetDate` est facultative ; une échéance trop agressive produit un avertissement.
- Les priorités musculaires ont `rank` + `importance` (1 à 5).
- Une seule source de vérité pour le repos : `restSeconds`.
- Les politiques de progression sont versionnées : increase / maintain / reduce / recalibrate.
- Une machine ou variante différente garde son propre `exerciseId` et sa propre calibration.
- Le générateur reçoit la bibliothèque réelle de l'application ; aucune seconde bibliothèque n'est créée.

## API disponible dans l'app

```js
const preview = MuscuCoachAppAPI.generateMassGainProgram(input, { persist: false });
const saved = MuscuCoachAppAPI.generateMassGainProgram(input, { persist: true });

MuscuCoachAppAPI.saveWeeklyReview(review);
MuscuCoachAppAPI.recordProgressionEvent(event);
await MuscuCoachAppAPI.syncCoachingRelational();
```

Pour le diagnostic de connexion :

```js
MuscuCoachCloudAPI.isSignedIn();
MuscuCoachCloudAPI.isRelationalReady();
await MuscuCoachCloudAPI.syncCoaching();
```

## Étape suivante

Construire l'écran d'onboarding/génération : profil, objectif, poids cible, rythme de prise de masse, disponibilité, priorités musculaires et contraintes, puis appliquer le programme généré à l'interface Programme/Séance.
