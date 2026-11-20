# Gestion locative

Application web de gestion locative pour des biens détenus en propre (biens, locataires, baux, puis loyers, quittances, charges, IRL, LMNP, états des lieux).
Dépôt : https://github.com/asthom8-collab/gestion_locative (branche `main`).

**L'avancement, les décisions et la suite du projet sont dans @docs/AVANCEMENT.md : à lire en début de session et à mettre à jour en fin de session.**

## Mode de fonctionnement (convenu le 2026-11-18)

1. **Boucle courte en local** : on développe et on teste sur la machine (`npm run dev`), avec de petites itérations.
2. **Push uniquement quand une version est stable** : `npm run verify` à la racine passe (compilation + tests des deux apps), testée à la main, sans secret. Commit en français, clair.
3. **Capitaliser** : à chaque étape notable, mettre à jour `docs/AVANCEMENT.md` (ce qui a été fait, les décisions, la suite). C'est la mémoire du projet entre les sessions.
4. **CI GitHub Actions** (`.github/workflows/ci.yml`) : elle compile et teste les deux apps (avec une base PostgreSQL éphémère pour l'API), puis construit les images Docker. Sur `main` ou un tag `v*`, elle publie sur GHCR :
   - `ghcr.io/asthom8-collab/gestion-locative-api:{latest,sha-xxxxxxx,X.Y.Z}`
   - `ghcr.io/asthom8-collab/gestion-locative-web:{latest,sha-xxxxxxx,X.Y.Z}`

## Stack

- `apps/api` : Node 22, Express 4, TypeScript (commonjs), Prisma 5 + PostgreSQL 16, zod (validation), winston (logs).
  Architecture en couches : `routes → controllers → services → repositories → lib/prisma`. Validation zod dans `routes/*` via le middleware `validate`.
- `apps/web` : React 18, Vite 5, Tailwind 3, React Router 6, TanStack Query 5. Appels API dans `src/api/client.ts`, hooks par ressource dans `src/hooks/`, pages dans `src/pages/`, composants UI maison dans `src/components/ui/`.
- `docker-compose.yml` : `db` (postgres, port local 5433), `api` (3001), `web` (nginx, 5175, qui proxifie `/api` vers `api:3001`). Les ports sont liés à 127.0.0.1.
- Les secrets sont dans `.env` à la racine (`POSTGRES_USER/PASSWORD/DB`), ignoré par git. Les modèles sont dans `apps/*/.env.example`.

## Commandes

```bash
# Base de données seule (pour le dev local)
docker compose up -d db

# API (dans apps/api, avec apps/api/.env créé depuis .env.example)
npm run dev                 # ts-node-dev, port 3001
npm run prisma:migrate      # nouvelle migration (dev)
npm run prisma:seed         # données de test (admin@local.dev / changeme)
npm run build               # tsc, vérification avant push

# Web (dans apps/web) : Vite, avec un proxy /api vers localhost:3001
npm run dev
npm run build               # tsc + vite build, vérification avant push

# Pile complète en conteneurs
docker compose up -d --build

# Vérification avant push (à la racine) : build + tests des deux apps
npm run verify
```

## Tests

- `apps/api` : Vitest + Supertest, tests d'intégration HTTP dans `tests/` sur une vraie base PostgreSQL.
  La base de test est `<base de DATABASE_URL>_test` (créée et migrée automatiquement, **vidée à chaque test**) ;
  `TEST_DATABASE_URL` permet de la forcer (CI). Le nom doit finir par `_test`. Il faut `docker compose up -d db`.
- `apps/web` : Vitest + Testing Library (jsdom), tests `*.test.tsx` à côté du code ; `fetch` est simulé via `src/test/utils.tsx`.
- `npm test` dans chaque app, `npm run test:watch` en développement.
- Le serveur Express est défini dans `src/app.ts` (importé par les tests), `src/index.ts` ne fait que l'écoute.

## Conventions

- Code, commits et docs en français, identifiants de code en anglais.
- Toute modification du schéma passe par une migration Prisma (`prisma migrate dev --name ...`), jamais par une modification à la main de la base.
- Ne jamais committer `.env`, `storage/` (documents et PDF des locataires) ni de données personnelles réelles.
- En attendant l'auth, l'utilisateur courant est `DEV_USER_ID` (`apps/api/src/lib/devUser.ts`), créé par le seed et par les tests.
- Le port 5175 sert au Vite de dev **et** au conteneur `web` : on lance l'un ou l'autre.
