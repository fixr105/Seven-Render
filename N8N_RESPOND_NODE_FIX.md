# Fix: Respond to Webhook Node Not Sending Data

## Issue

Filter is working (test@gmail.com filtered), but Respond to Webhook node isn't sending response.

---

## Common Issues

### Issue 1: Response Body Format

**Current (might not work):**
```
={{ $json }}
```

**Try these alternatives:**

**Option A:**
```
={{ $input.all() }}
```

**Option B:**
```
={{ $json | json }}
```

**Option C:**
```
={{ $input.item.json }}
```

### Issue 2: Response Mode

Verify:
- Response Mode: "responseNode" ✅
- Not: "lastNode" or "firstEntry"

### Issue 3: Data Not Reaching Respond Node

Check connection:
- Filter node → Respond to Webhook node
- Connection should be solid line
- No broken connections

---

## Quick Fix: Update Respond Node

1. **Open "Respond to Webhook32" node**
2. **Change Response Body to:**
   ```
   ={{ $input.all() }}
   ```
3. **Or try:**
   ```
   ={{ $json | json }}
   ```
4. **Save and test**

---

## Alternative: Add Set Node

If Respond node still doesn't work, add a Set node:

**Between Filter and Respond:**
- Add "Set" node
- Operation: "Keep Only Set Fields"
- Set fields to flatten Airtable structure
- Then Respond node uses: `={{ $json }}`

---

## Test

After fixing, test:
```bash
curl https://fixrrahul.app.n8n.cloud/webhook/useraccount
```

**Expected**: JSON array with Sagar's account (and other active, non-test accounts)

---

**Try changing Respond node response body to `={{ $input.all() }}`** 🔧
