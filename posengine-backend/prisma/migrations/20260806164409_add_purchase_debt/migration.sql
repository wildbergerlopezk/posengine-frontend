-- CreateEnum
CREATE TYPE "PurchaseDebtScheduleType" AS ENUM ('NONE', 'OWNER_REMINDER', 'SUPPLIER_SCHEDULE');

-- CreateEnum
CREATE TYPE "PurchaseDebtStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseDebtInstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "purchase_debts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL,
    "scheduleType" "PurchaseDebtScheduleType" NOT NULL DEFAULT 'NONE',
    "dueDate" TIMESTAMP(3),
    "status" "PurchaseDebtStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_debt_installments" (
    "id" TEXT NOT NULL,
    "purchaseDebtId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseDebtInstallmentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "purchase_debt_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_debt_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseDebtId" TEXT NOT NULL,
    "installmentId" TEXT,
    "cashSessionId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_debt_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_debts_purchaseId_key" ON "purchase_debts"("purchaseId");

-- CreateIndex
CREATE INDEX "purchase_debts_tenantId_idx" ON "purchase_debts"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_debt_installments_purchaseDebtId_idx" ON "purchase_debt_installments"("purchaseDebtId");

-- CreateIndex
CREATE INDEX "purchase_debt_payments_tenantId_idx" ON "purchase_debt_payments"("tenantId");

-- CreateIndex
CREATE INDEX "purchase_debt_payments_purchaseDebtId_idx" ON "purchase_debt_payments"("purchaseDebtId");

-- AddForeignKey
ALTER TABLE "purchase_debts" ADD CONSTRAINT "purchase_debts_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_debts" ADD CONSTRAINT "purchase_debts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_debt_installments" ADD CONSTRAINT "purchase_debt_installments_purchaseDebtId_fkey" FOREIGN KEY ("purchaseDebtId") REFERENCES "purchase_debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_debt_payments" ADD CONSTRAINT "purchase_debt_payments_purchaseDebtId_fkey" FOREIGN KEY ("purchaseDebtId") REFERENCES "purchase_debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_debt_payments" ADD CONSTRAINT "purchase_debt_payments_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "purchase_debt_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
