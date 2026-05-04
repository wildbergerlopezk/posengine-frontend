-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "maxDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "notes" TEXT;
