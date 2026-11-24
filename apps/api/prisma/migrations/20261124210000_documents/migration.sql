-- Documents envoyés par les propriétaires : catégories de la maquette et d'un bien, rattachement à un bail ou à un bien.
-- La table était vide (modèle prévu dès init, jamais utilisé).

-- AlterEnum
BEGIN;
CREATE TYPE "DocumentCategory_new" AS ENUM ('LEASE_CONTRACT', 'INVENTORY_ENTRY', 'INVENTORY_EXIT', 'INSURANCE', 'PHOTO', 'DIAGNOSTIC', 'TITLE_DEED', 'PROPERTY_TAX', 'INVOICE', 'OTHER');
ALTER TABLE "Document" ALTER COLUMN "category" TYPE "DocumentCategory_new" USING ("category"::text::"DocumentCategory_new");
ALTER TYPE "DocumentCategory" RENAME TO "DocumentCategory_old";
ALTER TYPE "DocumentCategory_new" RENAME TO "DocumentCategory";
DROP TYPE "DocumentCategory_old";
COMMIT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "propertyId" TEXT,
ADD COLUMN     "size" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Document_leaseId_idx" ON "Document"("leaseId");

-- CreateIndex
CREATE INDEX "Document_propertyId_idx" ON "Document"("propertyId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Exactement un rattachement : un bail ou un bien
ALTER TABLE "Document" ADD CONSTRAINT "Document_owner_check" CHECK (("leaseId" IS NULL) <> ("propertyId" IS NULL));
