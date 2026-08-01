-- CreateTable
CREATE TABLE "internal_receipts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerId" TEXT,
    "docNumber" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "snapshot" JSONB NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_receipts_saleId_key" ON "internal_receipts"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "internal_receipts_companyId_docNumber_key" ON "internal_receipts"("companyId", "docNumber");

-- AddForeignKey
ALTER TABLE "internal_receipts" ADD CONSTRAINT "internal_receipts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_receipts" ADD CONSTRAINT "internal_receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_receipts" ADD CONSTRAINT "internal_receipts_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_receipts" ADD CONSTRAINT "internal_receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
