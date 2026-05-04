/*
  Warnings:

  - The values [CANCELLED,REFUNDED] on the enum `SaleStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `notes` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `sales` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('UNIT', 'KG', 'G', 'L', 'ML', 'MG');

-- AlterEnum
BEGIN;
CREATE TYPE "SaleStatus_new" AS ENUM ('COMPLETED');
ALTER TABLE "public"."sales" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sales" ALTER COLUMN "status" TYPE "SaleStatus_new" USING ("status"::text::"SaleStatus_new");
ALTER TYPE "SaleStatus" RENAME TO "SaleStatus_old";
ALTER TYPE "SaleStatus_new" RENAME TO "SaleStatus";
DROP TYPE "public"."SaleStatus_old";
ALTER TABLE "sales" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';
COMMIT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "unitType" "UnitType" NOT NULL DEFAULT 'UNIT',
ALTER COLUMN "stock" SET DEFAULT 0,
ALTER COLUMN "stock" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "stockMinimum" SET DEFAULT 0,
ALTER COLUMN "stockMinimum" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sales" DROP COLUMN "notes",
DROP COLUMN "paymentMethod";

-- DropEnum
DROP TYPE "PaymentMethod";
