# Quick Deployment Checklist

## Pre-Deployment

- [ ] Run regression tests: `npm run test:e2e`
- [ ] Verify test users exist: `node backend/scripts/ensure-test-users.js`
- [ ] Check webhook connectivity: `node backend/scripts/verify-webhooks-and-users.js`
- [ ] Review code changes in git
- [ ] Ensure `vercel.json` has `maxDuration: 60` for API functions

## Environment Variables (Vercel)

### Backend
- [ ] `N8N_BASE_URL=https://fixrrahul.app.n8n.cloud`
- [ ] `NODE_ENV=production`

### Frontend (if using absolute URLs)
- [ ] `VITE_API_BASE_URL=https://your-backend-domain.vercel.app/api`

## Build Commands

```bash
# Frontend
npm run build

# Backend (auto-built by Vercel)
# No manual build needed
```

## Deploy

```bash
# Option 1: Vercel CLI
vercel --prod

# Option 2: Git push (if auto-deploy enabled)
git push origin main
```

## Post-Deployment Tests

- [ ] Loan products load (Client role)
- [ ] Save draft works (Client role)
- [ ] Submit application works (Client role)
- [ ] Onboard client works (KAM role)
- [ ] Generate report works (Credit role)
- [ ] Phone validation works (any role)
- [ ] Footer links work (any role)

## Rollback (if needed)

Vercel Dashboard → Deployments → Previous deployment → Promote to Production



