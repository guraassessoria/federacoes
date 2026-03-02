-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'CONSULTA');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('BP', 'DRE', 'DFC', 'DMPL', 'DE_PARA', 'BALANCETE');

-- CreateEnum
CREATE TYPE "StructureType" AS ENUM ('BP', 'DRE', 'DFC', 'DMPL', 'DVA', 'DRA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CONSULTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCompany" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CONSULTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "FileType" NOT NULL,
    "name" TEXT NOT NULL,
    "cloudStoragePath" TEXT NOT NULL,
    "period" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Balancete" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountDescription" TEXT NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL,
    "credit" DECIMAL(18,2) NOT NULL,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "accountNature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Balancete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeParaRow" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contaBalancete" TEXT NOT NULL,
    "descricaoBalancete" TEXT,
    "padraoBP" TEXT,
    "padraoDRE" TEXT,
    "padraoDFC" TEXT,
    "padraoDMPL" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeParaRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeParaMapping" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contaFederacao" TEXT NOT NULL,
    "descricaoFederacao" TEXT,
    "padraoBP" TEXT,
    "padraoDRE" TEXT,
    "padraoDFC" TEXT,
    "padraoDMPL" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeParaMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardStructure" (
    "id" TEXT NOT NULL,
    "type" "StructureType" NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardStructure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "UserCompany_userId_companyId_key" ON "UserCompany"("userId", "companyId");

-- CreateIndex
CREATE INDEX "Balancete_companyId_period_idx" ON "Balancete"("companyId", "period");

-- CreateIndex
CREATE INDEX "Balancete_accountCode_idx" ON "Balancete"("accountCode");

-- CreateIndex
CREATE UNIQUE INDEX "Balancete_companyId_period_accountCode_key" ON "Balancete"("companyId", "period", "accountCode");

-- CreateIndex
CREATE INDEX "DeParaRow_companyId_idx" ON "DeParaRow"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DeParaRow_companyId_contaBalancete_key" ON "DeParaRow"("companyId", "contaBalancete");

-- CreateIndex
CREATE INDEX "DeParaMapping_companyId_idx" ON "DeParaMapping"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DeParaMapping_companyId_contaFederacao_key" ON "DeParaMapping"("companyId", "contaFederacao");

-- CreateIndex
CREATE UNIQUE INDEX "StandardStructure_type_key" ON "StandardStructure"("type");

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFile" ADD CONSTRAINT "CompanyFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFile" ADD CONSTRAINT "CompanyFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balancete" ADD CONSTRAINT "Balancete_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeParaMapping" ADD CONSTRAINT "DeParaMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

