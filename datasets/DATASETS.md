# Datasets — nalam.ai

## Overview

All sample datasets are stored in `data/` and are used to seed the MySQL database with encrypted patient records during development and demonstration.

---

## patients.csv

**Location:** `data/patients.csv`  
**Format:** CSV with header row  
**Records:** 12 synthetic patients

| Column | Type | Encrypted in DB | Description |
|---|---|---|---|
| `id` | string | No | Patient ID (P001–P012) |
| `name` | string | ✅ Yes | Full name |
| `dob` | string | ✅ Yes | Date of birth (YYYY-MM-DD) |
| `gender` | string | ✅ Yes | Male / Female |
| `contact` | string | ✅ Yes | Email address |
| `consent_emergency` | boolean | No | ER access consent |
| `consent_specialist` | boolean | No | Specialist access consent |
| `consent_research` | boolean | No | Research participation consent |

**Note:** All encrypted fields are stored as `iv:authTag:ciphertext` hex strings in MySQL using AES-256-GCM.

---

## medical_records.csv

**Location:** `data/medical_records.csv`  
**Format:** CSV with header row  
**Records:** 7+ clinical events across patients

| Column | Type | Encrypted in DB | Description |
|---|---|---|---|
| `record_id` | string | No | Unique record ID |
| `patient_id` | string | No | Foreign key to Patient |
| `date` | string | No | Visit date (YYYY-MM-DD) |
| `type` | string | ✅ Yes | Visit type (e.g. Cardiology Visit) |
| `provider` | string | ✅ Yes | Provider name / hospital |
| `diagnosis` | string | ✅ Yes | Primary diagnosis |
| `notes` | string | ✅ Yes | Clinical notes |
| `lab_results` | string | ✅ Yes | Lab values (BP, HbA1c, eGFR…) |

---

## Ingestion

```bash
# Seed all datasets into MySQL (encrypts all sensitive fields automatically)
npx tsx scripts/seed.ts
```

The seed script reads both CSVs, encrypts each sensitive field individually using the `ENCRYPTION_KEY` environment variable, and upserts records into the `nalamdb` MySQL database via Prisma.

---

## Data Privacy

All data in these files is **100% synthetic** — no real patient information. The CSV files serve as seed data only. In production, data would be ingested directly from HL7 FHIR R4-compliant EHR APIs.
