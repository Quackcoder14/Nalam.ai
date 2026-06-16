# Deploying Sentinel to Vercel

Sentinel is built on Next.js and uses Supabase (PostgreSQL) via Prisma, making it perfectly optimized for hosting on [Vercel](https://vercel.com/).

Follow these steps to take your application from `localhost` to the live web.

## Prerequisites

1. **GitHub Account**: Your Sentinel codebase needs to be pushed to a GitHub repository.
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com/signup) using your GitHub account.
3. **Supabase Database**: Since you have already migrated to Supabase, you'll need your remote database credentials ready.

---

## Step 1: Push Code to GitHub

First, make sure your latest code is committed and pushed to a repository on GitHub.

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git branch -M main
git remote add origin https://github.com/your-username/sentinel.git
git push -u origin main
```

## Step 2: Import Project in Vercel

1. Log in to your Vercel Dashboard.
2. Click **Add New...** -> **Project**.
3. Locate your `sentinel` repository in the list and click **Import**.
4. The framework preset should automatically be detected as **Next.js**. Leave the Root Directory as `./`.

## Step 3: Configure Environment Variables

This is the most critical step. Vercel needs to know your database credentials and API keys just like your local `.env` file.

Expand the **Environment Variables** dropdown and copy all the keys from your local `.env` file. 

You must include the following keys:

| Variable Name | Description / Where to find it |
|---|---|
| `DATABASE_URL` | Your Supabase connection string (must use the connection pooling URL, usually port `6543`). |
| `DIRECT_URL` | Your Supabase direct connection string (usually port `5432`). Needed by Prisma. |
| `ENCRYPTION_KEY` | Your 32-character encryption key (e.g., `0123456789abcdef0123456789abcdef`). **Must be the same as local** so you can decrypt existing data. |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Your Gemini API key for AI summaries and features. |

*(Note: Never check your `.env` file into GitHub. Only provide them securely via the Vercel dashboard!)*

## Step 4: Build Settings (Prisma)

Vercel automatically detects Next.js, but because we use Prisma, it's highly recommended to configure the build command to ensure the Prisma Client is generated before the build runs.

Expand the **Build and Output Settings** dropdown and override the **Build Command**:
```bash
npx prisma generate && next build
```

## Step 5: Deploy!

1. Click the big **Deploy** button.
2. Vercel will install dependencies, generate the Prisma client, and build your Next.js application.
3. This process usually takes 2-3 minutes.

## Step 6: Verify

Once the deployment finishes:
1. Click the **Visit** button to open your live URL (e.g., `https://sentinel-your-app.vercel.app`).
2. Log in as a Patient and Hospital Desk.
3. Verify that the **Chat feature** works and the database is securely communicating!

---

## Troubleshooting

- **500 Errors on APIs**: Double-check your `DATABASE_URL` in Vercel. Supabase connection strings require the pooling port (`6543`) on Vercel to handle serverless connections efficiently.
- **Missing Data**: Ensure you didn't accidentally use a different `ENCRYPTION_KEY`. The key on Vercel must exactly match your local `.env` file, otherwise the app cannot decrypt the data stored in Supabase.
