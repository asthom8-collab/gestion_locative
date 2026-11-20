# Avancement du projet

> Journal de bord : il sert de mémoire entre les sessions. On le met à jour à chaque étape stabilisée, l'entrée la plus récente en haut du journal.

## État actuel (2026-11-20)

### Fait
- **Axe 1 / socle** : CRUD pour les **biens** (`/api/properties`), les **locataires** (`/api/tenants`) et les **baux** (`/api/leases`, avec en plus `GET /property/:propertyId` et `POST /:id/terminate`). Endpoint `/health`.
- **Front** : Dashboard, Biens, Locataires, Baux. Layout avec Sidebar sur desktop et BottomNav sur mobile, manifest PWA.
- **Schéma Prisma complet** déjà en place (migration `init`), y compris pour les phases à venir : RentPayment/Receipt, BankTransaction, Charge/ChargeRegularization, IrlIndex, LmnpEntry, Document, Inventory (pièces, éléments, photos), User/Ownership (copropriété avec quote-part).
- **Industrialisation** : dépôt git, CI GitHub Actions (compilation, tests et images Docker publiées sur GHCR), `.dockerignore`, CLAUDE.md et ce fichier.
- **Tests automatisés** : 24 tests d'intégration API (Vitest + Supertest sur base `_test`) et 13 tests front (Vitest + Testing Library). `npm run verify` à la racine = build + tests des deux apps.

### Pas encore fait / points d'attention
- **Pas d'authentification** : le modèle `User` existe, mais aucune route de login ni protection de l'API. À faire avant toute exposition sur Internet.
- Les locataires et les baux ne sont pas filtrés par propriétaire (seuls les biens le sont via `Ownership`) : à traiter avec l'auth.
- **Docker (snap) et AppArmor** : `docker compose up -d --build` échoue sur `cannot stop container: permission denied` (AppArmor `docker-default` refuse les signaux de `snap.docker.dockerd`). Les anciens conteneurs `api`/`web` tournent encore. Il faut un `sudo` (voir le journal du 2026-11-20).
- La BottomNav mobile n'a pas de lien vers Locataires (et ce n'est pas nouveau).
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

## Phase 2 (loyers et quittances) : développée, en attente de test manuel de l'interface

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
- [ ] Tester l'interface dans un navigateur (pas de navigateur disponible pour Claude dans cette session), puis pousser sur `main`. Le commit `cfa9855` est déjà sauvegardé sur la branche distante `phase-2-loyers` (`main` distant est encore à `0568979`).
- [ ] Plus tard : envoi de la quittance par e-mail (`Receipt.sentAt`, il faut un SMTP), reçu pour un paiement partiel, échéances sur le Tableau de bord.

## Journal

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
