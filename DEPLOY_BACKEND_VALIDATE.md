# Deploy Backend with Validate Endpoint

The `/api/auth/validate` endpoint was just added but needs to be deployed to Fly.io.

## Quick Deploy

```bash
cd backend
fly deploy --app seven-dash
```

## Verify Deployment

After deployment, test the endpoint:

```bash
curl -X POST https://seven-dash.fly.dev/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"test","passcode":"test"}'
```

Should return validation response (not "No token provided").

## Alternative: Check Current Deployment

Check if validate endpoint exists:

```bash
curl -X POST https://seven-dash.fly.dev/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"test","passcode":"test"}' \
  -v
```

If it returns "No token provided", the endpoint isn't deployed yet.


