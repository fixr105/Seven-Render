#!/bin/bash
# Verify NBFC tools endpoints are reachable (not 404).
# Run after applying the NBFC Tools 404 fix (VITE_API_BASE_URL → seven-render.fly.dev).
# See docs/NBFC_TOOLS_404_FIX.md for full fix instructions.

BACKEND_URL="${1:-https://seven-render.fly.dev}"
FAIL=0

echo "Verifying NBFC tools at $BACKEND_URL ..."
echo ""

# Health check
if curl -sf "$BACKEND_URL/health" | grep -q '"success":true'; then
  echo "  [OK] GET /health"
else
  echo "  [FAIL] GET /health"
  FAIL=1
fi

# NBFC tools ping (no auth)
if curl -sf "$BACKEND_URL/api/nbfc-tools-ping" | grep -q '"ok":true'; then
  echo "  [OK] GET /api/nbfc-tools-ping"
else
  echo "  [FAIL] GET /api/nbfc-tools-ping"
  FAIL=1
fi

# RAAD route - expect 401 without auth, NOT 404
RAAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/api/nbfc/tools/raad" -F "bankFile=@/dev/null;filename=x.pdf")
if [ "$RAAD_STATUS" = "404" ]; then
  echo "  [FAIL] POST /api/nbfc/tools/raad -> 404 (route not found)"
  FAIL=1
elif [ "$RAAD_STATUS" = "401" ]; then
  echo "  [OK] POST /api/nbfc/tools/raad -> 401 (auth required, route exists)"
else
  echo "  [OK] POST /api/nbfc/tools/raad -> $RAAD_STATUS"
fi

# History route - expect 401 without auth, NOT 404
HISTORY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/nbfc/tools/history")
if [ "$HISTORY_STATUS" = "404" ]; then
  echo "  [FAIL] GET /api/nbfc/tools/history -> 404 (route not found)"
  FAIL=1
elif [ "$HISTORY_STATUS" = "401" ]; then
  echo "  [OK] GET /api/nbfc/tools/history -> 401 (auth required, route exists)"
else
  echo "  [OK] GET /api/nbfc/tools/history -> $HISTORY_STATUS"
fi

echo ""
if [ $FAIL -eq 0 ]; then
  echo "All NBFC tools checks passed."
  exit 0
else
  echo "Some checks failed. Ensure VITE_API_BASE_URL=https://seven-render.fly.dev in Vercel and backend is deployed to seven-render."
  echo "See docs/NBFC_TOOLS_404_FIX.md"
  exit 1
fi
