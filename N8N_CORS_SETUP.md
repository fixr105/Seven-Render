# n8n CORS Configuration Guide

## Problem
The n8n webhook at `https://fixrrahul.app.n8n.cloud/webhook/validate` is blocking requests from `https://lms.sevenfincorp.com` due to CORS (Cross-Origin Resource Sharing) restrictions.

## Solution: Add CORS Headers in n8n Workflow

You need to modify your n8n workflow that handles the `/webhook/validate` endpoint to include CORS headers in the response.

### Step 1: Open Your n8n Workflow

1. Log in to your n8n instance: `https://fixrrahul.app.n8n.cloud`
2. Find and open the workflow that contains the `/webhook/validate` webhook node
3. Make sure the workflow is **Active** (toggle in the top right)

### Step 2: Add CORS Headers to Webhook Response

There are two methods to add CORS headers:

#### Method 1: Using "Respond to Webhook" Node (Recommended)

1. **Find your Webhook node** that handles `/webhook/validate`
2. **Add a "Respond to Webhook" node** after your validation logic
3. **Configure the "Respond to Webhook" node**:
   - **Response Code**: `200`
   - **Response Headers**: Add the following headers:
     ```
     Access-Control-Allow-Origin: https://lms.sevenfincorp.com
     Access-Control-Allow-Methods: POST, OPTIONS
     Access-Control-Allow-Headers: Content-Type
     Access-Control-Allow-Credentials: true
     ```
   - **Response Body**: Use the output from your validation logic
     - If validation succeeds: `{"success": true, "user": {...}}`
     - If validation fails: `{"success": false, "error": "Invalid credentials"}`

#### Method 2: Using Code Node to Set Headers

1. **Add a "Code" node** after your validation logic
2. **Use this code** to add CORS headers:

```javascript
// Get the validation result from previous node
const validationResult = $input.first().json;

// Add CORS headers
$response.headers = {
  'Access-Control-Allow-Origin': 'https://lms.sevenfincorp.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

// Return the validation result
return {
  json: validationResult
};
```

3. **Connect a "Respond to Webhook" node** after the Code node

### Step 3: Handle OPTIONS Preflight Requests

Browsers send an OPTIONS request before the actual POST request (preflight). You need to handle this:

1. **Add a "Switch" node** or **"IF" node** after the Webhook node
2. **Check if the request method is OPTIONS**:
   - Condition: `{{ $json.headers['x-request-method'] }}` equals `OPTIONS` OR
   - Condition: `{{ $json.method }}` equals `OPTIONS`

3. **If OPTIONS**, use a "Respond to Webhook" node with:
   - **Response Code**: `200`
   - **Response Headers**:
     ```
     Access-Control-Allow-Origin: https://lms.sevenfincorp.com
     Access-Control-Allow-Methods: POST, OPTIONS
     Access-Control-Allow-Headers: Content-Type
     Access-Control-Allow-Credentials: true
     ```
   - **Response Body**: Empty or `{}`

4. **If POST**, continue with your validation logic

### Step 4: Complete Workflow Structure

Your workflow should look like this:

```
[Webhook Node: /webhook/validate]
    ↓
[IF Node: Check if OPTIONS]
    ├─ YES → [Respond to Webhook: 200 with CORS headers, empty body]
    └─ NO → [Your Validation Logic]
                ↓
            [Respond to Webhook: 200 with CORS headers + validation result]
```

### Step 5: Test the Configuration

1. **Save and Activate** your workflow
2. **Test from browser console**:
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

3. **Check browser Network tab**:
   - Look for the OPTIONS preflight request (should return 200)
   - Look for the POST request (should return 200 with CORS headers)

### Step 6: Allow Multiple Origins (Optional)

If you need to allow requests from multiple domains, you can use a Code node to dynamically set the origin:

```javascript
// Get the origin from the request
const requestOrigin = $input.first().json.headers['origin'] || 
                      $input.first().json.headers['referer'] || 
                      '';

// List of allowed origins
const allowedOrigins = [
  'https://lms.sevenfincorp.com',
  'http://localhost:3000',  // For local development
  'https://your-preview-domain.vercel.app'  // For preview deployments
];

// Check if origin is allowed
const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];

// Set CORS headers
$response.headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

return {
  json: $input.first().json
};
```

## Alternative: Configure CORS at n8n Instance Level

If you have access to n8n instance configuration, you can set CORS globally.

**📖 See detailed guide**: `N8N_INSTANCE_CORS_CONFIG.md` for complete instructions.

**Quick Summary:**

1. **n8n Cloud** (`*.app.n8n.cloud`): 
   - ❌ Cannot set environment variables directly
   - ✅ Contact n8n support OR use workflow-level CORS (Method 1 above)

2. **Self-Hosted n8n**:
   - ✅ Set environment variables:
     ```bash
     N8N_CORS_ORIGIN=https://lms.sevenfincorp.com
     N8N_CORS_CREDENTIALS=true
     ```
   - ✅ Restart n8n instance after setting variables

## Verification Checklist

- [ ] Workflow is active
- [ ] CORS headers are added to response
- [ ] OPTIONS preflight requests are handled
- [ ] Test request from browser console succeeds
- [ ] No CORS errors in browser console
- [ ] Login page can successfully call the webhook

## Troubleshooting

### Still Getting CORS Errors?

1. **Check browser console** for the exact error message
2. **Verify headers** in Network tab → Headers section
3. **Test with curl**:
   ```bash
   curl -X OPTIONS https://fixrrahul.app.n8n.cloud/webhook/validate \
     -H "Origin: https://lms.sevenfincorp.com" \
     -H "Access-Control-Request-Method: POST" \
     -v
   ```
   Look for `Access-Control-Allow-Origin` in the response headers

3. **Check n8n workflow execution logs** to see if the webhook is being triggered

### Common Issues

- **Headers not being set**: Make sure you're using "Respond to Webhook" node, not just returning data
- **OPTIONS not handled**: Browser will fail if preflight OPTIONS request doesn't return proper headers
- **Workflow not active**: Make sure the workflow toggle is ON (green)

## Need Help?

If you're still having issues:
1. Check n8n workflow execution logs
2. Verify the webhook URL is correct
3. Test the webhook with a tool like Postman (which doesn't enforce CORS)
4. Check n8n documentation: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/

