# Configure CORS at n8n Instance Level

This guide explains how to configure CORS globally for your n8n instance, so all webhooks automatically allow requests from your frontend domain.

## Determine Your n8n Setup

First, identify which type of n8n instance you're using:

- **n8n Cloud** (hosted by n8n): `https://fixrrahul.app.n8n.cloud`
- **Self-hosted n8n**: Your own server/container

---

## Option 1: n8n Cloud (Hosted by n8n)

If you're using n8n Cloud (`*.app.n8n.cloud`), you have **limited options** because you don't have direct access to the server configuration.

### Available Options for n8n Cloud:

#### Option A: Contact n8n Support (Recommended)

1. **Go to n8n Support**: https://n8n.io/support
2. **Request CORS configuration** for your instance
3. **Provide details**:
   - Your n8n instance URL: `https://fixrrahul.app.n8n.cloud`
   - Allowed origin: `https://lms.sevenfincorp.com`
   - Request method: `POST, OPTIONS`
   - Required headers: `Content-Type`

#### Option B: Use Workflow-Level CORS (Current Solution)

Since n8n Cloud doesn't allow direct environment variable access, you'll need to configure CORS in each workflow (see the main `N8N_CORS_SETUP.md` guide).

#### Option C: Upgrade to n8n Enterprise

n8n Enterprise plans may offer more configuration options. Contact n8n sales for details.

---

## Option 2: Self-Hosted n8n

If you're self-hosting n8n (Docker, Kubernetes, or direct installation), you have full control over configuration.

### Method 1: Environment Variables (Recommended)

Set environment variables when starting your n8n instance:

#### Docker Compose

Edit your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n
    environment:
      - N8N_CORS_ORIGIN=https://lms.sevenfincorp.com
      - N8N_CORS_CREDENTIALS=true
      # Optional: Allow multiple origins (comma-separated)
      # - N8N_CORS_ORIGIN=https://lms.sevenfincorp.com,http://localhost:3000
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
```

**Apply changes:**
```bash
docker-compose down
docker-compose up -d
```

#### Docker Run

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -e N8N_CORS_ORIGIN=https://lms.sevenfincorp.com \
  -e N8N_CORS_CREDENTIALS=true \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

#### Kubernetes

Edit your deployment YAML:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n
spec:
  template:
    spec:
      containers:
      - name: n8n
        image: n8nio/n8n
        env:
        - name: N8N_CORS_ORIGIN
          value: "https://lms.sevenfincorp.com"
        - name: N8N_CORS_CREDENTIALS
          value: "true"
```

Apply:
```bash
kubectl apply -f n8n-deployment.yaml
kubectl rollout restart deployment/n8n
```

#### Systemd Service

Edit `/etc/systemd/system/n8n.service`:

```ini
[Unit]
Description=n8n workflow automation
After=network.target

[Service]
Type=simple
User=n8n
Environment="N8N_CORS_ORIGIN=https://lms.sevenfincorp.com"
Environment="N8N_CORS_CREDENTIALS=true"
ExecStart=/usr/bin/n8n start
Restart=always

[Install]
WantedBy=multi-user.target
```

Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart n8n
```

#### Direct Installation (npm/pm2)

If running n8n directly with Node.js:

```bash
# Set environment variables
export N8N_CORS_ORIGIN=https://lms.sevenfincorp.com
export N8N_CORS_CREDENTIALS=true

# Start n8n
n8n start
```

Or with PM2:

```bash
# Create ecosystem.config.js
module.exports = {
  apps: [{
    name: 'n8n',
    script: 'n8n',
    env: {
      N8N_CORS_ORIGIN: 'https://lms.sevenfincorp.com',
      N8N_CORS_CREDENTIALS: 'true'
    }
  }]
};

# Start with PM2
pm2 start ecosystem.config.js
```

### Method 2: Configuration File (Alternative)

For self-hosted n8n, you can also use a configuration file:

#### Create `~/.n8n/config` file:

```json
{
  "cors": {
    "origin": "https://lms.sevenfincorp.com",
    "credentials": true
  }
}
```

**Note**: n8n primarily uses environment variables. The config file format may vary by version. Check n8n documentation for your specific version.

### Method 3: Multiple Origins

To allow multiple origins (e.g., production + development):

#### Option A: Comma-Separated (if supported)

```bash
N8N_CORS_ORIGIN=https://lms.sevenfincorp.com,http://localhost:3000,https://preview.vercel.app
```

#### Option B: Use Wildcard (Less Secure)

```bash
N8N_CORS_ORIGIN=*
```

**Warning**: Using `*` allows any origin. Only use in development.

#### Option C: Custom Middleware (Advanced)

If you need dynamic origin checking, you may need to add custom middleware to your n8n instance. This requires modifying n8n source code or using n8n's plugin system (if available).

---

## Environment Variables Reference

### Available n8n CORS Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `N8N_CORS_ORIGIN` | Allowed origin(s) | `https://lms.sevenfincorp.com` |
| `N8N_CORS_CREDENTIALS` | Allow credentials | `true` or `false` |
| `N8N_CORS_METHODS` | Allowed HTTP methods | `POST,GET,OPTIONS` (optional) |
| `N8N_CORS_HEADERS` | Allowed headers | `Content-Type,Authorization` (optional) |

### Full Example:

```bash
N8N_CORS_ORIGIN=https://lms.sevenfincorp.com
N8N_CORS_CREDENTIALS=true
N8N_CORS_METHODS=POST,GET,OPTIONS
N8N_CORS_HEADERS=Content-Type,Authorization
```

---

## Verification Steps

After configuring CORS:

### 1. Restart n8n Instance

```bash
# Docker
docker-compose restart

# Kubernetes
kubectl rollout restart deployment/n8n

# Systemd
sudo systemctl restart n8n

# PM2
pm2 restart n8n
```

### 2. Test OPTIONS Preflight Request

```bash
curl -X OPTIONS https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Origin: https://lms.sevenfincorp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**Expected Response Headers:**
```
Access-Control-Allow-Origin: https://lms.sevenfincorp.com
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Credentials: true
```

### 3. Test POST Request

```bash
curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
  -H "Origin: https://lms.sevenfincorp.com" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","passcode":"test"}' \
  -v
```

### 4. Test from Browser Console

Open browser console on `https://lms.sevenfincorp.com`:

```javascript
fetch('https://fixrrahul.app.n8n.cloud/webhook/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'test',
    passcode: 'test'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Should succeed without CORS errors.**

---

## Troubleshooting

### CORS Still Not Working?

1. **Check Environment Variables**:
   ```bash
   # Docker
   docker exec -it <container-name> env | grep CORS
   
   # Kubernetes
   kubectl exec -it <pod-name> -- env | grep CORS
   ```

2. **Check n8n Logs**:
   ```bash
   # Docker
   docker logs <container-name>
   
   # Kubernetes
   kubectl logs <pod-name>
   ```

3. **Verify n8n Version**:
   ```bash
   # Some older versions may not support all CORS env vars
   n8n --version
   ```

4. **Check n8n Documentation**:
   - Visit: https://docs.n8n.io/hosting/configuration/environment-variables/
   - Search for "CORS" in the documentation

### Common Issues

- **Environment variables not applied**: Restart n8n after setting variables
- **Wrong origin format**: Must match exactly (including `https://` and no trailing slash)
- **Multiple origins**: Some n8n versions may not support comma-separated origins
- **Credentials not working**: Ensure `N8N_CORS_CREDENTIALS=true` and origin is not `*`

---

## For n8n Cloud Users

If you're using n8n Cloud (`*.app.n8n.cloud`), you **cannot** set environment variables directly. Your options are:

1. **Contact n8n Support** to request CORS configuration
2. **Configure CORS in each workflow** (see `N8N_CORS_SETUP.md`)
3. **Use a backend proxy** to handle CORS (we can implement this)

---

## Next Steps

After configuring CORS:

1. ✅ Test the webhook from your frontend
2. ✅ Verify no CORS errors in browser console
3. ✅ Test login functionality
4. ✅ Monitor n8n workflow execution logs

If you need help implementing a backend proxy as an alternative, let me know!


