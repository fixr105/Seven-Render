# Vercel Deployment - Permanent Fix Guide

## System-Level Configuration

This guide ensures your Express backend works correctly on Vercel serverless functions.

## 1. API Handler Configuration

The API handler (`api/index.ts`) is configured to:
- ✅ Handle all HTTP methods (GET, POST, PUT, DELETE, PATCH)
- ✅ Properly strip `/api` prefix from URLs
- ✅ Normalize request paths for Express routing
- ✅ Handle errors gracefully
- ✅ Support CORS and JSON parsing

## 2. Vercel Configuration

The `vercel.json` file is configured with:
- ✅ Proper rewrites for `/api/*` routes
- ✅ Frontend routing fallback to `index.html`
- ✅ Function configuration for serverless functions

## 3. Environment Variables

Ensure these are set in Vercel Dashboard:

### Required:
- `VITE_USE_API_AUTH=true`
- `VITE_API_BASE_URL=https://seven-dashboard-seven.vercel.app`
- `JWT_SECRET=your-secret-key`

### Backend Environment Variables (if needed):
- `N8N_GET_WEBHOOK_URL`
- `N8N_POST_*_URL` (various webhook URLs)
- Any other backend-specific variables

## 4. Node.js Version

- **Set to 20.x** in Vercel Dashboard → Settings → General → Node.js Version
- Also specified in `package.json` under `engines.node`

## 5. Build Configuration

The project is configured to:
- Build frontend with Vite
- Include backend code in serverless functions
- Handle TypeScript compilation

## Troubleshooting 405 Errors

If you encounter 405 Method Not Allowed errors:

### Check 1: Verify API Handler
```bash
# Check if api/index.ts exists and exports the handler correctly
cat api/index.ts
```

### Check 2: Test API Endpoints
```bash
# Test health endpoint
curl https://seven-dashboard-seven.vercel.app/api/health

# Test POST endpoint
curl -X POST https://seven-dashboard-seven.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

### Check 3: Check Vercel Logs
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Deployments"
4. Click on the latest deployment
5. Check "Function Logs" for errors

### Check 4: Verify Routing
- Ensure `vercel.json` has correct rewrites
- Check that `/api/*` routes to `/api/index.ts`
- Verify Express routes are mounted correctly

## Permanent Fix Checklist

- [x] API handler properly exports async function
- [x] Handler normalizes request URLs (strips /api prefix)
- [x] Handler supports all HTTP methods
- [x] Error handling in place
- [x] Vercel.json configured correctly
- [x] Node.js version set to 20.x
- [x] Environment variables configured
- [x] Backend dependencies in package.json

## Deployment Process

1. **Make changes to code**
2. **Commit and push**:
   ```bash
   git add -A
   git commit -m "Your changes"
   git push origin main
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

4. **Verify deployment**:
   - Check deployment status in Vercel Dashboard
   - Test API endpoints
   - Check function logs for errors

## Monitoring

- **Vercel Dashboard**: Monitor deployments and function logs
- **API Health Check**: Regularly test `/api/health` endpoint
- **Error Tracking**: Check Vercel function logs for runtime errors

## Best Practices

1. **Always test locally first** before deploying
2. **Use environment variables** for sensitive data
3. **Monitor function logs** for errors
4. **Keep Node.js version consistent** across environments
5. **Test all HTTP methods** after deployment

## Support

If issues persist:
1. Check Vercel function logs
2. Verify environment variables are set
3. Test API endpoints directly with curl
4. Check browser console for frontend errors
5. Review this guide for configuration issues

