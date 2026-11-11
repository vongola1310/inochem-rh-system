-- CreateEnum
CREATE TYPE "MedicalLeaveKind" AS ENUM ('MATERNAL', 'GENERAL', 'WORK_RISK');

-- CreateEnum
CREATE TYPE "AttendanceImportStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttendanceReviewStatus" AS ENUM ('WAITING_EMPLOYEE', 'WAITING_MANAGER', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AttendanceDecision" AS ENUM ('PENDING', 'NONE', 'JUSTIFIED', 'LATE', 'ABSENCE', 'EARLY_EXIT', 'LATE_EARLY_EXIT');

-- AlterEnum
ALTER TYPE "RequestType" ADD VALUE 'PERMIT_HOME_OFFICE';

-- CreateTable
CREATE TABLE "MedicalLeave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "calendarDays" INTEGER NOT NULL,
    "series" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "kind" "MedicalLeaveKind" NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceImport" (
    "id" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "AttendanceImportStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceDigest" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "configuration" JSONB NOT NULL,
    "preview" JSONB NOT NULL,
    "previewHash" TEXT NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "needsRefresh" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDay" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerId" TEXT,
    "date" DATE NOT NULL,
    "isWorkday" BOOLEAN NOT NULL DEFAULT true,
    "entrySeconds" INTEGER,
    "exitSeconds" INTEGER,
    "exitEstimated" BOOLEAN NOT NULL DEFAULT false,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "detectedIssues" TEXT[],
    "coverage" TEXT[],
    "systemNotes" TEXT[],
    "evidence" JSONB NOT NULL,
    "reviewStatus" "AttendanceReviewStatus" NOT NULL,
    "decision" "AttendanceDecision" NOT NULL DEFAULT 'PENDING',
    "justification" TEXT,
    "submittedAt" TIMESTAMP(3),
    "managerComment" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "importId" TEXT,
    "dayId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicalLeave_userId_startDate_endDate_idx" ON "MedicalLeave"("userId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalLeave_userId_series_folio_key" ON "MedicalLeave"("userId", "series", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceImport_sourceDigest_key" ON "AttendanceImport"("sourceDigest");

-- CreateIndex
CREATE INDEX "AttendanceImport_startDate_endDate_status_idx" ON "AttendanceImport"("startDate", "endDate", "status");

-- CreateIndex
CREATE INDEX "AttendanceDay_managerId_reviewStatus_idx" ON "AttendanceDay"("managerId", "reviewStatus");

-- CreateIndex
CREATE INDEX "AttendanceDay_importId_reviewStatus_idx" ON "AttendanceDay"("importId", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDay_userId_date_key" ON "AttendanceDay"("userId", "date");

-- CreateIndex
CREATE INDEX "AttendanceEvent_importId_createdAt_idx" ON "AttendanceEvent"("importId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_dayId_createdAt_idx" ON "AttendanceEvent"("dayId", "createdAt");

-- AddForeignKey
ALTER TABLE "MedicalLeave" ADD CONSTRAINT "MedicalLeave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AttendanceImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDay" ADD CONSTRAINT "AttendanceDay_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_importId_fkey" FOREIGN KEY ("importId") REFERENCES "AttendanceImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "AttendanceDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
