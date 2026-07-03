-- AlterTable
ALTER TABLE "clinical_alerts" ADD COLUMN     "broadcast" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hospital" TEXT;

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "password_hash" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "abha_id_enc" TEXT,
ADD COLUMN     "mobile_enc" TEXT,
ADD COLUMN     "password_hash" TEXT;

-- CreateTable
CREATE TABLE "patient_files" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "filename_enc" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_data_enc" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "uploaded_by" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records_otps" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "requestor_id" TEXT NOT NULL,
    "requestor_name" TEXT NOT NULL DEFAULT '',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "records_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_desk_staff" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name_enc" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_desk_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_files_patient_id_created_at_idx" ON "patient_files"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "records_otps_patient_id_expires_at_idx" ON "records_otps"("patient_id", "expires_at");

-- CreateIndex
CREATE INDEX "chatbot_conversations_user_id_user_role_idx" ON "chatbot_conversations"("user_id", "user_role");

-- CreateIndex
CREATE INDEX "chatbot_messages_conversation_id_created_at_idx" ON "chatbot_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_desk_staff_username_key" ON "hospital_desk_staff"("username");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_desk_staff_staff_id_key" ON "hospital_desk_staff"("staff_id");

-- CreateIndex
CREATE INDEX "hospital_desk_staff_branch_status_idx" ON "hospital_desk_staff"("branch", "status");

-- CreateIndex
CREATE INDEX "clinical_alerts_hospital_is_read_idx" ON "clinical_alerts"("hospital", "is_read");

-- AddForeignKey
ALTER TABLE "patient_files" ADD CONSTRAINT "patient_files_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records_otps" ADD CONSTRAINT "records_otps_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chatbot_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
