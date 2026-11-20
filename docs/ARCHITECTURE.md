# Dossier d'architecture technique

> Description de l'application telle qu'elle est **aujourd'hui** : composants, API, modèle de données, règles métier, tests et déploiement.
> On le met à jour à chaque changement de structure (nouvelle migration, nouvelle route, nouveau composant transverse).
> L'avancement et les décisions au jour le jour sont dans [AVANCEMENT.md](AVANCEMENT.md).
>
> Dernière mise à jour : 2026-11-20 (phase 2 livrée ; refonte du front : menu, tableau de bord, Biens, Locataires, Locations).

## 1. Vue d'ensemble

Application web de gestion locative pour des biens détenus en propre (un ou plusieurs propriétaires par bien). Elle est
pensée pour un usage personnel, auto-hébergé sur une machine du réseau local.

```mermaid
flowchart LR
  subgraph Navigateur
    W[SPA React<br/>apps/web]
  end
  subgraph "Hôte (docker compose)"
    N[nginx :5175<br/>fichiers statiques + proxy /api]
    A[API Express :3001<br/>apps/api]
    D[(PostgreSQL 16<br/>:5433)]
    S[/storage/<br/>PDF des quittances/]
  end
  W -- HTTP --> N
  N -- /api --> A
  A -- Prisma --> D
  A -- fichiers --> S
```

- En développement, Vite (port 5175) remplace nginx et proxifie `/api` vers `API_URL` (par défaut `http://localhost:3001`).
- Tous les ports sont liés à `127.0.0.1`. Il n'y a **pas encore d'authentification** : l'utilisateur courant est fixé par `DEV_USER_ID`.

## 2. Pile technique

| Couche | Technologies |
|---|---|
| Front (`apps/web`) | React 18, Vite 5, TypeScript, Tailwind 3, React Router 6, TanStack Query 5, icônes `lucide-react` |
| API (`apps/api`) | Node 22, Express 4, TypeScript (commonjs), zod (validation), winston (logs), pdfkit (quittances) |
| Données | PostgreSQL 16, Prisma 5 (schéma et migrations dans `apps/api/prisma`) |
| Tests | Vitest partout ; Supertest + vraie base `_test` pour l'API ; Testing Library + jsdom pour le front |
| Livraison | Docker (une image par app), docker compose, CI GitHub Actions, images sur GHCR |

## 3. API

### 3.1 Organisation en couches

```
routes/        validation zod (middleware validate) et association URL → contrôleur
controllers/   lecture de la requête HTTP, code de retour
services/      règles métier (prorata, statuts, quittances…), erreurs AppError(status, message)
repositories/  accès aux données Prisma (requêtes, include)
lib/           prisma, période et prorata (period.ts), PDF (receiptPdf.ts), stockage (storage.ts), DEV_USER_ID
middlewares/   validate, errorHandler (AppError → JSON { error }, zod → 400 avec le détail des champs)
```

`src/app.ts` construit l'application Express (importée par les tests). `src/index.ts` ne fait que l'écoute du port.

### 3.2 Routes

| Méthode et chemin | Rôle |
|---|---|
| `GET /health` | Santé du service |
| `GET/POST /api/properties`, `GET/PATCH/DELETE /api/properties/:id` | Biens (filtrés par propriétaire via `Ownership`) |
| `GET/POST /api/tenants`, `GET/PATCH/DELETE /api/tenants/:id` | Locataires |
| `GET/POST /api/leases`, `GET/PATCH /api/leases/:id`, `GET /api/leases/property/:propertyId`, `POST /api/leases/:id/terminate` | Baux |
| `GET /api/rent-payments?year&month&leaseId` | Échéances (avec bail, bien, locataire, quittance) |
| `POST /api/rent-payments/generate {year, month}` | Génère les échéances du mois (idempotent) |
| `PUT /api/rent-payments/:id/payment`, `DELETE /api/rent-payments/:id/payment` | Saisit ou annule un encaissement |
| `DELETE /api/rent-payments/:id` | Supprime une échéance non payée |
| `POST /api/rent-payments/:id/receipt`, `GET /api/rent-payments/:id/receipt[?download]` | Génère ou télécharge la quittance PDF |
| `GET/PATCH /api/me` | Profil et adresse du bailleur |

Codes d'erreur : 400 (validation), 404 (introuvable), 409 (conflit métier : bail actif en double, suppression avec historique,
quittance impossible…). Le corps est toujours `{ "error": "message en français" }`.

## 4. Modèle de données

Le schéma complet est déjà en base (migration `init`), y compris les tables des phases à venir. Les modèles
**utilisés** par l'application sont en gras dans le tableau du § 4.2.

### 4.1 Diagramme

```mermaid
erDiagram
  User ||--o{ Ownership : "possède (quote-part)"
  Property ||--o{ Ownership : ""
  Property ||--o{ Lease : ""
  Tenant ||--o{ Lease : ""
  Lease ||--o{ RentPayment : "échéances"
  RentPayment ||--o| Receipt : "quittance"
  BankTransaction |o--o| RentPayment : "rapprochement"
  Property ||--o{ Charge : ""
  Lease ||--o{ ChargeRegularization : ""
  Property ||--o{ LmnpEntry : ""
  Lease ||--o{ Document : ""
  Tenant ||--o{ Document : ""
  Lease ||--o{ Inventory : "états des lieux"
  Inventory ||--o{ InventoryRoom : ""
  InventoryRoom ||--o{ InventoryElement : ""
  InventoryElement ||--o{ InventoryPhoto : ""

  User {
    string id PK
    string email UK
    string firstName
    string lastName
    Role role
    string address "adresse du bailleur (quittances)"
  }
  Property {
    string id PK
    string name
    string address
    PropertyType type "APARTMENT, HOUSE, PARKING, COMMERCIAL"
    float surface
    FiscalRegime fiscalRegime "NU, PINEL, LMNP_MICRO, LMNP_REEL"
    int irlQuarter
  }
  Ownership {
    string propertyId FK
    string userId FK
    float share "1.0 = 100 %"
  }
  Tenant {
    string id PK
    string firstName
    string lastName
    string email
    string phone
    string iban
  }
  Lease {
    string id PK
    string propertyId FK
    string tenantId FK
    LeaseType type "UNFURNISHED, FURNISHED"
    datetime startDate
    datetime endDate "null = sans date de fin"
    float rentAmount "hors charges"
    float chargesAmount
    int rentDayOfMonth
    float irlReference
    boolean active
  }
  RentPayment {
    string id PK
    string leaseId FK
    int periodYear
    int periodMonth
    datetime periodStart
    datetime periodEnd
    float rentAmount "figé, proratisé"
    float chargesAmount "figé, proratisé"
    float expectedAmount
    float receivedAmount
    datetime paymentDate
    PaymentStatus status "PENDING, RECEIVED, PARTIAL (LATE calculé)"
    PaymentSource source "MANUAL, BANK_MATCH"
  }
  Receipt {
    string id PK
    string rentPaymentId FK
    string filePath
    datetime sentAt
  }
  BankTransaction {
    string id PK
    string externalId UK
    float amount
    string label
    datetime date
    TransactionStatus status
  }
  Charge {
    string propertyId FK
    int year
    string label
    float amount
  }
  ChargeRegularization {
    string leaseId FK
    int year
    float totalCharged
    float totalReal
    float balance
  }
  IrlIndex {
    int quarter
    int year
    float value
  }
  LmnpEntry {
    string propertyId FK
    int year
    LmnpEntryType type
    float amount
  }
  Document {
    string label
    string filePath
    DocumentCategory category
    string leaseId FK
    string tenantId FK
  }
  Inventory {
    string leaseId FK
    InventoryType type "ENTRY, EXIT"
    datetime date
    string pdfPath
  }
  InventoryRoom {
    string inventoryId FK
    string name
    int order
  }
  InventoryElement {
    string roomId FK
    string label
    string condition
  }
  InventoryPhoto {
    string elementId FK
    string filePath
  }
```

### 4.2 Tables et état d'utilisation

| Modèle | Rôle | Phase | Utilisé |
|---|---|---|---|
| **User** | Bailleur (et futur compte de connexion) | socle, 2 | oui (profil, adresse) |
| **Ownership** | Lien bien ↔ propriétaire, avec quote-part (copropriété) | socle | oui |
| **Property** | Bien loué | socle | oui |
| **Tenant** | Locataire | socle | oui |
| **Lease** | Bail : un seul bail actif par bien | socle | oui |
| **RentPayment** | Échéance mensuelle et encaissement. Unique par `(leaseId, periodYear, periodMonth)` | 2 | oui |
| **Receipt** | Quittance PDF d'une échéance payée en entier | 2 | oui |
| BankTransaction | Opération bancaire importée, rapprochée d'une échéance | 3 | non |
| Charge, ChargeRegularization | Charges réelles par bien, régularisation annuelle par bail | 4 | non |
| IrlIndex | Indices IRL de l'INSEE | 4 | non |
| LmnpEntry | Écritures comptables LMNP | 5 | non |
| Document | Pièces jointes (bail, locataire) | US-04 | non |
| Inventory, InventoryRoom, InventoryElement, InventoryPhoto | États des lieux d'entrée et de sortie | US-22 à 25 | non |

### 4.3 Écarts connus avec la maquette du front

La maquette (`GestionLocative.jsx`, voir AVANCEMENT.md) montre des notions qui **n'existent pas encore** dans le schéma.
Il faudra une migration au moment de faire l'écran concerné :
- **Interventions** (plomberie, sinistre, artisan, coût…) : aucun modèle.
- **Régimes fiscaux** : la maquette propose aussi Location nue, LMNP tourisme classé, Denormandie et Loc'Avantages (l'enum `FiscalRegime` n'a que NU, PINEL, LMNP_MICRO, LMNP_REEL).
- **Types de bien** : Studio, Garage, Maison… et l'option « borne de recharge » d'un parking.
- **Plusieurs locataires sur un bail** (colocation) : aujourd'hui `Lease.tenantId` est unique.
- **Dossier locataire** (pièces obligatoires) : à rapprocher de `Document`.

## 5. Règles métier implémentées

- **Bail** : un seul bail actif par bien (409 sinon). La résiliation fixe `endDate` (qui ne peut pas précéder le début du
  bail : 400) et passe `active` à `false`. Modifier le loyer ou les charges ne change pas les échéances déjà générées. Un bien
  ou un locataire qui a un historique de baux ne peut pas être supprimé (409).
- **Génération des échéances** (`POST /generate`) : un bail donne une échéance pour un mois s'il en couvre au moins un jour
  (commencé avant la fin du mois, et soit sans date de fin et actif, soit avec une date de fin dans le mois ou après).
  Le front reprend cette règle telle quelle (`coversMonth` dans `Dashboard.tsx`) pour l'alerte « échéances à générer ».
- **Prorata** au jour si le bail commence ou finit dans le mois (date de fin incluse). Loyer et charges sont arrondis
  séparément ; le montant attendu est leur somme. Les montants sont figés à la génération.
- **Statuts** : `PENDING`, `PARTIAL` ou `RECEIVED` sont stockés. `LATE` est **calculé à la lecture** (échéance passée et
  `PENDING`). L'échéance tombe le `rentDayOfMonth` du bail, ou au début de la période si elle commence plus tard.
- **Quittance** : seulement pour un loyer payé en entier, avec l'adresse de chaque propriétaire renseignée. PDF dans
  `STORAGE_PATH/pdfs/quittances/<année>/<id>.pdf`. Modifier ou annuler le paiement supprime la quittance.
- **Dates** : stockées en UTC à minuit. Les calculs de période se font en UTC des deux côtés.

## 6. Front

```
src/api/client.ts          appels HTTP (fetch), erreurs → Error(message de l'API)
src/lib/format.ts          formatage commun (euros, dates en UTC, durées, libellés des types de bien et régimes fiscaux)
src/hooks/                 un fichier par ressource (TanStack Query : lecture et mutations, invalidation du cache) ;
                           useActionError : exécute une mutation et garde le message d'erreur de l'API pour l'afficher
src/types/index.ts         types des réponses de l'API (tenus à jour avec le test de contrat, § 7)
src/pages/                 un écran par route
src/components/ui/         composants maison repris de la maquette (Card, Modal, Field, StatCard, Badge,
                           PaymentStatusBadge, PropTypeIcon, ErrorAlert…)
src/components/layout/     Sidebar (desktop), MobileHeader et BottomNav avec menu « Plus » (mobile), nav.ts (menu)
src/components/icons.tsx   point d'entrée unique des icônes lucide-react
```

| Route | Écran |
|---|---|
| `/` | Tableau de bord : indicateurs, alertes, suivi mensuel des loyers |
| `/properties` | Biens : type, régime fiscal, propriétaires, historique des locataires avec périodes de vacance |
| `/tenants` | Locataires : onglets « En cours » / « Anciens et sans bail », historique des baux |
| `/leases` | Locations (baux) : liste, création |
| `/leases/:id` | Fiche du bail : conditions, modification, résiliation, échéances et quittances du bail |
| `/rents?year&month` | Loyers : génération, encaissements, quittances |
| `/settings` | Paramètres : identité et adresse du bailleur |

Toutes les erreurs de l'API (400, 404, 409) s'affichent à l'écran (`ErrorAlert`) : en haut de la page pour une
action de liste, dans la fenêtre pour un formulaire (qui reste alors ouvert).

Le menu (`components/layout/nav.ts`) suit les groupes de la maquette : Tableau de bord / Patrimoine / Finances
(puis Gestion). Les écrans des phases suivantes y seront ajoutés au fur et à mesure.

## 7. Stratégie de tests

| Niveau | Où | Ce qui est vérifié |
|---|---|---|
| Intégration API | `apps/api/tests/*.test.ts` | Chaque route via HTTP (Supertest) sur une vraie base PostgreSQL `<base>_test`, vidée avant chaque test : validation, codes d'erreur, règles métier, PDF |
| **Contrat API ↔ front** | `apps/api/tests/frontContract.test.ts` | Les champs et relations que lisent les écrans (et que simulent les tests du front) sont bien renvoyés par l'API, avec `null` plutôt qu'absent |
| Composants et écrans | `apps/web/src/**/*.test.tsx` | Rendu et interactions, avec `fetch` simulé (`src/test/utils.tsx` : `mockApi` par chemin ou « MÉTHODE chemin », `reply(status, corps)` pour simuler une erreur), y compris l'affichage des erreurs de l'API et le contenu des requêtes envoyées |
| Règles partagées | `Dashboard.test.tsx` (`coversMonth`) | Cas limites identiques à ceux de l'API (début et fin de bail, bail résilié) |

Les tests du front utilisent des données simulées : si l'API change de forme, ils continuent de passer. Le **test de
contrat** côté API sert de garde-fou : quand il casse, on met à jour en même temps `src/types` et les données simulées
du front.

`npm run verify` (à la racine) lance la compilation et les tests des deux apps. La CI fait la même chose.

## 8. Déploiement et environnements

| Environnement | Lancement | Accès |
|---|---|---|
| Dev local | `docker compose up -d db`, puis `npm run dev` dans `apps/api` (3001) et `apps/web` (5175) | `http://localhost:5175` |
| Dev à distance | API sur 3002, Vite sur 5176 lié à l'IP Tailscale (voir AVANCEMENT.md) | `http://<IP_TAILSCALE>:5176` (réseau Tailscale) |
| Conteneurs | `docker compose up -d --build` (`db`, `api`, `web`) | `http://localhost:5175` (nginx) |

- **CI** (`.github/workflows/ci.yml`) : compilation et tests des deux apps (service PostgreSQL), puis images Docker.
  Sur `main` ou un tag `v*`, publication sur GHCR : `ghcr.io/asthom8-collab/gestion-locative-{api,web}:{latest,sha-xxxxxxx,X.Y.Z}`.
- **Secrets** : `.env` à la racine (ignoré par git), modèles dans `apps/*/.env.example`.
- **Fichiers** : `storage/` (PDF, futurs documents des locataires) n'est jamais commité.

## 9. Sécurité et points ouverts

- Pas d'authentification ni de contrôle d'accès : à faire avant toute exposition hors du réseau local.
- Locataires et baux ne sont pas filtrés par propriétaire (seuls les biens le sont).
- Pas de service worker : le navigateur ne garde pas de vieille version de l'application en cache hors ligne.
