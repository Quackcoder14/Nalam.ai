-- AlterTable
ALTER TABLE "clinical_alerts" ADD COLUMN     "acknowledged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acknowledged_at" TIMESTAMP(3),
ADD COLUMN     "acknowledged_by" TEXT;
