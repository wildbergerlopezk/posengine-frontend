/*
  Warnings:

  - Added the required column `cashSessionId` to the `purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cashSessionId` to the `sales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "cashSessionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cashSessionId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
