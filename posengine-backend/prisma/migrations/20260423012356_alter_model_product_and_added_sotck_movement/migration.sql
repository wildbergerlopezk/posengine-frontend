/*
  Warnings:

  - You are about to drop the column `taxRate` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `products` table. All the data in the column will be lost.
  - Made the column `cost` on table `products` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "taxRate",
DROP COLUMN "unit",
ALTER COLUMN "cost" SET NOT NULL;

-- DropEnum
DROP TYPE "ProductUnit";
