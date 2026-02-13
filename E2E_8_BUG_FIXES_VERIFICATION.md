# 8 Bug Fixes - Verification Guide

## Deployment Status

Changes have been pushed to `main`. GitHub Actions will deploy:
- **Backend** → Fly.io (if `FLY_API_TOKEN` is configured)
- **Frontend** → Vercel (if `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` are configured)

Check your GitHub Actions tab: https://github.com/fixr105/Seven-Render/actions

---

## E2E Test File

Run the automated verification tests:

```bash
# Ensure backend and frontend are running (Playwright starts them automatically if not)
# Set credentials if using CI or non-default users:
export E2E_CLIENT_USERNAME=your-client@email.com
export E2E_CLIENT_PASSWORD=your-password
export E2E_KAM_USERNAME=your-kam@email.com
export E2E_KAM_PASSWORD=your-password
export E2E_CREDIT_USERNAME=your-credit@email.com
export E2E_CREDIT_PASSWORD=your-password

npm run test:e2e -- e2e/8-bug-fixes-verification.spec.ts --project=chromium
```

---

## Manual Verification Checklist

Use this checklist to verify each fix after deployment.

### 1. Draft Status (Client Submit/Withdraw)

- [ ] Log in as **Client**
- [ ] Open an application with status **Draft**
- [ ] Verify "Submit / Withdraw" button is visible in the header
- [ ] Click it and confirm the modal shows only **Submit** and **Withdraw** options (not full status list)
- [ ] Select "Submit" and confirm it submits (status changes to Under KAM Review)
- [ ] For a draft, select "Withdraw" and confirm it withdraws

### 2. Client Query (Raise Query to KAM)

- [ ] Log in as **Client**
- [ ] Open any application
- [ ] Verify "Raise Query" button is visible
- [ ] Click it, enter a message, submit
- [ ] Confirm the query appears in the Queries section
- [ ] Log in as **KAM** and verify they see the client's query

### 2b. Pending Queries Card (KAM/Credit Dashboard)

- [ ] Ensure at least one unresolved query exists (Client or Credit raises query to KAM)
- [ ] Log in as **KAM** → Go to **Dashboard**
- [ ] Verify "Pending Queries" card appears with query count and links to applications
- [ ] Log in as **Credit** → Go to **Dashboard**
- [ ] Verify "Pending Queries" card appears when there are unresolved queries for credit

### 3. Query Section Data

- [ ] Log in as **KAM** or **Credit**
- [ ] Open an application that has queries
- [ ] Verify query messages display correctly (not "No message" or "(No message)")
- [ ] Verify "Application Information" section shows form data (or "No form data recorded" if empty)

### 4. Query Resolution Permissions

- [ ] As **Client**, open an application where you raised a query
- [ ] Verify "Mark Resolved" is visible only on your own queries
- [ ] As **KAM** or **Credit**, verify "Mark Resolved" is visible on queries you can resolve

### 5. Assigned KAM Display (Credit Dashboard)

- [ ] Log in as **Credit Team**
- [ ] Go to **Clients** page
- [ ] Verify "Assigned KAM" column shows **KAM names** (e.g. "Sagar") instead of raw IDs (e.g. USER-1767430957573-81645wu26)

### 6. Dashboard Tiles

- [ ] Log in as **Credit Team**
- [ ] Go to **Dashboard**
- [ ] Verify tile counts (Past SLA, Pending Review, etc.) match application statuses
- [ ] Click "Review Files" and confirm it filters by `pending_credit_review` correctly

### 7. Ledger

- [ ] Log in as **Client**
- [ ] Go to **Ledger**
- [ ] If you have disbursed applications, verify entries and balance appear
- [ ] If empty, check backend logs for `[getClientLedger]` diagnostic messages (clientId, totalFetched)

### 8. Admin Activity Log Filters

- [ ] Log in as **Credit Team** or **Admin**
- [ ] Go to **Activity Log** (sidebar)
- [ ] Verify "Performed by" and "Action type" are **dropdowns** (not text inputs)
- [ ] Verify dropdowns populate with options after data loads
- [ ] Select a filter and click "Apply filters" to confirm filtering works

---

## Quick Smoke Test (No Login)

If you want to verify the app loads without full E2E:

```bash
# Start dev servers
npm run dev &
cd backend && npm run dev &

# In another terminal, check health
curl http://localhost:3001/health
curl -s http://localhost:3000 | head -20
```
