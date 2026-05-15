-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('PUBLIC', 'WHOLESALE');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "wholesalePrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "priceType" "PriceType" NOT NULL DEFAULT 'PUBLIC';
