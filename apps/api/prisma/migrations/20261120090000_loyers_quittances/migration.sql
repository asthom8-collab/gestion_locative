-- AlterTable
ALTER TABLE "RentPayment" ADD COLUMN     "chargesAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "periodEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "periodStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "rentAmount" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "zipCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RentPayment_leaseId_periodYear_periodMonth_key" ON "RentPayment"("leaseId", "periodYear", "periodMonth");

