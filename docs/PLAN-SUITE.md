# Plan de la suite (proposé le 2026-11-26, à valider avec Thomas)

> Écrans restants (Interventions, Impôts, États des lieux) et hébergement. Les numéros de cases et de lignes
> fiscales sont **à vérifier sur la notice officielle de l'année** avant de les afficher : ils changent d'une année
> à l'autre (ceux de la maquette ne correspondent pas tous à la 2044 actuelle).

## Ordre proposé

| # | Étape | Pourquoi à ce moment | Taille |
|---|---|---|---|
| 1 | **Interventions** (travaux) — faites le 2026-11-28 | Petit écran, et il alimente les impôts (travaux déductibles, amortissements) | 1 session |
| 2 | **Impôts : location nue et micro-BIC** | Aide à la saisie de la 2042 / 2044 / 2042-C-PRO à partir des loyers, charges et travaux | 1 à 2 sessions |
| 3 | **Impôts : LMNP au réel** (si un bien est concerné) | Amortissements et liasse 2031 / 2033 : le plus technique | 2 sessions ou plus |
| 4 | **Mise en ligne** (hébergement, HTTPS, durcissement) | Prérequis à la signature à distance des états des lieux et au retour https de la banque | 1 à 2 sessions |
| 5 | **États des lieux** | Le plus gros morceau : saisie pièce par pièce, photos, PDF, validation par les deux parties | 3 sessions ou plus |

Les étapes 3 et 5 peuvent s'inverser selon le besoin réel (un bien au réel LMNP ? une entrée ou une sortie de
locataire prochaine ?).

## 1. Interventions

Liste des travaux d'un bien, réalisés par le propriétaire ou par un professionnel.
- **Modèle `Intervention`** (nouvelle migration) : bien, bail facultatif, intitulé, type (plomberie, électricité,
  chauffage, peinture, menuiserie, serrurerie, nettoyage, remise en état, sinistre, jardinage, autre — liste de la
  maquette), date, état (prévue / faite), **réalisée par** (moi / professionnel), nom du prestataire, coût, **payée
  par** (propriétaire / locataire / assurance), notes.
- **Nature fiscale**, qui décide du traitement aux impôts : entretien et réparation / amélioration (déductibles en
  location nue) / construction, reconstruction, agrandissement (non déductibles en nu ; immobilisés et amortis en
  LMNP au réel). Choix proposé par défaut selon le type, modifiable.
- **Travaux faits soi-même** : la main-d'œuvre du propriétaire n'est jamais déductible ; pour les matériaux, règle à
  confirmer (BOFiP) et à afficher en aide.
- Factures et devis : rattachés via `Document` (nouvelle catégorie, lien `interventionId`).
- Écran « Interventions » (liste, filtres par bien / type / année, total des dépenses), bloc « Interventions liées »
  dans la fiche du bail et du bien (comme la maquette). Données de démo `demo-interventions.ts`.

## 2. et 3. Impôts

Objectif : pour une année et **par propriétaire** (quote-part datée, ARCHITECTURE.md § 5.1), afficher les montants à
reporter selon le régime du bien, avec le détail qui les justifie, et un export PDF récapitulatif.

| Régime | Déclaration | Ce que calcule l'application |
|---|---|---|
| Location nue, **micro-foncier** (recettes ≤ 15 000 € pour le foyer, abattement 30 %) | 2042, case 4BE | Loyers bruts encaissés (hors charges récupérables) |
| Location nue, **réel** | 2044 (par bien), report 4BA / 4BB / 4BC sur la 2042 | Recettes (l. 211…), frais de gestion, assurance, travaux déductibles (interventions), taxe foncière, provisions de copropriété et régularisation, intérêts d'emprunt ; déficit foncier imputable (plafond 10 700 €) et reports |
| **LMNP micro-BIC** | 2042-C-PRO (case 5ND pour la longue durée) | Recettes ; abattement et seuil selon le type de meublé (longue durée, tourisme classé ou non) |
| **LMNP réel** | **Liasse 2031-SD + annexes 2033-A à G**, puis 2042-C-PRO (bénéfice / déficit) | Compte de résultat, immobilisations et amortissements par composants, déficits et amortissements reportables |
| Pinel, Denormandie, Loc'Avantages | Revenus fonciers (comme la location nue) + réduction d'impôt sur la 2042-C | Montant de la réduction de l'année |

Points structurants :
- **Régime par bien et par année**, voire par copropriétaire (décision en attente) : `FiscalRegime` à compléter
  (micro-foncier / réel, LMNP micro / réel, type de meublé, Denormandie, Loc'Avantages).
- **Emprunts** (nouveau modèle) : intérêts et assurance emprunteur de l'année, déductibles au réel.
- **Liasse fiscale LMNP au réel** : elle ne se dépose pas sur l'espace particulier d'impots.gouv mais par
  **télédéclaration EDI-TDFC** (via un service en ligne ou un comptable). L'application prépare les chiffres de la
  2031 et des 2033 (récapitulatif PDF + export) à recopier dans ce service ; elle ne dépose pas elle-même.
  Il faut : prix d'acquisition, frais d'achat, part du terrain (non amortissable), répartition par composants
  (gros œuvre, toiture, installations, agencements) et durées, mobilier, travaux immobilisés ; écritures de
  l'année (`LmnpEntry`, déjà prévu) ; amortissements reportés (ils ne peuvent pas créer de déficit).
- Rappels : calendrier de déclaration (notification en avril–mai), CFE pour le LMNP.
- Seuils, taux et cases dans une table de paramètres **par année fiscale**, pas en dur dans le code.

## 5. États des lieux

Document rattaché à un bail (entrée ou sortie), validé par le propriétaire et le locataire.
- **Contenu obligatoire** (décret 2016-382) : type, date, adresse du logement, nom et domicile des parties (et
  nouvelle adresse du locataire à la sortie), relevés des compteurs, clés remises (nombre, type), description pièce
  par pièce des sols, murs, plafonds et équipements avec leur état, signatures. À la sortie : comparaison avec l'entrée.
- **Saisie** pensée pour le téléphone ou la tablette, sur place : pièces à partir d'un modèle selon le type de bien,
  éléments avec état (neuf / bon / usage normal / mauvais) et commentaire, **photos** prises directement. L'état des
  lieux de sortie est pré-rempli à partir de celui d'entrée, avec les écarts mis en évidence.
- **Validation par les deux parties**, deux façons :
  1. **Sur place** : chacun signe à l'écran (signature tracée) → PDF figé, horodaté, avec son empreinte ; plus
     aucune modification possible.
  2. **À distance** : lien personnel envoyé par e-mail au locataire (sans compte), qui relit, signe ou fait des
     remarques. Demande une application accessible sur Internet (étape 4).
  Signature électronique « simple » ; une signature avancée (prestataire français) reste possible plus tard.
- Délai légal : le locataire peut demander à compléter l'état des lieux d'entrée dans les 10 jours (et pour le
  chauffage, le premier mois de la période de chauffe) : prévoir l'ajout de remarques après signature.
- Le schéma contient déjà `Inventory*` (jamais utilisé) : à compléter (état brouillon / signé, compteurs, clés,
  signatures et dates, remarques du locataire, jeton du lien, empreinte du PDF).

## 4. Hébergement — proposition

**Recommandation : un serveur privé virtuel (VPS) chez un hébergeur français, dans un centre de données en France,
avec des sauvegardes chiffrées qui reviennent aussi sur le serveur de la maison.**

| | Serveur de la maison (Tailscale) | VPS chez un hébergeur français | Plateforme gérée française (PaaS) |
|---|---|---|---|
| Où sont les données | Chez soi | France, société française | France, société française |
| Risque de perte | Élevé sans copie ailleurs (disque, panne, incendie, vol) | Faible avec sauvegardes externes | Faible (sauvegardes de la base incluses) |
| Accès pour d'autres personnes | Inviter chacun sur Tailscale, ou exposer la box | Simple : HTTPS public, nom de domaine | Simple |
| Signature à distance, retour https de la banque | Difficile | Oui | Oui |
| Entretien | Box, courant, mises à jour | Mises à jour système (automatisables) | Presque aucun |
| Coût indicatif | Électricité | Quelques euros à ~10 € / mois | Plutôt 20 à 40 € / mois |

Exemples d'hébergeurs français : **OVHcloud** (VPS), **Scaleway** (VPS, stockage objet), **Clever Cloud** (PaaS,
PostgreSQL géré). Infomaniak est suisse, pas français. Éviter les hébergeurs américains (Cloud Act) pour des données
de locataires.

Mise en place prévue :
- Même `docker-compose.yml` qu'aujourd'hui (images GHCR), plus un proxy **Caddy** pour le HTTPS automatique
  (Let's Encrypt) sur un nom de domaine (~10 € / an).
- **Administration** du serveur seulement par Tailscale (SSH fermé sur Internet) ; seule l'application est publique.
- **Durcissement avant ouverture** (déjà listé dans ARCHITECTURE.md § 9) : `COOKIE_SECURE=true`, limitation des
  tentatives de connexion, en-têtes de sécurité, et idéalement double authentification (TOTP) pour les comptes.
- **Sauvegardes** quotidiennes (base `pg_dump` + `storage/`) chiffrées avec restic, vers un stockage objet chez un
  autre hébergeur français **et** vers le serveur de la maison ; restauration testée.
- Le serveur de la maison reste l'environnement de développement et de test (comme aujourd'hui).
- Les vraies données (banque principale, vrais biens) n'arrivent qu'à la fin, une fois tout cela en place.

## Réponses de Thomas (2026-11-26) et conséquences

1. **Régimes : LMNP et Pinel.** Priorités : LMNP (micro-BIC et réel, liasse 2031 / 2033) et Pinel (revenus fonciers
   + réduction d'impôt). La location nue « classique » reste possible ensuite (même calcul que Pinel, sans réduction).
2. **Un bien au LMNP réel** : à préciser à la reprise (qui fait la liasse aujourd'hui, éléments d'acquisition).
3. **Emprunts en cours** : modèle `Loan` nécessaire (intérêts et assurance de l'année, tableau d'amortissement importé ou saisi).
4. **États des lieux : signature sur place et à distance.** Proposition :
   - Signature tracée à l'écran **et** code à usage unique envoyé au locataire (e-mail, SMS plus tard) au moment de
     signer, sur place comme à distance ; dossier de preuve (horodatage, empreinte SHA-256 du PDF, adresse IP,
     appareil, adresse de réception du code) ; PDF envoyé aux deux parties aussitôt. C'est une signature
     électronique simple, admise pour un état des lieux (décret 2016-382 : support papier ou électronique).
   - Identité numérique publique (FranceConnect, France Identité) : réservée aux services habilités, pas réaliste ici.
   - Plus tard si besoin : signature avancée par un prestataire français (Yousign, payant), avec vérification de la
     pièce d'identité.
5. **Hébergement : meilleur rapport qualité / prix, gestion de la pile automatisée.** Proposition : **VPS OVHcloud**
   (gamme d'entrée, centre de données en France), sauvegardes restic chiffrées vers un **stockage objet Scaleway**
   (autre hébergeur français) et vers le serveur de la maison ; nom de domaine chez OVHcloud. Installation par un
   script (pare-feu, Tailscale, Docker, Caddy, mises à jour automatiques, sauvegardes planifiées) et déploiement par
   la CI (images GHCR, `prisma migrate deploy`). Tarifs à vérifier au moment de commander.
