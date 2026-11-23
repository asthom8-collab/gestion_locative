# Avancement du projet

> Point de reprise court, chargé à chaque session : le tenir **bref** (économie de contexte).
> Détails des phases livrées et journal : [HISTORIQUE.md](HISTORIQUE.md) (à consulter au besoin, à compléter en fin de session).
> Description technique (API, modèle de données, règles métier, tests) : [ARCHITECTURE.md](ARCHITECTURE.md).

## ▶ Reprise — état au 2026-11-23

### Où en est le code
- `main` (= `origin/main`) : phases 2 et 4, refonte du front, multipropriétaires.
- Branche locale `phase4b-notifications` (non poussée) : phase 4 bis (notifications avant l'anniversaire des baux,
  charges par trimestre, quotes-parts datées). `npm run verify` : 106 tests API, 69 tests front.
  Choix, avancement et retours du premier test : HISTORIQUE.md § Phase 4 bis.

### Second test de la phase 4 bis (Thomas, 2026-11-22)
- [x] Rappel de révision : alerte visible sur le tableau de bord et dans la cloche.
- [x] SMS Free Mobile : sans objet (Thomas n'est pas chez Free).
- [ ] ntfy : sujet dans Paramètres → Notifications, puis « Envoyer un essai » (application ntfy sur le téléphone, abonnée au même sujet).
- [ ] Dates de détention : lien **« Propriétaires et dates de détention »** sur chaque carte (page Biens) et sur chaque
  bien de la page Charges (corrigé le 2026-11-23 : l'icône seule n'était pas trouvée) → « Propriétaire depuis le / jusqu'au ».
- [ ] Charges par trimestre : saisie, répartition entre propriétaires, part de chaque locataire, régularisation.
- [ ] E-mail : configurer le SMTP (démarche ci-dessous).

### Configurer l'e-mail (SMTP), démarche
L'API envoie les e-mails par SMTP (`nodemailer`, `apps/api/src/lib/notifiers.ts`). Sans `SMTP_HOST`, aucun e-mail ne part
(l'essai répond « non configuré »). Exemple avec Gmail, gratuit :
1. Sur le compte Google qui enverra les e-mails, activer la **validation en deux étapes** (obligatoire pour l'étape 2).
2. Créer un **mot de passe d'application** : https://myaccount.google.com/apppasswords → nom « gestion locative »,
   noter les 16 caractères (affichés une seule fois). Ne jamais utiliser le vrai mot de passe du compte.
3. Dans `apps/api/.env` (ignoré par git, **jamais dans le dépôt**) :
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=<adresse gmail>
   SMTP_PASS=<mot de passe d'application, sans espaces>
   SMTP_FROM="Gestion locative <adresse gmail>"
   ```
   Pour le conteneur `api`, mettre les mêmes variables dans le `.env` de la racine et les passer dans `docker-compose.yml`.
4. Redémarrer l'API, puis Paramètres → Notifications : cocher l'e-mail et « Envoyer un essai ».
5. L'e-mail part à l'adresse du compte, modifiable dans Paramètres → Identité du bailleur (corrigé le 2026-11-23).
   **Attention** : c'est aussi l'identifiant de connexion (le compte du seed est `admin@local.dev`).
Autres fournisseurs possibles : celui de la messagerie de Thomas (paramètres SMTP fournis par l'opérateur), ou un service
d'envoi (Brevo, gratuit jusqu'à 300 e-mails par jour). Seules les cinq variables changent.

### Prochaines étapes, dans l'ordre
1. Finir le second test (cases ci-dessus) ; les deux corrections demandées sont faites (2026-11-23).
2. Fusionner `phase4b-notifications` dans `main` et pousser.
3. Remplacer les conteneurs (`sudo snap restart docker` par Thomas, blocage AppArmor, puis `docker compose up -d --build`), avec `SESSION_SECRET` et le SMTP.
4. Suite : phase 3 (rapprochement bancaire) ou écrans restants de la maquette (Paiements, Synchro bancaire, Impôts,
   Interventions, Documents, États des lieux, dossier locataire), en gardant la répartition par quote-part pour les impôts (ARCHITECTURE.md § 5.1).

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
