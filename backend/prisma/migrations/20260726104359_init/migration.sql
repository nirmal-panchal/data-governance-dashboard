-- CreateEnum
CREATE TYPE "SensitivityTag" AS ENUM ('EMAIL', 'PHONE', 'NAME', 'ID', 'CREDIT_CARD', 'ADDRESS', 'DATE', 'NONE');

-- CreateEnum
CREATE TYPE "ColumnType" AS ENUM ('INTEGER', 'FLOAT', 'BOOLEAN', 'DATE', 'STRING');

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "columnCount" INTEGER NOT NULL,
    "duplicateRowCount" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "sampleRows" JSONB,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Column" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "inferredType" "ColumnType" NOT NULL DEFAULT 'STRING',
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "missingPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distinctCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "invalidPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoTag" "SensitivityTag" NOT NULL DEFAULT 'NONE',
    "manualTag" "SensitivityTag",
    "tagOverridden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Column_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dataset_uploadedAt_idx" ON "Dataset"("uploadedAt");

-- CreateIndex
CREATE INDEX "Column_datasetId_idx" ON "Column"("datasetId");

-- CreateIndex
CREATE INDEX "UsageEvent_datasetId_idx" ON "UsageEvent"("datasetId");

-- CreateIndex
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Column" ADD CONSTRAINT "Column_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
