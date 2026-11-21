-- Phase 4 : historique des révisions de loyer (IRL) ; régularisation des charges unique par bail et par année.
-- La table ChargeRegularization est vide jusqu'ici (créée par init, jamais utilisée) : les colonnes NOT NULL passent.

-- AlterTable
ALTER TABLE "ChargeRegularization" ADD COLUMN     "daysInYear" INTEGER NOT NULL,
ADD COLUMN     "occupiedDays" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "RentRevision" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "previousRent" DOUBLE PRECISION NOT NULL,
    "newRent" DOUBLE PRECISION NOT NULL,
    "previousIrlValue" DOUBLE PRECISION NOT NULL,
    "previousIrlQuarter" INTEGER NOT NULL,
    "previousIrlYear" INTEGER NOT NULL,
    "newIrlValue" DOUBLE PRECISION NOT NULL,
    "newIrlYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentRevision_leaseId_effectiveDate_idx" ON "RentRevision"("leaseId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeRegularization_leaseId_year_key" ON "ChargeRegularization"("leaseId", "year");

-- AddForeignKey
ALTER TABLE "RentRevision" ADD CONSTRAINT "RentRevision_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

