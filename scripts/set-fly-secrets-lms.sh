#!/usr/bin/env bash
# Set all Fly.io secrets for lms.sevenfincorp.com
# Usage: ./scripts/set-fly-secrets-lms.sh
#        N8N_LMS_BASE_URL=https://n8n-fvmj.srv1499064.hstgr.cloud ./scripts/set-fly-secrets-lms.sh
# Requires: flyctl logged in, app name seven-render
# Requires N8N_LMS_BASE_URL in the environment.

set -e
FLY_APP="${FLY_APP:-seven-render}"

: "${N8N_LMS_BASE_URL:?N8N_LMS_BASE_URL is required}"
CORS_ORIGIN="https://lms.sevenfincorp.com,https://seven-renderboard-seven.vercel.app"
NODE_ENV="production"
API_RATE_LIMIT_MAX="${API_RATE_LIMIT_MAX:-500}"

# Generate new JWT_SECRET (32+ chars required)
JWT_SECRET=$(openssl rand -base64 32)

echo "Setting Fly.io secrets for $FLY_APP (lms.sevenfincorp.com)..."
echo ""
echo "  N8N_LMS_BASE_URL:    $N8N_LMS_BASE_URL"
echo "  CORS_ORIGIN:        $CORS_ORIGIN"
echo "  NODE_ENV:           $NODE_ENV"
echo "  API_RATE_LIMIT_MAX: $API_RATE_LIMIT_MAX"
echo "  JWT_SECRET:         (generated, 32 chars)"
echo ""

fly secrets set \
  N8N_LMS_BASE_URL="$N8N_LMS_BASE_URL" \
  CORS_ORIGIN="$CORS_ORIGIN" \
  JWT_SECRET="$JWT_SECRET" \
  NODE_ENV="$NODE_ENV" \
  API_RATE_LIMIT_MAX="$API_RATE_LIMIT_MAX" \
  --app "$FLY_APP"

echo ""
echo "Done. Fly will redeploy automatically (~1-2 min)."
echo "Verify: fly logs -a $FLY_APP"
echo "Health: curl -s https://seven-render.fly.dev/health"
