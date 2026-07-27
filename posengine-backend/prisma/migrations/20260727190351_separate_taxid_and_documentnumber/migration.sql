/*
  Warnings:

  - You are about to drop the column `documentType` on the `customers` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "customers_documentNumber_tenantId_key";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "taxId" TEXT;

-- MigrateData: Move existing RUCs to the new taxId column and clear them from documentNumber
UPDATE "customers" SET "taxId" = "documentNumber" WHERE "documentType" = 'RUC';
UPDATE "customers" SET "documentNumber" = NULL WHERE "documentType" = 'RUC';

-- AlterTable (continued)
ALTER TABLE "customers" DROP COLUMN "documentType";

-- DropEnum
DROP TYPE "DocumentType";

-- CreateIndex
CREATE UNIQUE INDEX "customers_documentNumber_tenantId_key" ON "customers"("documentNumber", "tenantId");
CREATE UNIQUE INDEX "customers_taxId_tenantId_key" ON "customers"("taxId", "tenantId");
