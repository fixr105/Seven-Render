#!/bin/bash
# Trigger n8n NBFC tools webhooks with dummy data
# Usage: ./scripts/trigger-n8n-webhooks.sh
# Run from a machine that can reach the n8n instance (e.g. your laptop, CI runner)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${N8N_NBFC_TOOLS_BASE_URL:-https://n8n-h9n3.srv1314414.hstgr.cloud}"
RAAD_URL="${N8N_RAAD_WEBHOOK_URL:-${BASE_URL%/}/webhook/upload-bankstatement-1}"
PAGER_URL="${BASE_URL%/}/webhook/upload-pager"

BANK_FILE="${SCRIPT_DIR}/dummy-bank-statement.txt"
BORROWER_FILE="${SCRIPT_DIR}/dummy-borrower-doc.txt"

if [ ! -f "$BANK_FILE" ]; then
  echo "Creating dummy bank statement..."
  echo "DUMMY BANK STATEMENT - Test data
Account: XXX-12345678
Period: $(date +%Y-%m)
Balance: 100000.00
Transactions: Sample transaction 1, Sample transaction 2" > "$BANK_FILE"
fi

if [ ! -f "$BORROWER_FILE" ]; then
  echo "Creating dummy borrower doc..."
  echo "DUMMY BORROWER DOCUMENT - Test data
Name: Test Borrower
Date: $(date +%Y-%m-%d)
Purpose: n8n webhook trigger test" > "$BORROWER_FILE"
fi

echo "=== Triggering RAAD (upload-bankstatement-1) ==="
echo "URL: $RAAD_URL"
HTTP_CODE=$(curl -sk -o /tmp/raad-response.json -w "%{http_code}" \
  -X POST \
  -F "bankFile=@${BANK_FILE};type=text/plain" \
  -F "loanApplicationId=TEST-$(date +%s)" \
  --max-time 60 \
  "$RAAD_URL")
echo "HTTP $HTTP_CODE"
if [ -f /tmp/raad-response.json ]; then
  head -c 500 /tmp/raad-response.json
  echo ""
fi
echo ""

echo "=== Triggering PAGER (upload-pager) ==="
echo "URL: $PAGER_URL"
HTTP_CODE=$(curl -sk -o /tmp/pager-response.json -w "%{http_code}" \
  -X POST \
  -F "borrowerFile=@${BORROWER_FILE};type=text/plain" \
  -F "loanApplicationId=TEST-$(date +%s)" \
  --max-time 60 \
  "$PAGER_URL")
echo "HTTP $HTTP_CODE"
if [ -f /tmp/pager-response.json ]; then
  head -c 500 /tmp/pager-response.json
  echo ""
fi
echo ""
echo "Done. Check n8n dashboard for executions."
