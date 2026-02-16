#!/bin/bash
# Test script to verify deployed changes (health warm-up, query string, retry logic)
# Usage: ./scripts/test-deployed-changes.sh [BASE_URL]
# Example: ./scripts/test-deployed-changes.sh https://seven-dashboard-xxx.vercel.app
#
# With Vercel Deployment Protection bypass (add to URL or as header):
#   BYPASS_SECRET=xxx ./scripts/test-deployed-changes.sh [BASE_URL]
#
# Test locally: ./scripts/test-deployed-changes.sh http://localhost:3000

set -e
BASE_URL="${1:-https://seven-dashboard-fwan6atmi-rajas-projects-e7f1e274.vercel.app}"
API_URL="${BASE_URL}/api"
# Local backend (3001): health at /health (root); Vercel/frontend: health at /api/health
if [[ "$BASE_URL" == *"localhost:3001"* ]]; then
  HEALTH_ENDPOINT="${BASE_URL}/health"
else
  HEALTH_ENDPOINT="${API_URL}/health"
fi

# Build curl command - add bypass header if secret provided
CURL_OPTS="-s"
if [ -n "$BYPASS_SECRET" ]; then
  CURL_OPTS="$CURL_OPTS -H \"x-vercel-protection-bypass: $BYPASS_SECRET\""
  echo "Using Deployment Protection bypass"
fi

echo "=========================================="
echo "Testing deployed changes"
echo "Base URL: $BASE_URL"
echo "API URL:  $API_URL"
echo "=========================================="

PASS=0
FAIL=0

# Test 1: Health endpoint returns 200 and JSON (proves health goes through api/index.ts)
echo ""
echo "[Test 1] Health endpoint (verifies health warm-up through main API)"
RESP=$(eval "curl $CURL_OPTS -w '\n%{http_code}' '$HEALTH_ENDPOINT'")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
if [ "$CODE" = "200" ] && echo "$BODY" | grep -q '"success":true'; then
  echo "  PASS: Health returned 200 with success:true"
  ((PASS++))
else
  echo "  FAIL: Health returned $CODE, body: ${BODY:0:100}"
  ((FAIL++))
fi

# Test 2: Health with query string (verifies query string preservation)
echo ""
echo "[Test 2] Health with query string (verifies query preservation in api/index.ts)"
RESP=$(eval "curl $CURL_OPTS -w '\n%{http_code}' '$HEALTH_ENDPOINT?foo=bar'")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
if [ "$CODE" = "200" ] && echo "$BODY" | grep -q '"success":true'; then
  echo "  PASS: Health with ?foo=bar returned 200"
  ((PASS++))
else
  echo "  FAIL: Health with query returned $CODE"
  ((FAIL++))
fi

# Test 3: Credit status endpoint returns 401 (not 404/HTML) - proves routes are loaded
# 401 = auth required, which means the route exists and was matched
echo ""
echo "[Test 3] Credit status endpoint (verifies routes loaded, expects 401 auth)"
RESP=$(eval "curl $CURL_OPTS -w '\n%{http_code}' -X POST '$API_URL/credit/loan-applications/test-id/status' \
  -H 'Content-Type: application/json' \
  -d '{\"status\":\"pending_credit_review\"}'")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -1)
# 401 with JSON = our auth (route exists) - GOOD
# 401 with HTML = Vercel Deployment Protection - can't verify our app
# 404 = route not found - BAD (cold start / routes not loaded)
# HTML = SPA fallback - BAD
if [ "$CODE" = "401" ] && ! echo "$BODY" | grep -q '<!DOCTYPE\|<html'; then
  echo "  PASS: Credit status returned 401 JSON (route exists, auth required)"
  ((PASS++))
elif echo "$BODY" | grep -q '<!DOCTYPE\|<html'; then
  echo "  SKIP: 401 with HTML (Vercel Deployment Protection blocks all requests)"
  ((FAIL++))
elif [ "$CODE" = "404" ]; then
  echo "  FAIL: Credit status returned 404 - routes may not be loaded"
  ((FAIL++))
else
  echo "  INFO: Credit status returned $CODE"
  if [ "$CODE" = "403" ] && ! echo "$BODY" | grep -q '<!DOCTYPE\|<html'; then
    ((PASS++))
  else
    ((FAIL++))
  fi
fi

# Summary
echo ""
echo "=========================================="
echo "Results: $PASS passed, $FAIL failed"
echo "=========================================="
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "If you see 401 with 'Authentication Required': Vercel Deployment Protection is on."
  echo "  Run: BYPASS_SECRET=your_secret ./scripts/test-deployed-changes.sh $BASE_URL"
  echo "  Get bypass secret: Vercel Dashboard → Project → Settings → Deployment Protection"
  echo ""
  echo "For local testing (backend + frontend): npm run dev (terminal 1), cd backend && npm run dev (terminal 2)"
  echo "  Then: ./scripts/test-deployed-changes.sh http://localhost:3000"
fi
[ $FAIL -eq 0 ]
