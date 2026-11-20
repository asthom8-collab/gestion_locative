# Avancement du projet

> Journal de bord : il sert de mémoire entre les sessions. On le met à jour à chaque étape stabilisée, l'entrée la plus récente en haut du journal.
> La description technique (composants, API, **modèle de données**, règles métier, tests) est dans [ARCHITECTURE.md](ARCHITECTURE.md).

## État actuel (2026-11-20)

### Fait
- **Axe 1 / socle** : CRUD pour les **biens** (`/api/properties`), les **locataires** (`/api/tenants`) et les **baux** (`/api/leases`, avec en plus `GET /property/:propertyId` et `POST /:id/terminate`). Endpoint `/health`.
- **Front** : Dashboard, Biens, Locataires, Baux. Layout avec Sidebar sur desktop et BottomNav sur mobile, manifest PWA.
- **Schéma Prisma complet** déjà en place (migration `init`), y compris pour les phases à venir : RentPayment/Receipt, BankTransaction, Charge/ChargeRegularization, IrlIndex, LmnpEntry, Document, Inventory (pièces, éléments, photos), User/Ownership (copropriété avec quote-part).
- **Industrialisation** : dépôt git, CI GitHub Actions (compilation, tests et images Docker publiées sur GHCR), `.dockerignore`, CLAUDE.md et ce fichier.
- **Tests automatisés** : 47 tests d'intégration API (Vitest + Supertest sur base `_test`, dont 4 tests de contrat API ↔ front) et 37 tests front (Vitest + Testing Library). `npm run verify` à la racine = build + tests des deux apps.
- **Phase 2** (loyers, quittances PDF, Paramètres) : livrée sur `main`.
- **Refonte du front d'après la maquette** : en cours sur la branche `refonte-front` (voir plus bas).

### Tester à distance (Thomas travaille souvent en SSH)
- La machine est dans le réseau Tailscale de Thomas (adresse : `tailscale ip -4`, notée ici `<IP_TAILSCALE>`). On lance l'API de dev sur un autre port que le conteneur, et Vite en l'écoutant **uniquement sur l'adresse Tailscale** :
  `PORT=3002 npm run dev` (dans `apps/api`) et `API_URL=http://localhost:3002 npx vite --port 5176 --strictPort --host <IP_TAILSCALE>` (dans `apps/web`).
  On ouvre ensuite http://<IP_TAILSCALE>:5176 depuis le PC ou l'iPhone. Sans Tailscale : `ssh -L 5176:<IP_TAILSCALE>:5176 <utilisateur>@<machine>`.
- `API_URL` (dans `vite.config.ts`) choisit la cible du proxy `/api` (par défaut `http://localhost:3001`).

### Pas encore fait / points d'attention
- **Pas d'authentification** : le modèle `User` existe, mais aucune route de login ni protection de l'API. À faire avant toute exposition sur Internet.
- Les locataires et les baux ne sont pas filtrés par propriétaire (seuls les biens le sont via `Ownership`) : à traiter avec l'auth.
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

## Refonte du front d'après la maquette : en cours (branche `refonte-front`)

Référence : la maquette de Thomas (`GestionLocative.jsx`, sur le disque de la box, voir le journal du 2026-11-20 soir).
Principe : reprendre le visuel et l'organisation des écrans, **branchés sur la vraie API**. Les notions de la maquette
absentes du schéma (interventions, autres régimes fiscaux, colocation…) sont listées dans ARCHITECTURE.md § 4.3 et
attendront l'écran concerné.

Étapes :
- [x] 1. Menu et structure : icônes `lucide-react`, barre latérale en groupes avec le profil, en-tête mobile, barre du bas avec un menu « Plus » (Locataires y est maintenant). Commit `0f5f7f7`.
- [x] 2. Tableau de bord : indicateurs, alertes (loyers en retard, échéances à générer, fin de bail, révision annuelle), suivi mensuel branché sur `/api/rent-payments`. Validé visuellement par Thomas.
- [x] 3. Revue de cohérence des tests front et API (voir le journal) : test de contrat ajouté côté API, règle `coversMonth` alignée sur l'API.
- [x] 4. Biens (type, régime fiscal, propriétaires, historique avec vacance), Locataires (onglets En cours / Anciens, historique des baux), Locations (liste, et nouvelle **fiche du bail** `/leases/:id` : conditions, modification, résiliation avec date, échéances et quittances du bail). Erreurs de l'API affichées partout. En attente du retour de Thomas.
- [ ] 5. Écrans des phases suivantes, un par un, chacun avec son API, sa migration et ses tests.

Laissé de côté pour l'instant : « Charger la simulation » (le seed joue ce rôle), le courrier de révision IRL (phase 4),
et dans la fiche du bail les blocs Documents (US-04) et Interventions (pas de modèle), le dépôt de garantie et la
colocation (pas dans le schéma, voir ARCHITECTURE.md § 4.3). Le dossier locataire (pièces obligatoires) attend US-04.

## Journal

### 2026-11-20 (nuit)
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
