# Contributing to nalam.ai

## Workflow

1. Fork the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Write code, then run `npx tsc --noEmit` to verify no TypeScript errors
3. Commit with a clear message: `git commit -m "feat: add XYZ"`
4. Open a Pull Request targeting `main`

## PR Checklist

- [ ] TypeScript type-check passes (`npx tsc --noEmit`)
- [ ] No secrets committed (check `.env` is in `.gitignore`)
- [ ] New patient data encrypted via `src/lib/crypto.ts`
- [ ] API routes follow existing patterns in `src/app/api/`
- [ ] UI changes use CSS variables from `globals.css` (no hardcoded dark-mode hex)

## Code Style

- Use `var(--primary)`, `var(--charcoal)`, `var(--deep-blue)` etc. for colors
- All sensitive fields must go through `encrypt()` / `decrypt()` in `crypto.ts`
- Keep components in `src/app/components/` if reused across pages

## Security Rules

- Never commit `ENCRYPTION_KEY`, `DATABASE_URL`, or `GROQ_API_KEY`
- All PII fields must be stored encrypted — no plaintext patient data in DB
- Report security issues directly to the team lead, not as public issues

## Contact

Team nalam.ai — team@nalam.ai
