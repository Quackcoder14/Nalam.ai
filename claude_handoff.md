# Sentinel-Health: Master Architecture & Development Handoff

This document serves as a comprehensive handoff for Claude (or any AI agent) to understand the exact state of the **Sentinel-Health Memory Layer** project, what has been simulated for the hackathon MVP, what the production-grade equivalents should be, and the immediate next steps to complete the application.

---

## 1. Project Overview & Objective
**Sentinel-Health** is a decentralized, multi-agent longitudinal patient memory layer. It solves "institutional amnesia" by allowing patients to own their health data via Self-Sovereign Identity and grant granular, real-time "Smart Consent" to clinicians. It utilizes a swarm of AI agents to synthesize decades of data, predict risks, and recommend precision medicine interventions.

---

## 2. What Has Been Built So Far (Current State)

### Frontend (Next.js App Router)
- **Patient Dashboard (`src/app/page.tsx`)**: 
  - Simulates Self-Sovereign Identity login (Patient P001).
  - Contains the **Smart Consent Rules** module for granular data sharing.
  - Dynamically renders the **Intervention Engine** (Risk alerts) and **Biographer Agent** (Executive summary).
- **Clinician Portal (`src/app/clinician/page.tsx`)**: 
  - Zero-knowledge context retrieval based on Patient ID.
  - Houses the **Twin Simulation Engine** for Precision Medicine "What-If" scenarios.

### Backend APIs (`src/app/api/agents/*`)
All AI logic is abstracted into secure serverless functions using the `@google/genai` SDK (Gemini 2.5 Flash).
- `/api/agents/biographer`: Synthesizes raw longitudinal records into a concise clinical summary.
- `/api/agents/intervention`: Analyzes patterns to detect subtle physiological drifts and outputs structured JSON (Risk Level, Detected Pattern, Action Plan).
- `/api/agents/twin`: Probabilistic precision medicine engine that evaluates a proposed treatment against "Patients-Like-Me" data, outputting structured JSON (Treatment Decisions, Risk Prediction, Personalized Care).

### Design System (`src/app/globals.css`)
- **Palette**: Deep Blue (`#0f1c2e` background), Charcoal Grey (`#2d3748` glass panels), and Powder Blue (`#a5d8ff` primary accents).
- **Glassmorphism**: Premium frosted glass effects (`.glass-panel`, `.glass-button`).
- **Animations**: Cascading slide-ups (`.slide-up.stagger-[1|2|3]`), smooth fade-ins (`.fade-in`), pulsing alerts (`.pulse-glow`), and tactile hover-scaling.

---

## 3. How Things Are Simulated vs. Production Reality

Because this is a hackathon MVP, several complex systems were simulated. **If migrating to production, Claude must replace these simulated layers:**

| Feature | Hackathon Simulation (Current) | Production Requirement (Future) |
| :--- | :--- | :--- |
| **Data Layer** | Read-only local CSV files (`data/patients.csv`, `data/medical_records.csv`) parsed via `papaparse`. | **PostgreSQL/Prisma** for structured data, fully compliant with **HL7 FHIR** standards. |
| **Identity & Auth** | Hardcoded `P001` string passing. Simple boolean toggles for Smart Consent. | **Web3 Wallet / Blockchain / IPFS** for true Self-Sovereign Identity. OAuth2 for Clinician IAM. |
| **Agent Infrastructure** | Direct API calls to Google Gemini with heavy prompt engineering. | A true **LangGraph / AutoGen** multi-agent swarm architecture with a **Vector Database (Pinecone)** for RAG against medical literature. |
| **API Fallbacks** | If the Gemini API rate limits (HTTP 429), the `catch` blocks return **highly authentic, hardcoded clinical JSON** so the UI never breaks during demos. | Implement rigorous retry queues (SQS/Redis), circuit breakers, and fallback to local open-source LLMs (Llama 3). |
| **Telemetry / Behavior** | Extrapolating behavior (like weight gain) strictly from text notes in the CSV. | Ingesting real-time streaming data APIs from **Apple HealthKit** or **Fitbit Web API**. |

---

## 4. What Needs to be Done Next (Claude's Tasks)

If you are instructing Claude to continue building, ask it to implement the following high-impact features to finalize the presentation:

### Task A: Data Access Audit Log (Zero-Trust Proof)
- **Goal**: Prove the patient owns their data.
- **Action**: Add a "Data Access Audit Log" to `src/app/page.tsx`. Create an API route that logs every time a clinician searches `P001`. Display a timeline UI component on the Patient Dashboard showing timestamps and access reasons (e.g., "Cardiology requested Context").

### Task B: Visual Trajectory Graphing (Recharts)
- **Goal**: Make the Clinician Portal visually striking.
- **Action**: Install `recharts` (`npm install recharts`). In `src/app/clinician/page.tsx`, plot the patient's historical blood pressure from the CSV alongside the AI's predicted trajectory when the Twin Simulation is run. 

### Task C: Live Wearable Telemetry Sync UI
- **Goal**: Fulfill the "Vitals & Behavior Patterns" requirement visually.
- **Action**: Create a new `<section>` in the Patient Dashboard that mimics a live Apple Watch sync. Use CSS animations to show a pulsing heart rate (e.g., 72 BPM) and a daily step count ring to make the dashboard feel "alive".

### Task D: Export Encrypted Memory Vault
- **Goal**: Prove Data Portability.
- **Action**: Add a button to the Patient Dashboard that compiles their CSV data and Smart Consent settings into a single, beautifully formatted JSON file, triggers a browser download, and names it `sentinel_encrypted_vault_P001.json`.

---

## 5. Instructions for Claude
Claude, when implementing the above tasks:
1. **Maintain the Aesthetic**: Strictly use the existing CSS classes (`.glass-panel`, `.slide-up`, `.stagger-1`, etc.) defined in `globals.css`. 
2. **Do Not Break Fallbacks**: The robust `catch` blocks in the API routes must remain intact to protect the demo from API quota limits.
3. **No Placeholders**: If you add a chart or a new UI component, build it completely using real or highly realistic simulated data. Do not leave "TODO: Add chart here" comments.
