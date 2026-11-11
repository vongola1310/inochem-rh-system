ALTER TABLE "User" ADD COLUMN "canUploadFieldReports" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "FieldReport" (
  "id" TEXT NOT NULL, "managerId" TEXT NOT NULL, "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
  "sourceDigest" TEXT NOT NULL, "source" JSONB NOT NULL, "mappings" JSONB NOT NULL,
  "coverageMode" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 0,
  "confirmedAt" TIMESTAMP(3), "confirmedPreview" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldReport_status_check" CHECK ("status" IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
  CONSTRAINT "FieldReport_coverageMode_check" CHECK ("coverageMode" IN ('RANGE', 'END_DAY')),
  CONSTRAINT "FieldReport_dates_check" CHECK ("endDate" >= "startDate")
);
CREATE TABLE "FieldReportDay" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "userId" TEXT NOT NULL, "date" DATE NOT NULL, "evidence" JSONB NOT NULL,
  CONSTRAINT "FieldReportDay_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FieldReportSchedule" (
  "userId" TEXT NOT NULL, "nextDueDate" DATE NOT NULL, "lastReminderDate" DATE, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldReportSchedule_pkey" PRIMARY KEY ("userId")
);
CREATE UNIQUE INDEX "FieldReport_managerId_sourceDigest_startDate_endDate_key" ON "FieldReport"("managerId", "sourceDigest", "startDate", "endDate");
CREATE INDEX "FieldReport_status_startDate_endDate_idx" ON "FieldReport"("status", "startDate", "endDate");
CREATE UNIQUE INDEX "FieldReportDay_reportId_userId_date_key" ON "FieldReportDay"("reportId", "userId", "date");
CREATE INDEX "FieldReportDay_userId_date_idx" ON "FieldReportDay"("userId", "date");
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldReportDay" ADD CONSTRAINT "FieldReportDay_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "FieldReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldReportDay" ADD CONSTRAINT "FieldReportDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldReportSchedule" ADD CONSTRAINT "FieldReportSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
