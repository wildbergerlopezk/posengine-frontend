/*
  Warnings:

  - Added the required column `purchaseItemId` to the `purchase_return_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PurchaseStatus" ADD VALUE 'PARTIALLY_RETURNED';
ALTER TYPE "PurchaseStatus" ADD VALUE 'FULLY_RETURNED';

-- AlterTable
ALTER TABLE "purchase_return_items" ADD COLUMN     "purchaseItemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "purchase_returns" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "purchase_returns_tenantId_idx" ON "purchase_returns"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_returns_purchaseId_idx" ON "purchase_returns"("purchaseId");

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "purchase_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
