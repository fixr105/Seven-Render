# Manual Fixes Required - Critical Data Issues

**Date:** 2026-01-27  
**Status:** ⚠️ **MANUAL ACTION REQUIRED**

This document outlines the manual steps required to fix critical data issues that cannot be automated.

## Critical Priority: Email Field Fixes

### Step 1: Fix KAM Users Email Field

**Location:** Airtable → `KAM Users` table

**Action:**
1. Open Airtable and navigate to `KAM Users` table
2. Find the record where `Email` field contains `"Sagar"` (not an email address)
3. Update the `Email` field to an actual email address:
   - Example: `sagar@example.com` or `sagar@seven.com`
   - **Important:** Use the actual email address that KAM Sagar will use to login
4. Note the `KAM ID` value for this record (you'll need it for Step 4)

**Verification:**
- After update, the `Email` field should contain a valid email address format (contains `@` and `.`)

---

### Step 2: Fix Credit Team Users Email Field

**Location:** Airtable → `Credit Team Users` table

**Action:**
1. Open Airtable and navigate to `Credit Team Users` table
2. Find the record where `Email` field contains `"Rahul"` (not an email address)
3. Update the `Email` field to an actual email address:
   - Example: `rahul@example.com` or `rahul@seven.com`
   - **Important:** Use the actual email address that the Credit Team user will use to login

**Verification:**
- After update, the `Email` field should contain a valid email address format

---

### Step 3: Update User Accounts to Match Emails

**Location:** Airtable → `User Accounts` table

**Action:**
1. Open Airtable and navigate to `User Accounts` table
2. Find the user account for KAM Sagar:
   - Look for record where `Role` = `"kam"` or `"KAM"`
   - Update `Username` field to match the email address you set in Step 1
   - Example: If you set `Email = "sagar@example.com"` in KAM Users, set `Username = "sagar@example.com"` here
3. Find the user account for Credit Team user:
   - Look for record where `Role` = `"credit_team"` or `"Credit"`
   - Update `Username` field to match the email address you set in Step 2
   - Example: If you set `Email = "rahul@example.com"` in Credit Team Users, set `Username = "rahul@example.com"` here

**Critical:** The `Username` field in `User Accounts` must **exactly match** the `Email` field in the corresponding role table (`KAM Users` or `Credit Team Users`).

**Verification:**
- `User Accounts["Username"]` = `KAM Users["Email"]` (for KAM users)
- `User Accounts["Username"]` = `Credit Team Users["Email"]` (for Credit Team users)

---

### Step 4: Assign All Clients to KAM Sagar

**Location:** Airtable → `Clients` table

**Purpose:** Ensure KAM Sagar can see all clients and all related data (loan applications, commission ledger, etc.)

**Action:**
1. Open Airtable and navigate to `Clients` table
2. Note KAM Sagar's `KAM ID` from Step 1 (from `KAM Users` table)
3. For **all client records** in the `Clients` table:
   - Update the `Assigned KAM` field to KAM Sagar's `KAM ID`
   - This can be done in bulk:
     - Select all client records
     - Use "Update records" action
     - Set `Assigned KAM` = KAM Sagar's `KAM ID`

**Verification:**
- All clients should have `Assigned KAM` = KAM Sagar's `KAM ID`
- After login as KAM Sagar, all clients should be visible

---

## n8n Configuration: Fix Notifications Webhook

### Step 5: Configure Notifications POST Webhook Field Mappings

**Location:** n8n workflow interface

**Action:**
1. Open n8n and navigate to your workflow
2. Find the "Post Notifications" Airtable node (connected to `/webhook/notification`)
3. Click on the node to edit it
4. In the node configuration:
   - Set **Operation** to `upsert`
   - Set **Matching Columns** to `["id"]`
   - Set **Mapping Mode** to `"Define Below"`
5. Add the following field mappings in the **Columns** section:

```
id → ={{ $json.body.id }}
Notification ID → ={{ $json.body['Notification ID'] }}
Recipient User → ={{ $json.body['Recipient User'] }}
Recipient Role → ={{ $json.body['Recipient Role'] }}
Related File → ={{ $json.body['Related File'] }}
Related Client → ={{ $json.body['Related Client'] }}
Related Ledger Entry → ={{ $json.body['Related Ledger Entry'] }}
Notification Type → ={{ $json.body['Notification Type'] }}
Title → ={{ $json.body['Title'] }}
Message → ={{ $json.body['Message'] }}
Channel → ={{ $json.body['Channel'] }}
Is Read → ={{ $json.body['Is Read'] }}
Created At → ={{ $json.body['Created At'] }}
Read At → ={{ $json.body['Read At'] }}
Action Link → ={{ $json.body['Action Link'] }}
```

6. Save the workflow
7. Activate the workflow if it's not already active

**Verification:**
- Test by posting a notification via backend API
- Check Airtable `Notifications` table - the notification should appear with all fields populated

---

## Testing Checklist

After completing all manual fixes, test the following:

### Email Field Fixes
- [ ] Login as KAM user using the email address set in Step 1
- [ ] Verify login succeeds
- [ ] Check JWT token contains `kamId` (not null)
- [ ] Login as Credit Team user using the email address set in Step 2
- [ ] Verify login succeeds
- [ ] Check JWT token contains `creditTeamId` (not null)

### Data Visibility
- [ ] Login as KAM Sagar
- [ ] Verify all clients are visible in dashboard
- [ ] Verify all loan applications are visible
- [ ] Verify commission ledger entries are visible
- [ ] Verify file audit logs are visible

### Notifications Webhook
- [ ] POST a test notification via backend API
- [ ] Verify notification appears in Airtable `Notifications` table
- [ ] Verify all 15 fields are populated correctly

### Email Validation
- [ ] Attempt to POST KAM user with invalid email (e.g., "Sagar") → should fail with error
- [ ] Attempt to POST Credit Team user with invalid email (e.g., "Rahul") → should fail with error
- [ ] POST with valid email → should succeed

---

## Notes

- **Email fields are case-insensitive** - matching is done with `.toLowerCase()`
- **Email format validation** is now enforced in backend - invalid emails will be rejected
- **KAM Sagar's visibility** depends on `Clients["Assigned KAM"]` matching KAM Sagar's `KAM ID`
- **All manual steps must be completed** before testing - incomplete fixes will cause test failures

---

## Support

If you encounter issues:
1. Verify email addresses match exactly between `User Accounts["Username"]` and role-specific tables
2. Check that KAM Sagar's `KAM ID` is correctly set in `Clients["Assigned KAM"]`
3. Verify n8n workflow is active and field mappings are correct
4. Check backend logs for validation errors
