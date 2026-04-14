#!/bin/bash
# Test POSTing a PDF to the RAAD webhook (big-brain-bro-1)
# Run locally: ./scripts/test-raad-pdf.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RAAD_URL="${N8N_RAAD_WEBHOOK_URL:-https://fixrrahul.app.n8n.cloud/webhook/big-brain-bro-1}"
PDF_FILE="${SCRIPT_DIR}/test-sample.pdf"

# Create minimal valid PDF if it doesn't exist
if [ ! -f "$PDF_FILE" ]; then
  echo "Creating minimal test PDF..."
  python3 -c "
import sys
try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    c = canvas.Canvas('$PDF_FILE', pagesize=letter)
    c.drawString(100, 750, 'Test Bank Statement PDF')
    c.drawString(100, 730, 'Account: XXX-1234')
    c.drawString(100, 710, 'This is a test file for RAAD webhook.')
    c.save()
    print('Created PDF with reportlab')
except ImportError:
    # Fallback: write minimal valid PDF (no external deps)
    pdf = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
    with open('$PDF_FILE', 'wb') as f:
        f.write(pdf)
    print('Created minimal PDF')
" 2>/dev/null || {
  # Ultra-minimal PDF without Python libs
  printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj xref 0 4 trailer<</Size 4/Root 1 0 R>>startxref %%EOF' > "$PDF_FILE"
  echo "Created minimal PDF (raw)"
}
fi

if [ ! -f "$PDF_FILE" ]; then
  echo "ERROR: Could not create PDF. Install reportlab: pip install reportlab"
  exit 1
fi

echo "PDF size: $(wc -c < "$PDF_FILE") bytes"
file "$PDF_FILE" || true
echo ""
echo "=== POSTing PDF to RAAD webhook ==="
echo "URL: $RAAD_URL"
echo ""

HTTP_CODE=$(curl -sk -o /tmp/raad-pdf-response.json -w "%{http_code}" \
  -X POST \
  -F "bankFile=@${PDF_FILE};type=application/pdf;filename=test-bank-statement.pdf" \
  -F "loanApplicationId=TEST-PDF-$(date +%s)" \
  --max-time 60 \
  "$RAAD_URL")

echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response (first 1000 chars):"
if [ -f /tmp/raad-pdf-response.json ]; then
  head -c 1000 /tmp/raad-pdf-response.json
  echo ""
else
  echo "(no response body)"
fi
echo ""
echo "Done. Check n8n dashboard for execution."
