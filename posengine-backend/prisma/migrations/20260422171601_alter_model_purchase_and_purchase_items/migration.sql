/*
  Warnings:

  - You are about to drop the column `subtotal` on the `purchase_items` table. All the data in the column will be lost.
  - You are about to drop the column `taxAmount` on the `purchase_items` table. All the data in the column will be lost.
  - You are about to drop the column `taxRate` on the `purchase_items` table. All the data in the column will be lost.
  - You are about to drop the column `subtotal` on the `purchases` table. All the data in the column will be lost.
  - You are about to drop the column `taxAmount` on the `purchases` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "purchase_items" DROP COLUMN "subtotal",
DROP COLUMN "taxAmount",
DROP COLUMN "taxRate";

-- AlterTable
ALTER TABLE "purchases" DROP COLUMN "subtotal",
DROP COLUMN "taxAmount";
