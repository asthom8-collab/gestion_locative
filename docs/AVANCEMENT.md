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
- Push bloqué depuis cette machine : le jeton GitHub n'a pas le droit `workflow` (nécessaire pour pousser `.github/workflows/ci.yml`).
- Les locataires et les baux ne sont pas filtrés par propriétaire (seuls les biens le sont via `Ownership`) : à traiter avec l'auth.
- Racine : `package.json` contient des devDependencies inutilisées (`typescript ^7`, `@types/node ^26`), à nettoyer.

### Feuille de route (d'après le schéma)
| Phase | Contenu | Modèles |
|---|---|---|
| 2 | Loyers et quittances PDF | RentPayment, Receipt |
| 3 | Rapprochement bancaire | BankTransaction |
| 4 | Charges, régularisation, révision IRL | Charge, ChargeRegularization, IrlIndex |
| 5 | Comptabilité LMNP | LmnpEntry |
| US-04 | Documents (bail, locataire) | Document |
| US-22 à 25 | États des lieux d'entrée et de sortie (photos, signatures, PDF) | Inventory* |

> La numérotation des phases et des US vient des commentaires du schéma. À confirmer ou compléter avec Thomas (l'historique de la conversation précédente n'est pas disponible).

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
- Suite : Phase 2 (loyers et quittances PDF).

### 2026-11-18
- Reprise du projet dans Claude Code. Le code local a été poussé sur GitHub (commit `83cfd2f`).
- Mode de fonctionnement adopté : boucle courte en local, push quand c'est stable, capitalisation dans ce fichier, CI pour les images Docker.
- Vérifié : `apps/api` et `apps/web` compilent, et les deux images Docker se construisent en local.
- Ajout de la CI (`.github/workflows/ci.yml`), des `.dockerignore`, de `CLAUDE.md` et de `docs/AVANCEMENT.md`. Dans `docker-compose.yml`, les images sont nommées d'après GHCR.
