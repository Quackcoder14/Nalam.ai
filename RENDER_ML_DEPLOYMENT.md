# Deploying the ML Service to Render

The AI features (XAI, Twin Simulation, Anomaly Detector, Biographer Agent) are powered by a FastAPI Python service in `src/ml-service/`. This service must be hosted separately from Vercel (which only runs Node.js).

**Render** is the easiest free option — no credit card required.

---

## Step 1: Push latest changes to GitHub

The ML service CORS update and `render.yaml` must be on GitHub first:

```bash
git add .
git commit -m "feat: configure ML service for Render deployment"
git push
```

---

## Step 2: Create a Render account

Sign up at [render.com](https://render.com) using your GitHub account.

---

## Step 3: Deploy from GitHub

1. On the Render dashboard, click **New +** → **Web Service**.
2. Connect your GitHub account and select your `Nalam.ai` repository.
3. Render will detect `render.yaml` automatically and pre-fill the settings. Confirm:
   - **Root Directory**: `src/ml-service`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free

---

## Step 4: Add Environment Variables

In the Render dashboard for your service, go to **Environment** and add:

| Variable | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq key (`gsk_...`) |
| `ALLOWED_ORIGINS` | Your Vercel URL, e.g. `https://nalam-ai.vercel.app,http://localhost:3000` |
| `ENCRYPTION_KEY` | Same key as in your Vercel/`.env` |
| `DATABASE_URL` | Same Supabase pooling URL from your `.env` |

> [!IMPORTANT]
> The `ALLOWED_ORIGINS` value must match your exact Vercel deployment URL (no trailing slash).

---

## Step 5: Deploy & get the URL

1. Click **Deploy Web Service**.
2. Wait ~3-5 minutes for the Python environment to build (first deploy is slow).
3. Once live, copy your service URL — it looks like: `https://nalam-ml-service.onrender.com`

---

## Step 6: Connect Vercel to the ML Service

In your **Vercel** project dashboard → **Settings** → **Environment Variables**, add:

| Variable | Value |
|---|---|
| `ML_SERVICE_URL` | `https://nalam-ml-service.onrender.com` |

Then go to your Vercel **Deployments** tab and click **Redeploy** (with existing env vars).

---

## Step 7: Verify

Test by visiting your Vercel app and using:
- The **XAI / Explainable AI** tab in the clinician view
- The **Twin Simulation** agent
- The **Anomaly Detector**
- The **Biographer** agent

All should now work in production!

---

## Troubleshooting

- **504 Timeout on Render (Free tier)**: The free tier spins down after 15 minutes of inactivity. The first request after idle takes ~30 seconds to cold-start. This is normal on the free plan.
- **CORS errors**: Make sure `ALLOWED_ORIGINS` on Render exactly matches your Vercel domain (e.g. `https://nalam-ai.vercel.app` — no trailing slash).
- **Chroma / vectorstore errors**: ChromaDB runs in-memory on Render. Vectors are lost on redeploy. Re-vectorize patients by visiting the relevant page on your app.
