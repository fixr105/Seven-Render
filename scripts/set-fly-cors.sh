#!/usr/bin/env bash
# Set CORS_ORIGIN on Fly.io so the backend allows requests from your frontend.
# Usage: ./scripts/set-fly-cors.sh "https://your-vercel-app.vercel.app"
#        ./scripts/set-fly-cors.sh "https://app1.vercel.app,https://lms.sevenfincorp.com"
# Requires: flyctl logged in, app name seven-dash

set -e
ORIGIN="${1:-}"
FLY_APP="${FLY_APP:-seven-dash}"

if [ -z "$ORIGIN" ]; then
  echo "Usage: $0 <CORS_ORIGIN>"
  echo "  Example: $0 https://seven-render.vercel.app"
  echo "  Multiple: $0 'https://a.vercel.app,https://lms.sevenfincorp.com'"
  echo ""
  echo "Get your Vercel production URL from Vercel dashboard → Project → Domains."
  exit 1
fi

echo "Setting CORS_ORIGIN on Fly.io app: $FLY_APP"
echo "Value: $ORIGIN"
flyctl secrets set "CORS_ORIGIN=$ORIGIN" -a "$FLY_APP"
echo "Done. Fly will redeploy automatically. Check: flyctl logs -a $FLY_APP"
