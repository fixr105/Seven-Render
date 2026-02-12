# Deploy check (latest)

**Checked:** After push to `main` (commit: deploy dashboard expansions, test fixes, admin UIs, e2e spec).

## Local state
- **Git:** No uncommitted changes; folder updated with `git pull origin main` (already up to date).
- **Builds:** Frontend `npm run build` and backend `npm run build` both succeed.

## Live backend (Fly.io – seven-dash)
- **URL:** https://seven-dash.fly.dev
- **Root health:** `GET /health` — **OK** (returns `{"success":true,"message":"API is running",...}`).
- **API health:** `GET /api/health` — check from your network; if it times out, confirm in Fly.io dashboard that the app is running and review logs.

## What you should do
1. **GitHub Actions**  
   Open: https://github.com/fixr105/Seven-Render/actions  
   - Confirm the latest **Deploy** workflow run (triggered by your push to `main`) completed successfully.  
   - If **Deploy Backend to Fly.io** or **Deploy Frontend to Vercel** failed, open the run and fix the reported errors (e.g. missing `FLY_API_TOKEN`, `VERCEL_*` secrets).

2. **Backend logs (if needed)**  
   ```bash
   flyctl logs -a seven-dash
   ```

3. **Frontend (Vercel)**  
   In Vercel dashboard, confirm the latest production deployment for this repo succeeded and that `VITE_API_BASE_URL` is set to `https://seven-dash.fly.dev` (or your backend URL) for production.

4. **If the live site still does not work**  
   Follow [LIVE_SITE_SETUP.md](LIVE_SITE_SETUP.md): set `VITE_API_BASE_URL` and redeploy frontend, set `CORS_ORIGIN` on Fly.io to your Vercel URL (e.g. `./scripts/set-fly-cors.sh "https://your-app.vercel.app"`), and ensure `N8N_BASE_URL` and `JWT_SECRET` on Fly.io.

## Summary
- Repo is clean and up to date; builds pass.
- Backend root health at https://seven-dash.fly.dev/health is responding.
- Verify the **Deploy** workflow and Vercel deployment in the links above; fix any errors shown there.
