# Avancement du projet

> Point de reprise court, chargé à chaque session : le tenir **bref** (économie de contexte).
> Détails des phases livrées et journal : [HISTORIQUE.md](HISTORIQUE.md) (à consulter au besoin, à compléter en fin de session).
> Description technique (API, modèle de données, règles métier, tests) : [ARCHITECTURE.md](ARCHITECTURE.md).

## ▶ Reprise — état au 2026-11-26 : phase 3 fusionnée dans `main` ; plan de la suite proposé (PLAN-SUITE.md)

### Où en est le code
- `main` (= `origin/main`) : phases 2, 3 (rapprochement, fusionnée le 2026-11-26 en un seul commit, branche supprimée),
  4, 4 bis, Paiements, Documents. Détail : HISTORIQUE.md. `npm run verify` : 144 tests API, 94 tests front.
  Migrations `20261125090000_rapprochement_bancaire` et `20261125220000_connexion_bancaire` à appliquer
  (`npx prisma migrate deploy`) sur toute autre base (conteneurs compris).

### Phase 3 : choix de Thomas (2026-11-25)
Import de fichier **et** connexion automatique ; banque en **CSV seulement** ; **un compte commun** ; l'application
propose, Thomas valide (partiel = paiement partiel ; virement groupé réparti sur plusieurs échéances).
- [x] **Import CSV** (format détecté : en-tête, `;`/`,`, Débit/Crédit ou Montant, Windows-1252), sans doublon au réimport.
- [x] **Suggestions** (montant, libellé du bail `bankLabel` ou nom du locataire, date), « Tout valider » pour les sûres,
  choix manuel avec montants, Ignorer, Défaire. Règles : ARCHITECTURE.md § 5.
- [x] **Testé par Thomas** (2026-11-25) : import d'un vrai relevé CSV de sa banque principale (853 opérations, reconnu tel
  quel), rapprochements. Relevé ensuite **supprimé à sa demande** (opérations, 2 rapprochements défaits, 35 échéances
  créées par l'import) : la base de dev ne garde que la démo.
- [x] Validation en bloc : liste de ce qui sera validé, lignes décochables (demande de Thomas, 2026-11-25).
- [ ] **Connexion automatique** — banque principale de Thomas : un réseau mutualiste français. Solutions étudiées le 2026-11-25 :
  GoCardless fermé aux inscriptions ; API officielle de la banque réservée aux prestataires agréés (AISP) ; Powens, Tink, Bridge… offres
  pour entreprises, payantes ; Woob (lecture du site) fragile avec la double authentification. **Retenu : Enable
  Banking** (gratuit pour ses propres comptes, sa banque y est listée).
  Fait le 2026-11-25 : application PRODUCTION « Gestion locative » créée par l'API (le champ certificat de leur site
  refusait le PEM), clé dans `apps/api/secrets/` (ignoré), identifiant dans `apps/api/.env` (`ENABLE_BANKING_*`).
  Appel signé vérifié (200), application **inactive** tant qu'aucun compte n'est relié. Adresse de retour provisoire
  `https://localhost:5176/bank` (http refusé) ; confidentialité = URL du dépôt (page à écrire).
  Compte relié par Thomas dans le portail : application **active**.
- [x] **Connecteur** (2026-11-25) : bouton « Connecter la banque » sur le compte, accord sur le site de la banque, adresse
  de retour à recopier (`https://localhost…`, page en erreur : normal), choix du compte, synchronisation à la demande
  et toutes les 12 h, alerte avant l'expiration de l'accord (180 jours). Migration `20261125220000_connexion_bancaire`.
- [x] **Connexion réelle testée** avec une **2e banque** (compte sans loyers, pour essayer) : accord, session jusqu'au
  24/05/2027, lecture OK (2 opérations en 90 jours, avec référence, émetteur et motif). Relié pour l'instant au compte
  **« Démo — compte commun »** : `npm run demo:banque -- --supprimer` le supprimerait avec la connexion.
- [ ] Banque principale (compte des loyers) : reportée à la fin, à la demande de Thomas (2026-11-26).
- [x] **Leçons du test corrigées** (2026-11-26) : (1) l'import et la synchro ne génèrent plus d'échéances que pour les
  baux **déjà suivis**, à partir de leur 1re échéance (avant : 35 échéances dont 22 sur de vrais biens) ; (2) à la
  1re connexion d'un compte qui a déjà des opérations, avertissement (nombre, date de la dernière, conseil d'un compte à part).
- Plus tard : adresse de retour en https réelle (certificats Tailscale à activer dans la console + `tailscale serve`) ;
  pour les conteneurs, monter `apps/api/secrets/` et passer les `ENABLE_BANKING_*` dans `docker-compose.yml`.
- Idées notées : notification (ntfy/e-mail) quand un loyer est rapproché (la maquette prévoyait un SMS) ; rattacher
  les débits aux charges ou à la future comptabilité LMNP.

### Prochaines étapes, dans l'ordre
Plan détaillé proposé le 2026-11-26 : **[PLAN-SUITE.md](PLAN-SUITE.md)** (à valider avec Thomas, questions en fin de fichier).
1. Interventions (travaux faits soi-même ou par un professionnel, nature fiscale) → 2. Impôts location nue et
   micro-BIC (2042 / 2044 / 2042-C-PRO) → 3. LMNP au réel (amortissements, liasse 2031 / 2033) → 4. Mise en ligne
   (VPS chez un hébergeur français, HTTPS, durcissement, sauvegardes) → 5. États des lieux (PDF, validation par les deux parties).
- Banque principale de Thomas : **pas de connexion** pour l'instant (données sensibles, à voir à la fin, une fois hébergé).

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
| 4 / 4 bis | Charges, régularisation, IRL / notifications, trimestres, quotes-parts datées | livrées |
| 3 | Rapprochement bancaire (import CSV, suggestions) / connexion automatique | en test / à faire |
| 5 | Comptabilité LMNP (LmnpEntry) | à faire |
| US-04 | Documents (Document) | livrée |
| US-22 à 25 | États des lieux (Inventory*) | à faire |
