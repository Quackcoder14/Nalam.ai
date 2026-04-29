-- =============================================================
-- nalam.ai  –  MySQL Database Setup
-- Run this once before `npx prisma migrate dev`
-- =============================================================

CREATE DATABASE IF NOT EXISTS `nalamdb`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `nalamdb`;

-- Prisma will create the tables via `prisma migrate dev`.
-- This file documents the expected schema for reference.

-- ── patients ──────────────────────────────────────────────────
-- name_enc, dob_enc, gender_enc, contact_enc:
--   AES-256-GCM encrypted blob stored as  iv:authTag:ciphertext
-- consent_* columns: plain boolean — not PII
-- ─────────────────────────────────────────────────────────────

-- ── medical_records ──────────────────────────────────────────
-- type_enc, provider_enc, diagnosis_enc, notes_enc, lab_results_enc:
--   AES-256-GCM encrypted
-- date, patient_id: plain — required for timeline ordering
-- ─────────────────────────────────────────────────────────────

-- ── audit_logs ────────────────────────────────────────────────
-- clinician_enc, reason_enc: AES-256-GCM encrypted
-- context_type, patient_id, created_at: plain metadata
-- ─────────────────────────────────────────────────────────────

-- To verify encryption at rest, run:
-- SELECT id, name_enc FROM patients LIMIT 5;
-- You should see hex-encoded ciphertext, not plaintext names.
