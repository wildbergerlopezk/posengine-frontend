/*
  Warnings:

  - You are about to drop the column `maxDiscount` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `customers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "customers" DROP COLUMN "maxDiscount",
DROP COLUMN "notes";
