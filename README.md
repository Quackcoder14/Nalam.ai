# nalam.ai — Longitudinal Health Memory Platform

> **Team:** nalam.ai · **Track:** AI for Healthcare · **Hackathon:** HH26

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-v5-2D3748)](https://prisma.io)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED)](Dockerfile)

---

## What is this

**nalam.ai** is a privacy-preserving, AI-powered longitudinal health memory layer that aggregates a patient's fragmented medical records across disconnected EHR systems into a single, encrypted, self-sovereign identity vault — accessible by clinicians only with patient-granted, zero-trust consent.

---

## Why we built this

**Motivation:** Patients in India visit multiple hospitals, clinics, and specialists — yet their health history lives in disconnected silos. Doctors make decisions without full context; patients carry paper records. nalam.ai solves this with a unified, AI-synthesized health memory that travels with the patient.

**Goals:**
- Unify fragmented medical records across providers via a single encrypted vault
- Give patients granular consent control over who accesses their data
- Equip clinicians with AI-synthesized context, a longitudinal timeline, and precision medicine simulations
- Ensure data privacy: all PII/PHI encrypted at rest with AES-256-GCM before MySQL storage

---

## Repository Structure

```
sentinel/
├── src/                        # Next.js application (App Router)
│   ├── app/                    # Pages and API routes
│   │   ├── page.tsx            # Splash + Login page
│   │   ├── dashboard/          # Patient dashboard
│   │   ├── feed/               # Feed Input (Wearables + OCR Scanner)
│   │   ├── clinician/          # Clinician portal
│   │   └── api/                # Backend API routes
│   │       ├── patient/        # Patient CRUD + consent
│   │       ├── audit/          # Zero-trust audit log
│   │       ├── ocr/            # Groq Vision OCR endpoint
│   │       ├── clinician/      # Context request + access control
│   │       └── agents/         # AI agent pipeline (biographer, intervention, twin)
│   ├── ml-service/             # Python FastAPI ML service
│   │   ├── main.py             # Medication effectiveness & intervention endpoints
│   │   ├── data.ts             # Data access layer (Prisma + CSV fallback)
│   │   └── prisma.ts           # Prisma singleton
├── prisma/
│   └── schema.prisma           # MySQL schema (Patient, MedicalRecord, AuditLog)
├── datasets/                   # Sample datasets and ingestion notes
│   ├── patients.csv
│   ├── medical_records.csv
│   └── DATASETS.md
├── challenges/                 # Hackathon challenge descriptions
├── docs/                       # Architecture & onboarding docs
├── scripts/                    # Setup, seed, and run scripts
├── .github/                    # Issue/PR templates and CI
├── Dockerfile                  # Production Next.js container
├── docker-compose.yml          # Full stack: Next.js + MySQL + ML service
├── SCOREBOARD.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## Key Links

- **Project board / scoreboard:** [SCOREBOARD.md](SCOREBOARD.md)
- **Contribution guide:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Architecture diagram:** [docs/architecture.md](docs/architecture.md)

---

## Dockerization

We provide a production-ready multi-stage Dockerfile for the Next.js frontend and a `docker-compose.yml` that orchestrates the full stack (Next.js + MySQL 8.0 + Python ML service).

### Files added

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage Next.js production image |
| `docker-compose.yml` | Full stack: app + MySQL + ML service |

### Build and run (Docker)

```bash
# Build image
docker build -t nalam-ai:latest .

# Run container
docker run --rm -p 3000:3000 --env-file .env nalam-ai:latest
```

### Using Docker Compose (recommended)

```bash
# Copy environment template
cp .env.example .env
# Fill in ENCRYPTION_KEY and GROQ_API_KEY in .env

# Start all services (rebuilds on first run)
docker-compose up --build

# Stop all services
docker-compose down
```

### Service URLs

| Service | URL |
|---|---|
| Next.js frontend | http://localhost:3000 |
| Python ML API | http://localhost:8001 |
| MySQL | localhost:3306 |

---

## Prerequisites

- **Docker** >= 20.x (with BuildKit)
- **Docker Compose** v2 (`docker compose` or `docker-compose`)
- **Node.js** >= 18 (for local development without Docker)
- **Python** >= 3.10 (for ML service local dev)
- **MySQL** 8.0 (bundled in Docker Compose)

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/your-team/nalam-ai.git
cd nalam-ai/sentinel

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local: set DATABASE_URL, ENCRYPTION_KEY, GROQ_API_KEY

# 4. Create database and run migrations
scripts/setup.bat      # Windows
# or: bash scripts/setup.sh  (Linux/Mac)

# 5. Seed the database with encrypted patient data
npx tsx scripts/seed.ts

# 6. Start the dev server
npm run dev
# → http://localhost:3000
```

---

## Development

```bash
# Install dependencies
npm install

# Run Next.js dev server (hot reload)
npm run dev

# Run Python ML service
cd src/ml-service && pip install -r requirements.txt && uvicorn main:app --port 8005 --reload

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

## Testing

Automated acceptance tests live in `challenges/`. Integration tests cover:
- Encryption round-trips (encrypt → store → decrypt → compare)
- API route responses for patient CRUD, consent, and audit
- Biographer and intervention agent outputs

```bash
# Run challenge acceptance tests (when implemented)
pytest tests/
```

---

## Security

- All PII/PHI fields encrypted with **AES-256-GCM** before database storage
- `ENCRYPTION_KEY` and `DATABASE_URL` are **never committed** — use `.env.local`
- `.env*` files are in `.gitignore`
- Zero-trust audit log records every clinician data access with encrypted reason

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Patient / Clinician)      │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────────────────────┐
│           Next.js 16 App (App Router)                │
│  /dashboard  /feed  /clinician  /api/*               │
└──────┬──────────────────────────┬────────────────────┘
       │ Prisma ORM               │ HTTP
┌──────▼──────────┐    ┌──────────▼──────────┐
│  MySQL 8.0      │    │  FastAPI ML Service  │
│  (nalamdb)      │    │  (port 8001)         │
│  AES-256-GCM    │    │  sklearn + Groq      │
│  encrypted PII  │    └─────────────────────┘
└─────────────────┘
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, PR templates, and team workflow.

---

## Maintainers

**Team nalam.ai** — contact: team@nalam.ai

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

- [Groq](https://groq.com) — ultra-fast LLM inference for OCR, biographer synthesis, and intervention analysis
- [Prisma](https://prisma.io) — type-safe ORM for MySQL
- [Next.js](https://nextjs.org) — React framework with App Router
- [Recharts](https://recharts.org) — BP trend visualization
- [Lucide React](https://lucide.dev) — icon system
- [scikit-learn](https://scikit-learn.org) — medication effectiveness ML model
- [FastAPI](https://fastapi.tiangolo.com) — Python ML service framework
