/*
  Warnings:

  - Made the column `invoiceNumber` on table `purchases` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "purchases" ALTER COLUMN "invoiceNumber" SET NOT NULL;
