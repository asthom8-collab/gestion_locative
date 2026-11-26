-- Phase 3 : comptes bancaires, opérations rattachées à un compte, libellé de rapprochement par bail ;
-- un virement peut régler plusieurs échéances (plus d'unicité sur RentPayment.bankTransactionId).

-- DropIndex
DROP INDEX "BankTransaction_externalId_key";

-- DropIndex
DROP INDEX "RentPayment_bankTransactionId_key";

-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN     "accountId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "bankLabel" TEXT;

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankTransaction_accountId_date_idx" ON "BankTransaction"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_accountId_externalId_key" ON "BankTransaction"("accountId", "externalId");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

