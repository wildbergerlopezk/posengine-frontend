-- AlterTable
ALTER TABLE "purchase_return_credit_applications" ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "purchase_returns" ADD COLUMN     "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "purchase_return_credit_applications_createdByUserId_idx" ON "purchase_return_credit_applications"("createdByUserId");

-- CreateIndex
CREATE INDEX "purchase_returns_createdByUserId_idx" ON "purchase_returns"("createdByUserId");

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_credit_applications" ADD CONSTRAINT "purchase_return_credit_applications_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
