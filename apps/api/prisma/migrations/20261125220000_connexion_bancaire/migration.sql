-- Connexion automatique d'un compte bancaire (Enable Banking) : session, compte choisi, consentement, synchronisation.

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "consentExpiresAt" TIMESTAMP(3),
ADD COLUMN     "ebAccountUid" TEXT,
ADD COLUMN     "ebSessionId" TEXT,
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "pendingAccounts" JSONB,
ADD COLUMN     "pendingState" TEXT,
ADD COLUMN     "remoteLabel" TEXT;

