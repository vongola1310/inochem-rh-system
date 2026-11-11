CREATE TABLE "ReducedWorkday" (
  "id" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "site" TEXT NOT NULL,
  "startSeconds" INTEGER NOT NULL,
  "endSeconds" INTEGER NOT NULL,
  "notes" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "cancelledAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReducedWorkday_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReducedWorkday_dates_check" CHECK ("endDate" >= "startDate"),
  CONSTRAINT "ReducedWorkday_site_check" CHECK ("site" IN ('AJUSCO', 'PERIFERICO', 'BOTH')),
  CONSTRAINT "ReducedWorkday_hours_check" CHECK ("startSeconds" >= 28800 AND "endSeconds" <= 61200 AND "endSeconds" > "startSeconds" AND "endSeconds" - "startSeconds" < 32400)
);
CREATE INDEX "ReducedWorkday_startDate_endDate_idx" ON "ReducedWorkday"("startDate", "endDate");
ALTER TYPE "AttendanceDecision" ADD VALUE 'INCIDENT';
