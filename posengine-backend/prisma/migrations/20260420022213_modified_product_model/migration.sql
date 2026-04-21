/*
  Warnings:

  - A unique constraint covering the columns `[sku,tenantId]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[barcode,tenantId]` on the table `products` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('UNIT', 'METER', 'LITER', 'KILOGRAM', 'GRAM', 'PIECE', 'BOX', 'PACK');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "cost" DOUBLE PRECISION,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockMinimum" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unit" "ProductUnit" NOT NULL DEFAULT 'UNIT';

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_tenantId_key" ON "products"("sku", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_tenantId_key" ON "products"("barcode", "tenantId");
