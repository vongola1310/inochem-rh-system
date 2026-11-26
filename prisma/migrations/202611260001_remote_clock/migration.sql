ALTER TABLE "User" ADD COLUMN "isRemote" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "RemotePunch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('ENTRY', 'EXIT')),
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seconds" INTEGER NOT NULL CHECK ("seconds" >= 0 AND "seconds" < 86400),
  "photo" BYTEA NOT NULL,
  CONSTRAINT "RemotePunch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RemotePunch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RemotePunch_userId_date_kind_key" ON "RemotePunch"("userId", "date", "kind");
CREATE INDEX "RemotePunch_date_userId_idx" ON "RemotePunch"("date", "userId");
