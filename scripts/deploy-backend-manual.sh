#!/bin/bash
# Manual backend deploy to Fly.io - run after: flyctl auth login
set -e
cd "$(dirname "$0")/../backend"
echo "Deploying backend to Fly.io (seven-dash)..."
flyctl deploy --config fly.toml --app seven-dash --remote-only --strategy immediate
echo "Deploy complete. Verifying..."
sleep 15
curl -sf "https://seven-dash.fly.dev/api/nbfc-tools-ping" | grep -q '"ok":true' && echo "Ping OK" || echo "Ping failed"
curl -s -o /dev/null -w "RAAD route: HTTP %{http_code}\n" -X POST "https://seven-dash.fly.dev/api/nbfc/tools/raad" -F "bankFile=@/dev/null;filename=x.pdf"
