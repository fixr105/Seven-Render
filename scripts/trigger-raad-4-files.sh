#!/bin/bash
# Trigger RAAD webhook with 4 dummy PDFs (GST, BANK, AUDITED, ITR)
# Run: ./scripts/trigger-raad-4-files.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RAAD_URL="${N8N_RAAD_WEBHOOK_URL:-https://fixrrahul.app.n8n.cloud/webhook/big-brain-bro-1}"
LOAN_ID="TEST-4FILES-$(date +%s)"

# Minimal valid PDF bytes (same content used for all 4 dummy files)
PDF_BYTES='%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF'

mkdir -p "$SCRIPT_DIR/raad-dummies"
GST_PDF="$SCRIPT_DIR/raad-dummies/GST.pdf"
BANK_PDF="$SCRIPT_DIR/raad-dummies/BANK.pdf"
AUDITED_PDF="$SCRIPT_DIR/raad-dummies/AUDITED.pdf"
ITR_PDF="$SCRIPT_DIR/raad-dummies/ITR.pdf"

echo "Creating 4 dummy PDFs..."
printf '%s' "$PDF_BYTES" > "$GST_PDF"
printf '%s' "$PDF_BYTES" > "$BANK_PDF"
printf '%s' "$PDF_BYTES" > "$AUDITED_PDF"
printf '%s' "$PDF_BYTES" > "$ITR_PDF"

echo "GST.pdf: $(wc -c < "$GST_PDF") bytes"
echo "BANK.pdf: $(wc -c < "$BANK_PDF") bytes"
echo "AUDITED.pdf: $(wc -c < "$AUDITED_PDF") bytes"
echo "ITR.pdf: $(wc -c < "$ITR_PDF") bytes"
echo ""
echo "=== Triggering RAAD webhook with 4 files ==="
echo "URL: $RAAD_URL"
echo "Loan ID: $LOAN_ID"
echo ""

HTTP_CODE=$(curl -sk -o /tmp/raad-4files-response.json -w "%{http_code}" \
  -X POST \
  -F "gstFile=@${GST_PDF};type=application/pdf;filename=GST.pdf" \
  -F "bankFile=@${BANK_PDF};type=application/pdf;filename=BANK.pdf" \
  -F "auditedFile=@${AUDITED_PDF};type=application/pdf;filename=AUDITED.pdf" \
  -F "itrFile=@${ITR_PDF};type=application/pdf;filename=ITR.pdf" \
  -F "loanApplicationId=${LOAN_ID}" \
  --max-time 120 \
  "$RAAD_URL")

echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response (first 1500 chars):"
if [ -f /tmp/raad-4files-response.json ]; then
  head -c 1500 /tmp/raad-4files-response.json
  echo ""
else
  echo "(no response body)"
fi
echo ""
echo "Done. Check n8n dashboard for execution."
