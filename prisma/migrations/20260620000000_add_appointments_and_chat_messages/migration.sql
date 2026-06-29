-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "doctor_name" TEXT NOT NULL,
    "doctor_specialty" TEXT NOT NULL,
    "hospital" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "reason_enc" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "vitals_json" TEXT,
    "attachments_json" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ai_summary_enc" TEXT,
    "hdesk_note_enc" TEXT,
    "reschedule_reason_enc" TEXT,
    "reschedule_proposed_date" TEXT,
    "reschedule_proposed_time" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "hospital" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "content_enc" TEXT NOT NULL,
    "staff_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_patient_id_status_idx" ON "appointments"("patient_id", "status");

-- CreateIndex
CREATE INDEX "chat_messages_patient_id_hospital_idx" ON "chat_messages"("patient_id", "hospital");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'appointments_patient_id_fkey'
    ) THEN
        ALTER TABLE "appointments"
        ADD CONSTRAINT "appointments_patient_id_fkey"
        FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_patient_id_fkey'
    ) THEN
        ALTER TABLE "chat_messages"
        ADD CONSTRAINT "chat_messages_patient_id_fkey"
        FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
