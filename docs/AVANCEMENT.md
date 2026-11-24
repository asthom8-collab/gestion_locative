# Avancement du projet

> Point de reprise court, chargé à chaque session : le tenir **bref** (économie de contexte).
> Détails des phases livrées et journal : [HISTORIQUE.md](HISTORIQUE.md) (à consulter au besoin, à compléter en fin de session).
> Description technique (API, modèle de données, règles métier, tests) : [ARCHITECTURE.md](ARCHITECTURE.md).

## ▶ Reprise — état au 2026-11-24

### Où en est le code
- `main` (= `origin/main`) : phases 2, 4 et 4 bis (notifications, charges par trimestre, quotes-parts datées, indices
  IRL de l'INSEE, rôles des comptes), refonte du front, multipropriétaires. Phase 4 bis validée par Thomas le 2026-11-24.
  `npm run verify` : 112 tests API, 74 tests front. Détail : HISTORIQUE.md.

### Phase 4 bis : validée par Thomas (2026-11-24)
- [x] **Indices IRL** (validé par Thomas le 2026-11-24) : menu Référentiels → Indices IRL (sortis des Paramètres, valeurs espacées, évolution sur un an,
  source). Import **automatique** depuis l'INSEE chaque jour (40 trimestres déjà importés) + « Vérifier maintenant ».
- [x] **Comptes** (validé par Thomas le 2026-11-24) : de retour dans Paramètres (administrateur), deux rôles : Administrateur / Propriétaire (un
  propriétaire ne voit que lui-même et ses copropriétaires). Rôle au choix à la création, modifiable ensuite.
- [x] **Régularisation à refaire** (validé par Thomas le 2026-11-23) : exemple en base, bien « Démo régularisation » (locataire Camille Exemple, eau
  passée de 360 à 450 € après la régularisation 2025). À voir : tableau de bord, cloche, badge orange (Charges),
  bandeau en haut de la fiche du bail → « Voir et mettre à jour » → « Mettre à jour la régularisation ».
- [x] **Badges** de la page Charges plus visibles (« c'est super ») (Régulariser / Régularisée / Régularisation à refaire).
- [x] ntfy : notifications reçues par Thomas (2026-11-24).
- [x] E-mail : SMTP Gmail en place, notification reçue par Thomas (le second compte a une adresse fictive : échec normal).
- [x] Onglet Propriétaires validé (« très bien, on part là-dessus »). Charges par trimestre et prorata validés.

### Prochaines étapes, dans l'ordre
1. Remplacer les conteneurs (`sudo snap restart docker` par Thomas, blocage AppArmor, puis `docker compose up -d --build`),
   avec `SESSION_SECRET` et les cinq variables `SMTP_*` (à copier de `apps/api/.env` dans le `.env` de la racine et à
   passer dans `docker-compose.yml`).
2. Suite : phase 3 (rapprochement bancaire) ou écrans restants de la maquette (Paiements, Synchro bancaire, Impôts,
   Interventions, Documents, États des lieux, dossier locataire), en gardant la répartition par quote-part pour les impôts (ARCHITECTURE.md § 5.1).

### Compte bloqué
`npm run reset-password -- <email>` dans `apps/api` : mot de passe provisoire (sans e-mail : liste des comptes).

### E-mail (SMTP)
Configuré dans `apps/api/.env` (Gmail, mot de passe d'application ; ignoré par git, **jamais dans le dépôt**). L'API ne
relit ce fichier qu'au démarrage. L'e-mail part à l'adresse du compte (Paramètres → Identité), qui est aussi l'identifiant.

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
