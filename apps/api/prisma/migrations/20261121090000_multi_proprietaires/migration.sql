-- Multipropriétaires : signature des bailleurs, mot de passe provisoire, sessions, créateur des locataires
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "signaturePath" TEXT;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Reprise des données : chaque locataire existant est rattaché au premier propriétaire
-- d'un bien qu'il a loué, sinon au premier administrateur.
UPDATE "Tenant" t SET "createdById" = (
  SELECT o."userId" FROM "Lease" l
  JOIN "Ownership" o ON o."propertyId" = l."propertyId"
  WHERE l."tenantId" = t."id"
  ORDER BY l."startDate", o."createdAt"
  LIMIT 1
) WHERE t."createdById" IS NULL;

UPDATE "Tenant" SET "createdById" = (
  SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" LIMIT 1
) WHERE "createdById" IS NULL;
