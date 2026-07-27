-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "taxId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "economicActivity" TEXT,
    "emissionPoint" TEXT NOT NULL DEFAULT '001-001',
    "currentSequence" INTEGER NOT NULL DEFAULT 1,
    "logoUrl" TEXT,
    "stampNumber" TEXT,
    "stampStartDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CompanyToTenant" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CompanyToTenant_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_taxId_key" ON "companies"("taxId");

-- CreateIndex
CREATE INDEX "_CompanyToTenant_B_index" ON "_CompanyToTenant"("B");

-- AddForeignKey
ALTER TABLE "_CompanyToTenant" ADD CONSTRAINT "_CompanyToTenant_A_fkey" FOREIGN KEY ("A") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToTenant" ADD CONSTRAINT "_CompanyToTenant_B_fkey" FOREIGN KEY ("B") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
