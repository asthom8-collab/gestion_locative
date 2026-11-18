# Avancement du projet

> Journal de bord : il sert de mémoire entre les sessions. On le met à jour à chaque étape stabilisée, l'entrée la plus récente en haut du journal.

## État actuel (2026-11-18)

### Fait
- **Axe 1 / socle** : CRUD pour les **biens** (`/api/properties`), les **locataires** (`/api/tenants`) et les **baux** (`/api/leases`, avec en plus `GET /property/:propertyId` et `POST /:id/terminate`). Endpoint `/health`.
- **Front** : Dashboard, Biens, Locataires, Baux. Layout avec Sidebar sur desktop et BottomNav sur mobile, manifest PWA.
- **Schéma Prisma complet** déjà en place (migration `init`), y compris pour les phases à venir : RentPayment/Receipt, BankTransaction, Charge/ChargeRegularization, IrlIndex, LmnpEntry, Document, Inventory (pièces, éléments, photos), User/Ownership (copropriété avec quote-part).
- **Industrialisation** : dépôt git, CI GitHub Actions (compilation et images Docker publiées sur GHCR), `.dockerignore`, CLAUDE.md et ce fichier.

### Pas encore fait / points d'attention
- **Pas d'authentification** : le modèle `User` existe, mais aucune route de login ni protection de l'API. À faire avant toute exposition sur Internet.
- Aucun test automatisé (ni API ni front).
- Le port de dev dans `vite.config.ts` (5178) ne correspond pas au script `dev` (`--port 5175`) : c'est le script qui l'emporte.
- `deploy-back.sh` / `deploy-front.sh` sont obsolètes depuis que le code est versionné. Ils sont candidats à la suppression.

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

### 2026-11-18
- Reprise du projet dans Claude Code. Le code local a été poussé sur GitHub (commit `83cfd2f`).
- Mode de fonctionnement adopté : boucle courte en local, push quand c'est stable, capitalisation dans ce fichier, CI pour les images Docker.
- Vérifié : `apps/api` et `apps/web` compilent, et les deux images Docker se construisent en local.
- Ajout de la CI (`.github/workflows/ci.yml`), des `.dockerignore`, de `CLAUDE.md` et de `docs/AVANCEMENT.md`. Dans `docker-compose.yml`, les images sont nommées d'après GHCR.
