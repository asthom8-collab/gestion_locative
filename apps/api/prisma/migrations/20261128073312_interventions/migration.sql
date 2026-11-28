-- CreateEnum
CREATE TYPE "InterventionKind" AS ENUM ('PLUMBING', 'ELECTRICITY', 'HEATING', 'PAINTING', 'CARPENTRY', 'LOCKSMITH', 'CLEANING', 'RENOVATION', 'DAMAGE', 'GARDENING', 'OTHER');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('PLANNED', 'DONE');

-- CreateEnum
CREATE TYPE "InterventionDoneBy" AS ENUM ('OWNER', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "InterventionPayer" AS ENUM ('OWNER', 'TENANT', 'INSURANCE');

-- CreateEnum
CREATE TYPE "InterventionNature" AS ENUM ('MAINTENANCE', 'IMPROVEMENT', 'CONSTRUCTION');

-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'QUOTE';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "interventionId" TEXT;

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "leaseId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "InterventionKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "InterventionStatus" NOT NULL DEFAULT 'DONE',
    "doneBy" "InterventionDoneBy" NOT NULL DEFAULT 'PROFESSIONAL',
    "providerName" TEXT,
    "cost" DOUBLE PRECISION NOT NULL,
    "paidBy" "InterventionPayer" NOT NULL DEFAULT 'OWNER',
    "fiscalNature" "InterventionNature" NOT NULL DEFAULT 'MAINTENANCE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Intervention_propertyId_date_idx" ON "Intervention"("propertyId", "date");

-- CreateIndex
CREATE INDEX "Intervention_leaseId_idx" ON "Intervention"("leaseId");

-- CreateIndex
CREATE INDEX "Document_interventionId_idx" ON "Document"("interventionId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
