-- AlterTable
ALTER TABLE "IrlIndex" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';
