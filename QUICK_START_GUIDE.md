# Quick Start Guide - Fix Critical Issues

**Date:** 2026-01-27  
**Purpose:** Quick reference for fixing critical data issues

## Critical Issues Summary

1. ❌ **KAM/Credit Team Login Broken** - Email fields contain names instead of emails
2. ❌ **Notifications Not Saving** - n8n webhook has no field mappings
3. ⚠️ **Data Visibility** - Need to assign clients to KAM Sagar

## Quick Fix Checklist

### Step 1: Fix Email Fields (5 minutes) ⚠️ CRITICAL

**Airtable → KAM Users table:**
- [ ] Find record with `Email = "Sagar"`
- [ ] Change to: `sagar@example.com` (or actual email)
- [ ] Note the `KAM ID` value

**Airtable → Credit Team Users table:**
- [ ] Find record with `Email = "Rahul"`
- [ ] Change to: `rahul@example.com` (or actual email)

**Airtable → User Accounts table:**
- [ ] Find KAM user account (`Role = "kam"`)
- [ ] Set `Username` = same email as KAM Users
- [ ] Find Credit Team user account (`Role = "credit_team"`)
- [ ] Set `Username` = same email as Credit Team Users

### Step 2: Fix Notifications Webhook (10 minutes) ⚠️ CRITICAL

**n8n Workflow:**
- [ ] Open "Post Notifications" Airtable node
- [ ] Set Mapping Mode = "Define Below"
- [ ] Add all 15 field mappings (see `N8N_NOTIFICATIONS_WEBHOOK_FIX.md`)
- [ ] Save and activate workflow

### Step 3: Assign Clients to KAM Sagar (5 minutes)

**Airtable → Clients table:**
- [ ] Select all client records
- [ ] Set `Assigned KAM` = KAM Sagar's `KAM ID` (from Step 1)
- [ ] Save changes

## Testing

### Test Login
```bash
# Test KAM login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sagar@example.com", "password": "your-password"}'

# Check JWT contains kamId (not null)
```

### Test Notifications
```bash
node test-notifications-webhook.js
# Then check Airtable → Notifications table
```

### Test Email Validation
```bash
node test-email-validation.js
```

## Files to Reference

- **Detailed Manual Steps:** `MANUAL_FIXES_REQUIRED.md`
- **n8n Configuration:** `N8N_NOTIFICATIONS_WEBHOOK_FIX.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`

## Expected Results

After fixes:
- ✅ KAM users can login
- ✅ Credit Team users can login
- ✅ Notifications are saved to Airtable
- ✅ KAM Sagar sees all clients and data
- ✅ Email validation prevents invalid emails

## Need Help?

1. Check `MANUAL_FIXES_REQUIRED.md` for detailed steps
2. Check `N8N_NOTIFICATIONS_WEBHOOK_FIX.md` for n8n configuration
3. Review backend logs for validation errors
4. Test with provided test scripts
