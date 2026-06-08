-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "name_enc" TEXT NOT NULL,
    "dob_enc" TEXT NOT NULL,
    "gender_enc" TEXT NOT NULL,
    "contact_enc" TEXT NOT NULL,
    "blood_type_enc" TEXT NOT NULL,
    "allergies_enc" TEXT NOT NULL,
    "consent_emergency" BOOLEAN NOT NULL DEFAULT false,
    "consent_specialist" BOOLEAN NOT NULL DEFAULT false,
    "consent_research" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type_enc" TEXT NOT NULL,
    "provider_enc" TEXT NOT NULL,
    "diagnosis_enc" TEXT NOT NULL,
    "notes_enc" TEXT,
    "lab_results_enc" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "clinician_enc" TEXT NOT NULL,
    "reason_enc" TEXT NOT NULL,
    "context_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medical_records_patient_id_date_idx" ON "medical_records"("patient_id", "date");

-- CreateIndex
CREATE INDEX "audit_logs_patient_id_created_at_idx" ON "audit_logs"("patient_id", "created_at");

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
