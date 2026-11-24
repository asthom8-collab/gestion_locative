# Avancement du projet

> Point de reprise court, chargé à chaque session : le tenir **bref** (économie de contexte).
> Détails des phases livrées et journal : [HISTORIQUE.md](HISTORIQUE.md) (à consulter au besoin, à compléter en fin de session).
> Description technique (API, modèle de données, règles métier, tests) : [ARCHITECTURE.md](ARCHITECTURE.md).

## ▶ Reprise — état au 2026-11-24

### Où en est le code
- Conteneurs à jour depuis le 2026-11-24 (`docker compose up -d --build`, SMTP et `SESSION_SECRET` dans le `.env` de la racine).
- `main` (= `origin/main`) : pages Paiements et Documents (2026-11-24), phases 2, 4 et 4 bis (notifications, charges par trimestre, quotes-parts datées, indices
  IRL de l'INSEE, rôles des comptes), refonte du front, multipropriétaires. Phase 4 bis validée par Thomas le 2026-11-24.
  `npm run verify` : 119 tests API, 82 tests front. Détail : HISTORIQUE.md.

### Paiements et Documents : validés par Thomas (2026-11-24)
Exemple en base : bien **« Démo paiements »** (Léa Exemple : 12 échéances payées, 1 partielle, 2 en retard ; 10 documents
fictifs, dont 2 sur « Démo régularisation »). `npm run demo` (apps/api) recrée les exemples manquants ;
`npm run demo:paiements-documents -- --supprimer` retire celui-ci.
- [x] **Paiements** (menu Finances) validé par Thomas le 2026-11-24 : année et filtre par bien, totaux, « À relancer »,
  journal des encaissements, export CSV.
- [x] **Documents** (menu Gestion), validé (« c'est parfait »), refait le 2026-11-24 à la demande de Thomas (pas de listes déroulantes, téléphone) :
  tuiles des **biens** et des **baux** (en cours, terminés) avec le nombre de documents ; une tuile ouvre le dossier,
  documents rangés par type, filtre par boutons, « Ajouter » rattaché au dossier, type choisi par boutons. Dans un
  bien, tuiles de ses baux. Fichiers : PDF, image, Word, Excel ; 15 Mo. Migration `documents`.

### Phase 4 bis : validée par Thomas (2026-11-23 et 24)
Indices IRL, comptes et rôles, régularisation à refaire, badges, ntfy, e-mail, onglet Propriétaires, trimestres et
prorata. Détail : HISTORIQUE.md. Exemple en base : bien « Démo régularisation » (`npm run demo:regularisation`).

### Prochaines étapes, dans l'ordre
1. Phase 3 (rapprochement bancaire) ou écrans restants (Synchro bancaire, Impôts, Interventions,
   États des lieux — gros morceau —, dossier locataire), en gardant la répartition par quote-part pour les impôts (ARCHITECTURE.md § 5.1).

### Compte bloqué
`npm run reset-password -- <email>` dans `apps/api` : mot de passe provisoire (sans e-mail : liste des comptes).

### E-mail (SMTP)
Configuré dans `apps/api/.env` (Gmail, mot de passe d'application ; ignoré par git, **jamais dans le dépôt**). L'API ne
relit ce fichier qu'au démarrage. Pour les conteneurs : mêmes variables `SMTP_*` dans le `.env` de la racine. L'e-mail part à l'adresse du compte (Paramètres → Identité), qui est aussi l'identifiant.

### Relancer l'environnement de test à distance (Tailscale)
```bash
docker compose up -d db                                   # base de dev (port 5433)
cd apps/api && PORT=3002 npm run dev                      # API de dev (code de la branche courante)
cd apps/web && API_URL=http://localhost:3002 npx vite --port 5176 --strictPort --host <IP_TAILSCALE>
```
Ouvrir `http://<IP_TAILSCALE>:5176` (adresse : `tailscale ip -4`), compte `admin@local.dev` / `changeme`.
Sur une autre base : `npx prisma migrate deploy` dans `apps/api`.

### Décisions en attente (à poser à Thomas le moment venu)
- Impôts : quote-part figée par année fiscale ou appliquée telle quelle à l'export ? Régime fiscal par copropriétaire ? (phase 5)
- Interventions, colocation, dépôt de garantie, autres types de bien et régimes de la maquette : nouveaux modèles (ARCHITECTURE.md § 4.3).
- Purge des anciens commits sur GitHub (`5424658`, `44e1a9c`) : demande au support GitHub si Thomas le souhaite.

### Points d'attention
- Dev (API 3002) et conteneurs partagent la **base** mais pas les **fichiers** (`apps/api/storage` contre le volume
  `app_storage`) : un document ou une quittance créé d'un côté s'ouvre en 404 de l'autre. Copie au besoin :
  `docker compose cp apps/api/storage/documents api:/app/storage/`.
- Avant une exposition sur Internet : HTTPS puis `COOKIE_SECURE=true`, limitation des tentatives de connexion, en-têtes de sécurité dans nginx.
- Racine : `package.json` contient des devDependencies inutilisées (`typescript ^7`, `@types/node ^26`), à nettoyer.
- Plus tard : envoi des quittances par e-mail (`Receipt.sentAt`, possible une fois le SMTP en place), reçu pour un paiement partiel.

### Règles à garder en tête
- Dépôt **public** : aucun détail du réseau, de la famille ou des locataires dans le dépôt (placeholders `<IP_TAILSCALE>`).
- `sudo` impossible depuis Claude : pour un outil manquant, passer par un conteneur Docker jetable.
- La maquette de Thomas est sur le partage de la box : chemin dans la mémoire locale de Claude, pas ici.

### Feuille de route
| Phase | Contenu | État |
|---|---|---|
| 2 | Loyers et quittances PDF | livrée |
| 4 / 4 bis | Charges, régularisation, IRL / notifications, trimestres, quotes-parts datées | livrée / en test |
| 3 | Rapprochement bancaire (BankTransaction) | à faire |
| 5 | Comptabilité LMNP (LmnpEntry) | à faire |
| US-04 | Documents (Document) | à faire |
| US-22 à 25 | États des lieux (Inventory*) | à faire |
