# Step-by-Step: Debug Field Name Mismatch

## Problem

- Sagar's account NOT in webhook (filtered out)
- test@gmail.com IS in webhook (should be filtered)
- Field name mismatch between Airtable and filter

---

## Step 1: Check Airtable Node Output

1. Open n8n workflow
2. Click **"Test workflow"**
3. Click on **"Airtable - Search User Accounts"** node
4. Look at the **output data**

**What to check:**
- What is the structure? `{id: "...", fields: {...}}` or `{id: "...", Username: "..."}`?
- What is the email field called? `Username` or `Email`?
- What is the status field called? `Account Status` or `Status` or `AccountStatus`?
- Is Sagar's account in the output?

**Write down the exact field names you see!**

---

## Step 2: Check Filter Node Input

1. Click on **"Filter Test Accounts"** node
2. Look at the **input data**

**What to check:**
- Does it match Airtable output structure?
- What field names does it see?
- Is Sagar's account in the input?

---

## Step 3: Check Filter Node Output

1. Still in Filter node
2. Look at the **output data**

**What to check:**
- Is Sagar's account in the output?
- Is test@gmail.com in the output?
- What records passed the filter?

---

## Step 4: Fix Based on What You See

### If Airtable Returns `fields.Email`:
Update all filter conditions:
- From: `$json.fields.Username`
- To: `$json.fields.Email`

### If Airtable Returns `fields.Status`:
Update Account Status condition:
- From: `$json.fields['Account Status']`
- To: `$json.fields.Status`

### If Fields Are at Root:
Update all conditions:
- From: `$json.fields.Username`
- To: `$json.Username`

---

## Step 5: Test Again

After updating filter:
1. Click "Test workflow"
2. Check Filter node output
3. Should show Sagar, NOT test@gmail.com
4. Test webhook: `curl https://fixrrahul.app.n8n.cloud/webhook/useraccount`

---

## Quick Test: Bypass Filter

To verify Airtable is returning Sagar:

1. **Temporarily disconnect Filter node**
2. **Connect**: Airtable → Respond to Webhook
3. **Test webhook**
4. **Check**: Does Sagar appear?

**If YES**: Filter field names are wrong - fix them
**If NO**: Airtable node issue - check Airtable connection/query

---

**Check the Airtable node output first, then update filter to match exact field names!** 🔍
