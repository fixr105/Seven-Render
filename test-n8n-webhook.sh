#!/bin/bash

echo "=========================================="
echo "Testing n8n Webhook: /webhook/useraccount"
echo "=========================================="
echo ""

WEBHOOK_URL="https://fixrrahul.app.n8n.cloud/webhook/useraccount"

echo "URL: $WEBHOOK_URL"
echo ""
echo "Making request (timeout: 30 seconds)..."
echo ""

# Make request with timeout
response=$(curl -s -w "\n\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}s\nSIZE:%{size_download} bytes" \
  --max-time 30 \
  "$WEBHOOK_URL")

# Extract parts
http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
time_total=$(echo "$response" | grep "TIME_TOTAL" | cut -d: -f2)
size=$(echo "$response" | grep "SIZE" | cut -d: -f2)
body=$(echo "$response" | sed '/HTTP_CODE/d' | sed '/TIME_TOTAL/d' | sed '/SIZE/d' | head -n -1)

echo "=========================================="
echo "RESULTS"
echo "=========================================="
echo "HTTP Status Code: $http_code"
echo "Response Time: $time_total"
echo "Response Size: $size bytes"
echo ""

if [ -z "$http_code" ]; then
  echo "❌ ERROR: Request timed out or failed to connect"
  echo "   - Check if n8n workflow is active"
  echo "   - Check if webhook URL is correct"
  exit 1
fi

if [ "$http_code" != "200" ]; then
  echo "❌ ERROR: HTTP $http_code"
  echo ""
  echo "Response body:"
  echo "$body"
  exit 1
fi

if [ "$size" = "0" ] || [ -z "$body" ]; then
  echo "❌ ERROR: Empty response body"
  echo "   - n8n filter is blocking all users"
  echo "   - Check filter conditions use: \$json.fields.Username (NOT \$json.Username)"
  echo "   - Check filter conditions use: \$json.fields['Account Status'] (NOT \$json['Account Status'])"
  exit 1
fi

# Check if it's JSON
if echo "$body" | jq . > /dev/null 2>&1; then
  echo "✅ Valid JSON response"
  echo ""
  echo "Response preview (first 500 chars):"
  echo "$body" | head -c 500
  echo ""
  echo ""
  
  # Count records if array
  record_count=$(echo "$body" | jq 'if type == "array" then length else 0 end' 2>/dev/null)
  if [ "$record_count" -gt 0 ]; then
    echo "✅ Found $record_count user record(s)"
  else
    echo "⚠️  WARNING: Response is valid JSON but contains 0 records"
    echo "   - Filter might be blocking all users"
  fi
else
  echo "❌ ERROR: Invalid JSON response"
  echo ""
  echo "Response body:"
  echo "$body" | head -c 500
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ Webhook test PASSED"
echo "=========================================="
