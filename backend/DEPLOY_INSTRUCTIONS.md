# Deploy Backend to Fly.io

## Prerequisites

1. Make sure you're in the backend directory:
   ```bash
   cd /Users/rahulgonsalves/Desktop/Seven-Render/backend
   ```

2. Verify fly.toml exists:
   ```bash
   ls -la fly.toml
   ```

## Deploy

```bash
fly deploy --app seven-dash
```

## If You Get Permission Errors

The `.dockerignore` file has been added to exclude `.Trash` and other system files. If you still get errors:

1. Make sure you're in the backend directory (not home directory)
2. Try deploying with:
   ```bash
   fly deploy --app seven-dash --remote-only
   ```

## Verify Deployment

After deployment completes (2-3 minutes), test:

```bash
curl -X POST https://seven-dash.fly.dev/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"username":"test","passcode":"test"}'
```

Should return validation response (not "No token provided").

## Check Deployment Status

```bash
fly status --app seven-dash
fly logs --app seven-dash
```


