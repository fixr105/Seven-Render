# Quick Commands to Run

Copy and paste these commands one by one in your terminal:

## Step 1: Navigate to Backend Directory
```bash
cd ~/Desktop/Seven-Render/backend
```

## Step 2: Login to Fly.io (try again)
```bash
fly auth login
```
- Complete the browser authentication
- Wait for "Authentication successful" message

## Step 3: Deploy Backend
```bash
fly deploy --app seven-dash
```

## Step 4: Check Deployment Status
```bash
fly status --app seven-dash
```

## Step 5: View Logs
```bash
fly logs --app seven-dash
```

You should see Node.js starting (not goStatic).

## Step 6: Test Health Endpoint
```bash
curl https://seven-dash.fly.dev/health
```

Expected output: `{"success":true,"message":"API is running",...}`





