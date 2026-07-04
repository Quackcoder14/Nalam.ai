# nalam.ai — Longitudinal Health Memory Platform

> **Team:** nalam.ai · **Track:** AI for Healthcare · **Hackathon:** HH26

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-v5-2D3748)](https://prisma.io)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED)](Dockerfile)

---

## 🌟 What is this?

**nalam.ai** is a privacy-preserving, AI-powered longitudinal health memory layer that aggregates a patient's fragmented medical records across disconnected EHR systems into a single, encrypted, self-sovereign identity vault — accessible by clinicians only with patient-granted, zero-trust consent.

Our platform is bilingual, supporting full **English and Tamil** localization out of the box to ensure regional accessibility across India.

---

## 🤔 Why we built this

**Motivation:** Patients in India visit multiple hospitals, clinics, and specialists — yet their health history lives in disconnected silos. Doctors make decisions without full context; patients carry paper records. nalam.ai solves this with a unified, AI-synthesized health memory that travels with the patient.

**Goals:**
- Unify fragmented medical records across providers via a single encrypted vault.
- Give patients granular consent control over who accesses their data.
- Equip clinicians with AI-synthesized context, a longitudinal timeline, and precision medicine simulations.
- Ensure data privacy: all PII/PHI encrypted at rest with AES-256-GCM before MySQL storage.
- Enable real-time communication & critical alerts via integrated Chat and Web Push notifications.
- Support regional accessibility with robust Internationalization (i18n) for English & Tamil.

---

## 🚀 Key Features

### 1. Zero-Trust Encrypted Health Vault
- All PII (Personally Identifiable Information) and PHI (Protected Health Information) are fully encrypted at rest using **AES-256-GCM** before being stored in MySQL.
- Granular consent control: Clinicians cannot access a patient's context without explicit OTP/consent approval.

### 2. Intelligent Intervention Engine
- A dedicated **Python ML Service** (built with FastAPI) analyzes patient lab results (BP, HbA1c, eGFR) and generates real-time Risk Scores (0-10).
- Dynamically generates numbered Action Plans, detects anomalies, and visualizes a longitudinal **Risk History** chart over the last 6 months.

### 3. Context-Aware Medical Chatbots (Powered by Groq Llama-3)
- **Patient Chatbot:** A fully bilingual (English/Tamil) health assistant that has secure access to the patient's vitals, medical history, and appointments. It strictly adheres to clinical boundaries (no diagnosing or prescribing) and features an advanced **Emergency Detection System** that flags 25+ critical keywords (e.g., chest pain, stroke) to immediately trigger ambulance or family alerts.
- **Clinician Chatbot:** A context-switching assistant for doctors. It maintains a general medical context by default, but instantly gains access to a specific patient's medical records and vitals once the doctor requests and receives patient consent via the Hospital Desk.

### 4. Explainable AI (XAI)
- **Transparent Predictions:** Clicking the "Explainable AI" breakdown reveals exactly how the ML model arrived at its Risk Score.
- **Feature Importance Visualization:** Interactive Radar and Bar charts display precisely how much each vital sign (BP, HbA1c, eGFR) influenced the AI's decision, along with risk direction (protective/harmful) and normal range bounds.

### 5. Hospital Desk & Document Scanner
- A centralized portal for clinicians to look up patients, view notifications, and request context access.
- **AI Document Scanner:** Allows doctors to upload raw prescriptions, lab reports, or medical documents (JPG, PNG, PDF). Extracts structured medical data via Vision AI for instant EHR integration.

### 6. Data Sync Hub & Voice Triage
- **Wearables Integration:** Connects with Apple Health, Google Fit, and other Medical IoT devices for continuous patient monitoring.
- **Voice Triage:** Patients can speak out their symptoms. The Voice Triage system transcribes audio to text in real-time and analyzes symptoms for instant urgency detection.

### 7. eSanjeevani ABDM Compatibility
- One-click **FHIR Vault Export** to generate ABDM-compliant JSON bundles, making it fully interoperable with India's eSanjeevani network.

---

## 📁 Repository Structure

```
nalam-ai/
├── src/                        # Next.js application (App Router)
│   ├── app/                    # Pages and API routes
│   │   ├── page.tsx            # Splash + Login page
│   │   ├── dashboard/          # Patient dashboard (Vitals, Intervention, Chatbot)
│   │   ├── hospital-desk/      # Clinician portal (Patient Lookup, Timeline, Scanner)
│   │   ├── components/         # Reusable UI (Chatbot, Nav, etc.)
│   │   └── api/                # Backend API routes
│   │       ├── patient/        # Patient CRUD + consent
│   │       ├── chatbot/        # Groq-powered Context-Aware Chatbots
│   │       ├── clinician/      # Context request + access control
│   │       └── agents/         # AI agent proxy routes (Intervention)
│   ├── lib/                    # Shared utilities
│   │   ├── i18n.tsx            # Bilingual Dictionaries (English/Tamil)
│   │   └── prisma.ts           # Prisma singleton
│   ├── ml-service/             # Python FastAPI ML service
│   │   ├── main.py             # FastAPI entry point
│   │   └── agents/             # LangGraph-style state agents (intervention.py)
├── prisma/
│   └── schema.prisma           # MySQL schema (Patient, MedicalRecord, AuditLog)
├── scripts/                    # Setup, seed, and run scripts
├── Dockerfile                  # Production Next.js container
├── docker-compose.yml          # Full stack orchestration
└── README.md
```

---

## 🔗 Key Links

- **Project board / scoreboard:** [SCOREBOARD.md](SCOREBOARD.md)
- **Contribution guide:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Architecture diagram:** [docs/architecture.md](docs/architecture.md)

---

## 🐳 Dockerization

We provide a production-ready multi-stage Dockerfile for the Next.js frontend and a `docker-compose.yml` that orchestrates the full stack (Next.js + MySQL 8.0 + Python ML service).

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

## 🛠️ Local Development (Quick Start)

### Prerequisites
- **Docker** >= 20.x (with BuildKit)
- **Docker Compose** v2 (`docker compose` or `docker-compose`)
- **Node.js** >= 18 (for local development without Docker)
- **Python** >= 3.10 (for ML service local dev)
- **MySQL** 8.0 (bundled in Docker Compose)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-team/nalam-ai.git
cd nalam-ai

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local: set DATABASE_URL, ENCRYPTION_KEY, GROQ_API_KEY

# 4. Generate Prisma Client & Push Schema
npx prisma generate
npx prisma db push

# 5. Start the Next.js dev server
npm run dev
# → http://localhost:3000
```

### Running the Python ML Service
Open a new terminal and run:
```bash
cd src/ml-service
pip install -r requirements.txt
uvicorn main:app --port 8005 --reload
# → http://localhost:8005
```

### Development Scripts

```bash
# Run Next.js dev server (hot reload)
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

## 🧪 Testing

Automated acceptance tests live in `challenges/`. Integration tests cover:
- Encryption round-trips (encrypt → store → decrypt → compare)
- API route responses for patient CRUD, consent, and audit
- Biographer and intervention agent outputs

```bash
# Run challenge acceptance tests (when implemented)
pytest tests/
```

---

## 🔒 Security & Privacy

- All PII/PHI fields are encrypted with **AES-256-GCM** before database storage.
- `ENCRYPTION_KEY` and `DATABASE_URL` are strictly local (via `.env.local`).
- `.env*` files are in `.gitignore`.
- A **Zero-trust audit log** records every clinician data access attempt, ensuring complete patient transparency.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Patient / Clinician)      │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────────────────────┐
│           Next.js 16 App (App Router)                │
│  /dashboard  /hospital-desk  /api/*                  │
└──────┬──────────────────────────┬────────────────────┘
       │ Prisma ORM               │ HTTP
┌──────▼──────────┐    ┌──────────▼──────────┐
│  MySQL 8.0      │    │  FastAPI ML Service  │
│  (nalamdb)      │    │  (port 8005)         │
│  AES-256-GCM    │    │  sklearn + Groq      │
│  encrypted PII  │    └─────────────────────┘
└─────────────────┘
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, PR templates, and team workflow.

---

## 👥 Maintainers

**Team nalam.ai** — contact: team@nalam.ai

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

## 🎉 Acknowledgements

- **[Groq](https://groq.com)** — Ultra-fast LLM inference powering the Chatbots, Vision OCR, and Intervention Agents.
- **[Prisma](https://prisma.io)** — Type-safe ORM for MySQL.
- **[Next.js](https://nextjs.org)** — React framework with App Router.
- **[Lucide React](https://lucide.dev)** — Icon system.
- **[Recharts](https://recharts.org)** — BP trend visualization.
- **[FastAPI](https://fastapi.tiangolo.com)** — High-performance Python backend for ML models.
- **[scikit-learn](https://scikit-learn.org)** — Medication effectiveness ML model.

---

**Team nalam.ai** — Building the future of longitudinal health memory.
