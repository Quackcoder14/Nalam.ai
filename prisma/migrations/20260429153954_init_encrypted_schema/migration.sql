-- CreateTable
CREATE TABLE `patients` (
    `id` VARCHAR(191) NOT NULL,
    `name_enc` TEXT NOT NULL,
    `dob_enc` TEXT NOT NULL,
    `gender_enc` TEXT NOT NULL,
    `contact_enc` TEXT NOT NULL,
    `blood_type_enc` TEXT NOT NULL,
    `allergies_enc` TEXT NOT NULL,
    `consent_emergency` BOOLEAN NOT NULL DEFAULT false,
    `consent_specialist` BOOLEAN NOT NULL DEFAULT false,
    `consent_research` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medical_records` (
    `id` VARCHAR(191) NOT NULL,
    `patient_id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `type_enc` TEXT NOT NULL,
    `provider_enc` TEXT NOT NULL,
    `diagnosis_enc` TEXT NOT NULL,
    `notes_enc` LONGTEXT NULL,
    `lab_results_enc` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `medical_records_patient_id_date_idx`(`patient_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `patient_id` VARCHAR(191) NOT NULL,
    `clinician_enc` TEXT NOT NULL,
    `reason_enc` TEXT NOT NULL,
    `context_type` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_patient_id_created_at_idx`(`patient_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `medical_records` ADD CONSTRAINT `medical_records_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
