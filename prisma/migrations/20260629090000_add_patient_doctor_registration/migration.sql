-- Patient registration fields used by hospital desk intake.
ALTER TABLE "patients" ADD COLUMN "email_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "address_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "city_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "district_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "state_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "pincode_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "guardian_name_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "emergency_name_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "emergency_relation_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "emergency_phone_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "occupation_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "marital_status_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "preferred_language_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "insurance_provider_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "insurance_policy_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "aadhaar_last4_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "chronic_conditions_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "current_medications_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "past_surgeries_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "family_history_enc" TEXT;
ALTER TABLE "patients" ADD COLUMN "lifestyle_notes_enc" TEXT;

-- Richer clinical record metadata for manual intake.
ALTER TABLE "medical_records" ADD COLUMN "department_enc" TEXT;
ALTER TABLE "medical_records" ADD COLUMN "doctor_name_enc" TEXT;
ALTER TABLE "medical_records" ADD COLUMN "medications_enc" TEXT;
ALTER TABLE "medical_records" ADD COLUMN "procedures_enc" TEXT;
ALTER TABLE "medical_records" ADD COLUMN "vitals_json_enc" TEXT;
ALTER TABLE "medical_records" ADD COLUMN "follow_up_date" TEXT;
ALTER TABLE "medical_records" ADD COLUMN "attachments_json_enc" TEXT;

CREATE TABLE "doctors" (
  "id" TEXT NOT NULL,
  "full_name_enc" TEXT NOT NULL,
  "gender_enc" TEXT,
  "dob_enc" TEXT,
  "mobile_enc" TEXT,
  "email_enc" TEXT,
  "registration_number" TEXT NOT NULL,
  "registration_council" TEXT NOT NULL,
  "registration_year" TEXT,
  "qualification_enc" TEXT NOT NULL,
  "specialty" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "designation" TEXT,
  "hospital" TEXT NOT NULL,
  "experience_years" INTEGER,
  "languages_json" TEXT,
  "consultation_modes_json" TEXT,
  "available_days_json" TEXT,
  "time_slots_json" TEXT,
  "room_number_enc" TEXT,
  "address_enc" TEXT,
  "district" TEXT,
  "state" TEXT DEFAULT 'Tamil Nadu',
  "pincode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doctors_registration_council_registration_number_key"
ON "doctors"("registration_council", "registration_number");

CREATE INDEX "doctors_hospital_specialty_status_idx"
ON "doctors"("hospital", "specialty", "status");
