ALTER TABLE "users" ADD COLUMN "quickPinHash" TEXT;

CREATE TABLE "quick_pin_devices" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quick_pin_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quick_pin_devices_tokenHash_key" ON "quick_pin_devices"("tokenHash");
CREATE INDEX "quick_pin_devices_userId_revokedAt_idx" ON "quick_pin_devices"("userId", "revokedAt");
CREATE INDEX "quick_pin_devices_expiresAt_idx" ON "quick_pin_devices"("expiresAt");
ALTER TABLE "quick_pin_devices" ADD CONSTRAINT "quick_pin_devices_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
