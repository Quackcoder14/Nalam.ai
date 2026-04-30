# nalam.ai — Architecture

## System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                        Browser (Patient / Clinician)                   │
│   /              /dashboard    /feed         /clinician                │
│  (Splash+Login)  (Patient)   (Feed Input)   (Clinician Portal)        │
└──────────────────────────────┬────────────────────────────────────────┘
                               │ HTTPS / Next.js App Router
┌──────────────────────────────▼────────────────────────────────────────┐
│                      Next.js 16 (App Router)                           │
│                                                                        │
│  API Routes (/api/*)                                                   │
│  ├── /api/patient           — CRUD, consent, ALL listing              │
│  ├── /api/audit             — Zero-trust access log (encrypted)       │
│  ├── /api/ocr               — Groq Vision document extraction         │
│  ├── /api/clinician/request-context — Consent-gated data retrieval    │
│  └── /api/agents/*                                                     │
│      ├── /biographer        — AI clinical narrative (Groq LLaMA-3)   │
│      ├── /intervention      — Risk detection + action plan            │
│      └── /twin              — Digital twin simulation                 │
└──────────┬───────────────────────────────────┬────────────────────────┘
           │ Prisma ORM (v5)                    │ HTTP fetch
┌──────────▼───────────────┐     ┌─────────────▼──────────────────────┐
│     MySQL 8.0 (nalamdb)  │     │  Python FastAPI ML Service (:8001) │
│                          │     │                                     │
│  Tables:                 │     │  POST /predict                     │
│  • patients              │     │    → sklearn RandomForest           │
│  • medical_records       │     │    → Groq narrative synthesis       │
│  • audit_logs            │     │                                     │
│                          │     │  POST /intervention                 │
│  All PII fields:         │     │    → Clinical feature extraction    │
│  AES-256-GCM encrypted   │     │    → Risk scoring                  │
└──────────────────────────┘     └────────────────────────────────────┘
```

## Security Architecture

```
Patient Data Flow:
CSV / EHR API → encrypt(field, AES-256-GCM) → MySQL (_enc columns) → decrypt() → API response

Consent Flow:
Patient toggles consent → /api/patient/consent → DB update → 
  Clinician requests context → consent check → grant/deny
  
Audit Flow:
Every context grant → /api/audit POST → encrypt(clinician, reason) → audit_logs table
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Field-level encryption | Encrypt only PII/PHI columns, keep IDs/dates plaintext for indexing |
| Prisma v5 (not v7) | v7 requires driver adapters; v5 is stable LTS with direct MySQL support |
| CSV fallback | If MySQL is unavailable, app falls back to CSV reads for high availability |
| `iv:authTag:ciphertext` format | Self-contained per-field encryption; no shared IV across fields |
| Groq LLaMA-3 | Ultra-low latency (<500ms) for real-time clinical synthesis |
| Next.js App Router | Server components for data fetching, client components for interactivity |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for AES-256-GCM |
| `GROQ_API_KEY` | Yes | Groq API key for LLM inference |
| `ML_SERVICE_URL` | No | Python ML service URL (default: http://localhost:8001) |
