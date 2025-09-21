-- CreateEnum
CREATE TYPE "public"."ContributionStatus" AS ENUM ('PENDING', 'MATCHED', 'MISSING');

-- CreateEnum
CREATE TYPE "public"."PdfKind" AS ENUM ('LISTADO', 'TRANSFER');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateTable
CREATE TABLE "public"."Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuit" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'Argentina',
    "responsibleName" TEXT,
    "responsibleEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Member" (
    "id" TEXT NOT NULL,
    "numeroOrden" TEXT NOT NULL,
    "numeroMatricula" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "institucionId" TEXT,
    "documentoIdentidad" TEXT NOT NULL,
    "nacionalidad" TEXT NOT NULL DEFAULT 'Argentina',
    "status" TEXT NOT NULL DEFAULT 'active',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'Argentina',
    "membershipStartDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollPeriod" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "concept" TEXT NOT NULL,
    "peopleCount" INTEGER,
    "totalAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContributionLine" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "memberId" TEXT,
    "rawName" TEXT NOT NULL,
    "quantity" INTEGER,
    "legajos" INTEGER,
    "conceptAmount" DECIMAL(18,2),
    "totalRem" DECIMAL(18,2),
    "status" "public"."ContributionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankTransfer" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "datetime" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "operationNo" TEXT,
    "cbuDestino" TEXT,
    "cuentaOrigen" TEXT,
    "importe" DECIMAL(18,2) NOT NULL,
    "cuitOrdenante" TEXT,
    "cuitBenef" TEXT,
    "titular" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PdfFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "kind" "public"."PdfKind" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "parsed" BOOLEAN NOT NULL DEFAULT false,
    "parseErrors" TEXT,
    "uploadedBy" TEXT,
    "institutionId" TEXT,
    "periodId" TEXT,
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_cuit_key" ON "public"."Institution"("cuit");

-- CreateIndex
CREATE INDEX "Institution_name_idx" ON "public"."Institution"("name");

-- CreateIndex
CREATE INDEX "Institution_cuit_idx" ON "public"."Institution"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "Member_numeroOrden_key" ON "public"."Member"("numeroOrden");

-- CreateIndex
CREATE UNIQUE INDEX "Member_numeroMatricula_key" ON "public"."Member"("numeroMatricula");

-- CreateIndex
CREATE UNIQUE INDEX "Member_documentoIdentidad_key" ON "public"."Member"("documentoIdentidad");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "public"."Member"("email");

-- CreateIndex
CREATE INDEX "Member_lastName_firstName_idx" ON "public"."Member"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Member_institucionId_idx" ON "public"."Member"("institucionId");

-- CreateIndex
CREATE INDEX "PayrollPeriod_institutionId_year_month_idx" ON "public"."PayrollPeriod"("institutionId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_institutionId_month_year_concept_key" ON "public"."PayrollPeriod"("institutionId", "month", "year", "concept");

-- CreateIndex
CREATE INDEX "ContributionLine_periodId_idx" ON "public"."ContributionLine"("periodId");

-- CreateIndex
CREATE INDEX "ContributionLine_memberId_idx" ON "public"."ContributionLine"("memberId");

-- CreateIndex
CREATE INDEX "BankTransfer_institutionId_datetime_idx" ON "public"."BankTransfer"("institutionId", "datetime");

-- CreateIndex
CREATE INDEX "BankTransfer_importe_idx" ON "public"."BankTransfer"("importe");

-- CreateIndex
CREATE INDEX "PdfFile_kind_idx" ON "public"."PdfFile"("kind");

-- CreateIndex
CREATE INDEX "PdfFile_institutionId_idx" ON "public"."PdfFile"("institutionId");

-- CreateIndex
CREATE INDEX "PdfFile_periodId_idx" ON "public"."PdfFile"("periodId");

-- CreateIndex
CREATE INDEX "PdfFile_transferId_idx" ON "public"."PdfFile"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."Member" ADD CONSTRAINT "Member_institucionId_fkey" FOREIGN KEY ("institucionId") REFERENCES "public"."Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "public"."Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContributionLine" ADD CONSTRAINT "ContributionLine_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContributionLine" ADD CONSTRAINT "ContributionLine_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankTransfer" ADD CONSTRAINT "BankTransfer_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "public"."Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PdfFile" ADD CONSTRAINT "PdfFile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "public"."Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PdfFile" ADD CONSTRAINT "PdfFile_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PdfFile" ADD CONSTRAINT "PdfFile_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "public"."BankTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
