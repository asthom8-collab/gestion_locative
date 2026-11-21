# Avancement du projet

> Journal de bord : il sert de mémoire entre les sessions. On le met à jour à chaque étape stabilisée, l'entrée la plus récente en haut du journal.
> La description technique (composants, API, **modèle de données**, règles métier, tests) est dans [ARCHITECTURE.md](ARCHITECTURE.md).

## ▶ Reprise (à lire en premier) — état au 2026-11-21

### Où en est le code
- `main` contient la phase 2, la refonte du front, le multipropriétaires et la phase 4 (validés à la main par Thomas le 2026-11-21).
- `npm run verify` passe : 102 tests API, 67 tests front (branche `phase4b-notifications`).

### Comment relancer l'environnement de test à distance
Thomas est souvent en SSH, accès par Tailscale :
```bash
docker compose up -d db                                   # base de dev (port 5433)
cd apps/api && PORT=3002 npm run dev                      # API de dev (code de la branche courante)
cd apps/web && API_URL=http://localhost:3002 npx vite --port 5176 --strictPort --host <IP_TAILSCALE>
```
Puis ouvrir `http://<IP_TAILSCALE>:5176` (adresse : `tailscale ip -4`). Compte du seed : `admin@local.dev` / `changeme`.
Sur une autre base : `npx prisma migrate deploy` dans `apps/api`.
Les conteneurs (port 5175) sont encore en version d'avant la phase 2 (blocage AppArmor, il faut `sudo snap restart docker`) ;
ils ont besoin de `SESSION_SECRET` dans le `.env` de la racine (déjà ajouté sur cette machine).

### Prochaines étapes, dans l'ordre
0. Phase 4 bis sur la branche locale `phase4b-notifications` (section Phase 4 bis).
1. Remplacer les conteneurs (`sudo snap restart docker` par Thomas, puis `docker compose up -d --build`), avec `SESSION_SECRET`.
3. Suite de la feuille de route : phase 3 (rapprochement bancaire) ou phase 4 (charges, IRL), en gardant en tête la
   répartition par quote-part pour les impôts (ARCHITECTURE.md § 5.1). Écrans de la maquette pas encore faits :
   Paiements, Synchro bancaire, Impôts, Interventions, Documents, États des lieux, dossier locataire.

### Décisions en attente (à poser à Thomas le moment venu)
- Impôts : quote-part figée par année fiscale (historique) ou appliquée telle quelle à l'export ? (phase 5)
- Régime fiscal par copropriétaire (sur `Ownership`) si deux copropriétaires ont des régimes différents ?
- Interventions, colocation, dépôt de garantie, autres types de bien et régimes de la maquette : nouveaux modèles à créer (ARCHITECTURE.md § 4.3).
- Purge des anciens commits sur GitHub (`5424658`, `44e1a9c`, encore accessibles par leur identifiant) : demande au support GitHub si Thomas le souhaite.

### Règles à garder en tête
- Dépôt **public** : aucun détail du réseau, de la famille ou des locataires dans le dépôt (placeholders `<IP_TAILSCALE>`).
- `sudo` impossible depuis Claude : pour un outil manquant, passer par un conteneur Docker jetable.
- La maquette de Thomas est sur le partage de la box : chemin dans la mémoire locale de Claude, pas ici.

## État actuel (2026-11-21)

### Fait
- **Axe 1 / socle** : CRUD pour les **biens** (`/api/properties`), les **locataires** (`/api/tenants`) et les **baux** (`/api/leases`, avec en plus `GET /property/:propertyId` et `POST /:id/terminate`). Endpoint `/health`.
- **Front** : Dashboard, Biens, Locataires, Baux. Layout avec Sidebar sur desktop et BottomNav sur mobile, manifest PWA.
- **Schéma Prisma complet** déjà en place (migration `init`), y compris pour les phases à venir : RentPayment/Receipt, BankTransaction, Charge/ChargeRegularization, IrlIndex, LmnpEntry, Document, Inventory (pièces, éléments, photos), User/Ownership (copropriété avec quote-part).
- **Industrialisation** : dépôt git, CI GitHub Actions (compilation, tests et images Docker publiées sur GHCR), `.dockerignore`, CLAUDE.md et ce fichier.
- **Tests automatisés** : 70 tests d'intégration API (Vitest + Supertest sur base `_test`, dont contrat API ↔ front, droits et sessions) et 48 tests front (Vitest + Testing Library). `npm run verify` à la racine = build + tests des deux apps.
- **Phase 2** (loyers, quittances PDF, Paramètres) : livrée sur `main`.
- **Refonte du front d'après la maquette** : étapes 1 à 4, sur `main` (voir plus bas).
- **Multipropriétaires** : connexion, données filtrées par propriétaire, copropriété, signatures , sur `main`, voir plus bas.

### Tester à distance (Thomas travaille souvent en SSH)
- La machine est dans le réseau Tailscale de Thomas (adresse : `tailscale ip -4`, notée ici `<IP_TAILSCALE>`). On lance l'API de dev sur un autre port que le conteneur, et Vite en l'écoutant **uniquement sur l'adresse Tailscale** :
  `PORT=3002 npm run dev` (dans `apps/api`) et `API_URL=http://localhost:3002 npx vite --port 5176 --strictPort --host <IP_TAILSCALE>` (dans `apps/web`).
  On ouvre ensuite http://<IP_TAILSCALE>:5176 depuis le PC ou l'iPhone. Sans Tailscale : `ssh -L 5176:<IP_TAILSCALE>:5176 <utilisateur>@<machine>`.
- `API_URL` (dans `vite.config.ts`) choisit la cible du proxy `/api` (par défaut `http://localhost:3001`).

### Pas encore fait / points d'attention
- **Avant une exposition sur Internet** : HTTPS puis `COOKIE_SECURE=true`, limitation des tentatives de connexion, en-têtes de sécurité dans nginx.
- `SESSION_SECRET` est obligatoire pour le conteneur `api` : il est dans le `.env` de la racine sur la machine de dev (à générer ailleurs avec `openssl rand -hex 32`).
- **Docker (snap) et AppArmor** : `docker compose up -d --build` échoue sur `cannot stop container: permission denied` (AppArmor `docker-default` refuse les signaux de `snap.docker.dockerd`). Les anciens conteneurs `api`/`web` tournent encore. Il faut un `sudo` (voir le journal du 2026-11-20).
- Racine : `package.json` contient des devDependencies inutilisées (`typescript ^7`, `@types/node ^26`), à nettoyer.

### Feuille de route (d'après le schéma)
| Phase | Contenu | Modèles |
|---|---|---|
| 2 | Loyers et quittances PDF (**développée**, voir plus bas) | RentPayment, Receipt |
| 3 | Rapprochement bancaire | BankTransaction |
| 4 | Charges, régularisation, révision IRL | Charge, ChargeRegularization, IrlIndex |
| 5 | Comptabilité LMNP | LmnpEntry |
| US-04 | Documents (bail, locataire) | Document |
| US-22 à 25 | États des lieux d'entrée et de sortie (photos, signatures, PDF) | Inventory* |

> La numérotation des phases et des US vient des commentaires du schéma. À confirmer ou compléter avec Thomas (l'historique de la conversation précédente n'est pas disponible).

## Phase 4 bis (notifications, charges par trimestre, quotes-parts datées) : en cours (branche `phase4b-notifications`)

Demandes de Thomas (2026-11-21) : notifier les propriétaires, selon leurs quotes-parts, avant la date anniversaire des baux
pour préparer la communication au locataire ; détailler les charges par trimestre pour le prorata lors d'un changement de
propriétaire. Décisions de Thomas : canaux **application + e-mail + téléphone** ; délai **réglable, 60 jours par défaut** ;
**quotes-parts datées**.

Choix de Claude (à valider) :
- Téléphone : **ntfy** (application gratuite, notifications push) et **SMS Free Mobile** (option gratuite des abonnés), au choix de chacun dans Paramètres.
- E-mail : SMTP configuré dans le `.env` de l'API (`SMTP_HOST`…, ex. Gmail + mot de passe d'application) ; sans SMTP, pas d'e-mail (l'essai le dit).
- Rappel : un par propriétaire et par anniversaire, envoyé aux propriétaires **à la date anniversaire**, tâche au démarrage puis toutes les 6 h.
- Un ancien propriétaire garde l'accès au bien (historique) ; une seule période de détention par propriétaire et par bien.

Avancement :
- [x] Migration `20261121200000_notifications_quotes_parts` (appliquée sur la base de dev).
- [x] API : quotes-parts datées (`checkTimeline`), charges par trimestre (régularisation au prorata de chaque période), `GET /api/charges/allocation`,
  notifications (`/api/notifications`, préférences dans `/api/me`, essai), rappels de révision. Tests : 102 API.
- [x] Front : cloche et page Notifications, section Notifications dans Paramètres, dates dans la fenêtre Propriétaires,
  trimestre et répartition entre propriétaires sur la page Charges, détail par période dans la régularisation. Tests : 67 front.
- [ ] **Test par Thomas** : Paramètres → Notifications (sujet ntfy et/ou SMS, « Envoyer un essai ») ; un bail dont l'anniversaire tombe
  dans les 60 jours (rappel au redémarrage de l'API ou dans les 6 h) ; fenêtre Propriétaires avec des dates ; charges par trimestre.
- [ ] Pour l'e-mail : choisir un SMTP (ex. Gmail + mot de passe d'application) et le mettre dans `apps/api/.env` (jamais dans le dépôt).
- [ ] Puis fusion dans `main` et push.

## Phase 4 (charges et IRL) : livrée sur `main` (2026-11-21)

Choix retenus (Claude, à valider par Thomas) :
- **IRL** : indices saisis à la main (table `IrlIndex`, commune à tous ; pas de valeurs inventées). Révision une fois par an,
  à l'anniversaire du bail (ou de la dernière révision) : nouveau loyer = loyer × IRL du même trimestre (le plus récent) / IRL de référence,
  arrondi au centime ; on peut appliquer moins, jamais plus. Historique dans `RentRevision` ; seule la dernière s'annule.
  Une révision en cours de mois est proratisée au jour (`rentAt` dans `lib/period.ts`). Les échéances non payées concernées sont recalculées.
  Avis de révision en PDF (signatures des bailleurs) + lien « messagerie » comme dans la maquette.
- **Charges** : `Charge` = charges récupérables réelles d'un bien pour une année. Régularisation d'un bail pour une année :
  charges réelles × jours occupés / jours de l'année, moins les provisions appelées (échéances générées de l'année) ;
  mois sans échéance signalés. Une régularisation par bail et par année (`@@unique`), décompte en PDF.
- Front prévu : carte « Révision du loyer » et carte « Régularisation des charges » dans la fiche du bail ; page **Charges**
  (Finances) pour saisir les charges par bien et par année ; section **Indices IRL** dans Paramètres.

Avancement :
- [x] Migration `20261121150000_charges_irl` (appliquée sur la base de dev) ; `lib/period.ts` : `rentAt`, `occupiedDaysInYear`, `addOneYear`.
- [x] `findLeasesCovering` inclut les révisions (génération des échéances au bon loyer).
- [x] API : routes `/api/irl` (GET, PUT), `/api/charges` (CRUD), `/api/leases/:id/revisions[/preview?date|/:rid/letter]`, `/api/leases/:id/regularizations[/preview?year|/:rid/statement]` ; 90 tests API. Indice retenu : le plus récent du trimestre **publié à la date d'effet** (INSEE ≈ le 15 du mois suivant le trimestre, `lastPublishedYear`). PDF vérifiés à l'œil.
- [x] Front : cartes « Révision du loyer (IRL) » et « Régularisation des charges » dans la fiche du bail (IRL de référence
  modifiable dans le bail), page **Charges** (menu Finances), section **Indices IRL** dans Paramètres ; l'alerte de révision
  du tableau de bord disparaît une fois la révision appliquée. Test de contrat étendu. `npm run verify` : 91 tests API, 60 front.
- [x] Vérifié sur l'API de dev (lectures) : le bail du seed (IRL T2 2023, jamais révisé) propose une révision dès maintenant avec l'indice T2 2026, à saisir.
- [x] **Test par Thomas** (2026-11-21) : « la révision du loyer fonctionne très bien », charges et régularisation aussi. Fusionnée dans `main`.

## Phase 2 (loyers et quittances) : livrée sur `main` (2026-11-20)

Décisions (validées par Thomas le 2026-11-20) :
- Adresse du bailleur : champs `address/zipCode/city` sur `User`, modifiables via `/api/me` et la page Paramètres.
- Échéances : bouton « Générer le mois », endpoint idempotent (`@@unique([leaseId, periodYear, periodMonth])`).
- Prorata au jour si le bail commence ou finit dans le mois (date de fin incluse). Loyer et charges sont arrondis séparément, et le total est leur somme.
- Quittance uniquement pour un loyer payé en entier (`RECEIVED`), PDF avec `pdfkit`, rangée dans `STORAGE_PATH/pdfs/quittances/<année>/<id>.pdf`. Copropriété : tous les propriétaires du bien apparaissent comme bailleurs.
- `LATE` est calculé à la lecture (échéance passée et statut `PENDING`), pas stocké. L'échéance tombe le `rentDayOfMonth` du bail (ou au début de la période si celle-ci commence plus tard).
- Modifier ou annuler un paiement supprime la quittance existante (elle ne correspondrait plus).

Fait :
- Migration `20261120090000_loyers_quittances` : adresse sur `User` ; `periodStart/periodEnd` et `rentAmount/chargesAmount` sur `RentPayment` ; contrainte unique. Générée avec `prisma migrate diff`, parce que `migrate dev` refuse de tourner en non-interactif quand il y a un avertissement.
- API `/api/rent-payments` : `GET ?year&month&leaseId`, `POST /generate {year, month}`, `PUT|DELETE /:id/payment`, `DELETE /:id`, `POST /:id/receipt` (génère le PDF), `GET /:id/receipt[?download]`. API `/api/me` (`GET`, `PATCH`).
- Front : page **Loyers** (`/rents` : navigation par mois, totaux, encaissement, quittance, annulation) et page **Paramètres** (`/settings` : identité et adresse du bailleur). Liens ajoutés dans la Sidebar et la BottomNav.
- Tests : 42 côté API (dont 15 rent-payments et 3 me) et 18 côté front.
- Vérifié à la main : parcours complet en curl sur l'API de dev, puis avec la nouvelle image Docker de l'API (PDF généré, texte contrôlé : accents, €, une page).

Reste à faire :
- [x] Interface testée par Thomas à distance (via Tailscale) : « ça fonctionne plutôt bien », mais pas encore tout vérifié. Poussée sur `main`.
- [ ] Plus tard : envoi de la quittance par e-mail (`Receipt.sentAt`, il faut un SMTP), reçu pour un paiement partiel, échéances sur le Tableau de bord.

## Multipropriétaires : livré sur `main` (2026-11-21)

Décisions (Thomas, 2026-11-21) : anticiper tout de suite le cas de plusieurs propriétaires par bien, avec un compte par
personne ; tous les copropriétaires ont les mêmes droits ; signatures des quittances en simple image, sans aller plus loin.
Choix par défaut proposés et retenus : comptes créés par l'administrateur (mot de passe provisoire), locataire commun
vu par chacun à travers ses propres baux, quote-part affichée maintenant et utilisée plus tard pour les impôts.

Fait :
- Migration `20261121090000_multi_proprietaires` : `User.signaturePath`, `mustChangePassword`, `sessionVersion` ;
  `Tenant.createdById` (repris des baux existants, sinon le premier administrateur).
- API : connexion par cookie de session signé, toutes les routes protégées ; filtrage de tous les accès par propriétaire
  (404 pour les données d'un autre) ; copropriétaires d'un bien ; comptes et mots de passe provisoires (administrateur) ;
  changement de mot de passe ; signature apposée sur les quittances, une par copropriétaire. Détails : ARCHITECTURE.md § 3.3 et § 5.
- Front : écran de connexion, changement obligatoire du mot de passe provisoire, déconnexion (barre latérale et menu
  « Plus »), Paramètres (signature, mot de passe, comptes), fenêtre « Propriétaires » sur chaque bien.
- Corrigé en route : les listes de biens et de locataires ne renvoyaient que les baux **en cours**, donc les historiques
  de la refonte (bien, onglet Anciens) restaient vides en vrai, alors que les tests du front passaient avec leurs
  données simulées. Corrigé côté API et couvert par un test.
- Vérifié sur l'API de dev à travers Vite : 401 sans session, connexion `admin@local.dev` / `changeme`, données, déconnexion.

À anticiper (ARCHITECTURE.md § 5.1) : répartition des revenus et charges par quote-part pour les impôts (et historique
des quotes-parts par année ?), régime fiscal par copropriétaire si besoin.

## Refonte du front d'après la maquette : étapes 1 à 4 livrées sur `main`

Référence : la maquette de Thomas (`GestionLocative.jsx`, sur le disque de la box, voir le journal du 2026-11-20 soir).
Principe : reprendre le visuel et l'organisation des écrans, **branchés sur la vraie API**. Les notions de la maquette
absentes du schéma (interventions, autres régimes fiscaux, colocation…) sont listées dans ARCHITECTURE.md § 4.3 et
attendront l'écran concerné.

Étapes :
- [x] 1. Menu et structure : icônes `lucide-react`, barre latérale en groupes avec le profil, en-tête mobile, barre du bas avec un menu « Plus » (Locataires y est maintenant). Commit `0f5f7f7`.
- [x] 2. Tableau de bord : indicateurs, alertes (loyers en retard, échéances à générer, fin de bail, révision annuelle), suivi mensuel branché sur `/api/rent-payments`. Validé visuellement par Thomas.
- [x] 3. Revue de cohérence des tests front et API (voir le journal) : test de contrat ajouté côté API, règle `coversMonth` alignée sur l'API.
- [x] 4. Biens (type, régime fiscal, propriétaires, historique avec vacance), Locataires (onglets En cours / Anciens, historique des baux), Locations (liste, et nouvelle **fiche du bail** `/leases/:id` : conditions, modification, résiliation avec date, échéances et quittances du bail). Erreurs de l'API affichées partout. Validé par Thomas.
- [ ] 5. Écrans des phases suivantes, un par un, chacun avec son API, sa migration et ses tests.

Laissé de côté pour l'instant : « Charger la simulation » (le seed joue ce rôle), le courrier de révision IRL (phase 4),
et dans la fiche du bail les blocs Documents (US-04) et Interventions (pas de modèle), le dépôt de garantie et la
colocation (pas dans le schéma, voir ARCHITECTURE.md § 4.3). Le dossier locataire (pièces obligatoires) attend US-04.

## Journal

### 2026-11-21
- Phase 4 validée par Thomas et fusionnée dans `main`. Nouvelles demandes : notifier les propriétaires avant l'anniversaire des baux (appli, e-mail, téléphone) et saisir les charges par trimestre, avec des quotes-parts datées (changement de propriétaire en cours d'année).
- Phase 4 (charges, IRL) développée sur `phase4-charges-irl` (voir la section Phase 4). Bug évité grâce aux tests : la révision prenait l'indice le plus récent saisi, même publié après la date d'effet.
- Tests à la main par Thomas (connexion, Paramètres, copropriété, second compte, quittance à deux signatures, écrans de la refonte) : « tout fonctionne super bien ». `multi-proprietaires` fusionnée dans `main` (fast-forward) et poussée.
- Multipropriétaires développé (voir la section dédiée). 70 tests API, 48 tests front.
- Bug trouvé pendant le développement du front : une boucle infinie de requêtes quand la session est absente (la 401 du profil relançait le profil). Corrigé et couvert par les tests de l'écran de connexion.

### 2026-11-20 (nuit)
- **Historique de `main` réécrit** (accord de Thomas, dépôt public) : le journal poussé plus tôt contenait des détails du réseau local. Les commits `5424658` et `44e1a9c` sont fusionnés en `60f7cf3` (mêmes fichiers finaux), puis `main` a été forcée sur GitHub. La branche `refonte-front` a été reconstruite par-dessus. Des sauvegardes locales des anciennes branches existent (`sauvegarde/*`), à ne pas pousser. Règle : **aucun détail du réseau, de la famille ou des locataires dans le dépôt** (le dépôt est public).
- Refonte, étape 4 : Biens, Locataires, Locations et fiche du bail.
- Bugs trouvés et corrigés en route :
  - **erreurs de l'API perdues** sur Biens, Locataires et Baux : un refus (ex. 409 « bien avec historique de baux », 400 « e-mail invalide ») ne s'affichait pas et la fenêtre se fermait comme si tout allait bien. Ajout de `useActionError` et `ErrorAlert`, testés écran par écran ;
  - **résiliation** : l'API acceptait une date de fin antérieure au début du bail. Elle renvoie maintenant 400 (test ajouté). Côté front, la saisie passe par une fenêtre avec un champ date (avant : `prompt()` en texte libre) ;
  - **cache** : créer ou résilier un bail ne rafraîchissait pas la liste des locataires (ni les échéances après une résiliation) ;
  - **historique d'un bien** : un bail fini le 31/12 suivi d'un bail commencé le 01/01 aurait affiché un jour de vacance.
- Tests : simulateur `fetch` du front enrichi (méthode HTTP, codes d'erreur), test de contrat étendu à `GET /api/leases/:id` et `GET /api/rent-payments?leaseId=`. Vérification sur la vraie API de dev des requêtes de la fiche du bail.
- `docs/ARCHITECTURE.md` mis à jour (routes du front, gestion des erreurs, règle de résiliation, outils de test).

### 2026-11-20 (soir, suite)
- Refonte du front, étapes 1 et 2 (menu, tableau de bord). Thomas : rien à redire sur le tableau de bord.
- **Revue de cohérence des tests front ↔ API**. Constat : les tests du front simulent `fetch` avec des données écrites à la main, ils ne voient donc pas un changement de forme de l'API. Comparaison faite avec les vraies réponses de l'API de dev :
  - `Lease.endDate` vaut `null` dans l'API, alors que le type front le déclarait optionnel : type corrigé (`string | null`).
  - L'alerte « échéances à générer » ne suivait pas la règle de l'API : elle se serait affichée pour toujours sur un bail encore actif dont la date de fin est passée, et elle ignorait le dernier mois d'un bail résilié. Corrigé (`coversMonth`, même règle que `findLeasesCovering`) et couvert par 6 tests de cas limites.
  - Ajout de `apps/api/tests/frontContract.test.ts` : il fige les champs que lisent les écrans. S'il casse, on met à jour les types et les données simulées du front.
- Création de `docs/ARCHITECTURE.md` (dossier d'architecture technique, modèle de données en Mermaid).
- Cache du navigateur : pas de service worker, et Vite sert les modules sans cache. Pas de risque de voir une ancienne version sur le port 5176. La seule « ancienne version » visible est celle des conteneurs sur le port 5175 (blocage AppArmor).

### 2026-11-20 (soir)
- Test de la phase 2 par Thomas à distance, via Tailscale (voir « Tester à distance »). Les conteneurs sur 5175/3001 sont encore ceux d'avant la phase 2 (blocage AppArmor).
- Phase 2 poussée sur `main`.
- Maquette du front faite par Thomas, sur le disque de la Freebox (partage SMB de la box ; chemin et accès notés hors du dépôt, dans la mémoire locale de Claude ; fichier principal `GestionLocative.jsx`). On la lit avec un conteneur jetable (`alpine` + `samba-client`), puisque `sudo` n'est pas disponible depuis Claude. Elle sert de référence pour le visuel et pour les écrans des phases suivantes (Interventions, Impôts, Documents, États des lieux…).
- Ensuite : reprendre l'habillage de la maquette (menu en groupes, `lucide-react`, composants) sur la branche `refonte-front`.

### 2026-11-20
- Reprise après une pause. La pile Docker locale était arrêtée depuis 3 mois (`web` redémarrait en boucle faute d'`api`) : relancée et reconstruite.
- Ajout des tests automatisés API et front, intégrés à la CI (service PostgreSQL) et à `npm run verify`.
- Bugs trouvés par les tests et corrigés :
  - suppression d'un bien → 500 (contrainte `Ownership`) ; les quotes-parts sont maintenant supprimées dans la même transaction ;
  - suppression d'un bien ou d'un locataire avec un bail résilié → 500 ; renvoie désormais 409 (l'historique est conservé) ;
  - création d'un bail sur un bien ou un locataire inexistant → 500 ; renvoie désormais 404 ;
  - le seed créait l'admin avec un id aléatoire alors que l'API utilise un `DEV_USER_ID` fixe : les biens créés étaient orphelins. Le seed utilise maintenant `DEV_USER_ID`.
- Port de dev Vite unifié sur 5175 (dans `vite.config.ts`). Suppression de `deploy-back.sh` / `deploy-front.sh`.
- Vérification locale de la pile en conteneurs (via nginx :5175) : accueil, liens profonds, lecture des données seed, création/suppression d'un bien, validation 400.
- Droit `workflow` ajouté au jeton GitHub (PAT dans `~/.git-credentials`, `gh` n'est pas installé) : commits `c3a6162` et `26f6b37` poussés sur `main`.
- Phase 2 développée : loyers, échéances avec prorata, encaissements, quittances PDF, page Paramètres (détails dans la section Phase 2). Commit local, pas encore poussé, en attendant un test de l'interface par Thomas.
- Docker : la reconstruction des images fonctionne, mais le remplacement des conteneurs est bloqué par AppArmor (Docker en snap). Pistes : `sudo snap restart docker`, puis `docker compose up -d --build` ; si ça ne suffit pas, `sudo systemctl reload apparmor` ou un redémarrage de la machine.

### 2026-11-18
- Reprise du projet dans Claude Code. Le code local a été poussé sur GitHub (commit `83cfd2f`).
- Mode de fonctionnement adopté : boucle courte en local, push quand c'est stable, capitalisation dans ce fichier, CI pour les images Docker.
- Vérifié : `apps/api` et `apps/web` compilent, et les deux images Docker se construisent en local.
- Ajout de la CI (`.github/workflows/ci.yml`), des `.dockerignore`, de `CLAUDE.md` et de `docs/AVANCEMENT.md`. Dans `docker-compose.yml`, les images sont nommées d'après GHCR.
