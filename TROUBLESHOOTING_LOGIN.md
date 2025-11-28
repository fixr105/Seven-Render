# 🔧 Troubleshooting "Invalid login credentials"

## Quick Diagnostic Steps

### Step 1: Check Environment Variables

Make sure your `.env` file exists and has correct values:

```bash
cat .env
```

Should show:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**If missing or incorrect:**
1. Go to Supabase Dashboard → Settings → API
2. Copy Project URL and anon key
3. Update `.env` file
4. **Restart the dev server** (Ctrl+C, then `npm run dev`)

---

### Step 2: Check if User Exists in Supabase Auth

Run this in **Supabase SQL Editor**:

```sql
SELECT 
  id,
  email,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '❌ NOT CONFIRMED'
    ELSE '✅ CONFIRMED'
  END as status
FROM auth.users 
WHERE email = 'client@test.com' OR email = 'client@demo.com';
```

**Expected Result:**
- Should return 1 row
- `email_confirmed_at` should NOT be NULL
- If NULL → Email not confirmed (this causes login failure!)

**Fix if email not confirmed:**
- Delete the user and recreate in Dashboard
- **IMPORTANT:** Check "Auto Confirm User" when creating

---

### Step 3: Check User Role Exists

```sql
SELECT 
  ur.role,
  ur.account_status,
  au.email,
  CASE 
    WHEN ur.id IS NULL THEN '❌ NO ROLE'
    ELSE '✅ ROLE EXISTS'
  END as status
FROM auth.users au
LEFT JOIN user_roles ur ON ur.user_id = au.id
WHERE au.email = 'client@test.com' OR au.email = 'client@demo.com';
```

**Expected Result:**
- Should return 1 row with `role = 'client'`
- If no row or role is NULL → User role not created

**Fix:**
- Run the setup SQL script (`scripts/setup-users.sql`)
- Or manually create role (see Step 4)

---

### Step 4: Verify Password

Common issues:
- ❌ Wrong password (check for typos)
- ❌ Password doesn't match what was set
- ❌ Copy-paste added extra spaces

**Test:** Try creating a new user with a simple password first

---

## 🚀 Quick Fix: Create User from Scratch

### Option 1: Using Supabase Dashboard (Easiest)

1. **Go to:** Supabase Dashboard → Authentication → Users
2. **Click:** "Add user"
3. **Enter:**
   - Email: `client@test.com`
   - Password: `Test@123456`
   - ✅ **Check "Auto Confirm User"** (CRITICAL!)
4. **Click:** "Create user"
5. **Copy the UUID** from the users table
6. **Go to:** SQL Editor
7. **Run:**

```sql
-- Replace YOUR_USER_ID with the UUID you copied
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('YOUR_USER_ID'::uuid, 'client', 'Active')
ON CONFLICT (user_id) DO NOTHING;

-- Then create client profile
INSERT INTO dsa_clients (
  user_id,
  company_name,
  contact_person,
  email,
  phone,
  commission_rate,
  modules_enabled,
  is_active
)
SELECT 
  ur.id,
  'Test Corporation',
  'John Doe',
  'client@test.com',
  '+91 9876543210',
  0.015,
  '{"ledger": true, "queries": true, "applications": true, "form_builder": true}'::jsonb,
  true
FROM user_roles ur
WHERE ur.user_id = 'YOUR_USER_ID'::uuid
ON CONFLICT (user_id) DO NOTHING;
```

---

### Option 2: Check Browser Console for Specific Error

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Try logging in
4. Look for red error messages
5. Check **Network** tab for failed requests

**Common errors:**

- `Invalid login credentials` → User doesn't exist or password wrong
- `Email not confirmed` → User not auto-confirmed
- `Failed to fetch` → Environment variables wrong or network issue
- `User not found` → Auth works but role missing

---

## ✅ Complete Verification Query

Run this to check everything at once:

```sql
SELECT 
  '1. Auth User' as check_item,
  CASE 
    WHEN au.id IS NULL THEN '❌ MISSING'
    WHEN au.email_confirmed_at IS NULL THEN '⚠️ NOT CONFIRMED'
    ELSE '✅ EXISTS & CONFIRMED'
  END as status,
  au.email,
  au.email_confirmed_at
FROM auth.users au
WHERE au.email = 'client@test.com'

UNION ALL

SELECT 
  '2. User Role' as check_item,
  CASE 
    WHEN ur.id IS NULL THEN '❌ MISSING'
    ELSE '✅ EXISTS'
  END as status,
  ur.role::text,
  ur.account_status::text
FROM auth.users au
LEFT JOIN user_roles ur ON ur.user_id = au.id
WHERE au.email = 'client@test.com'

UNION ALL

SELECT 
  '3. Client Profile' as check_item,
  CASE 
    WHEN dc.id IS NULL THEN '❌ MISSING'
    ELSE '✅ EXISTS'
  END as status,
  dc.company_name,
  dc.email
FROM auth.users au
LEFT JOIN user_roles ur ON ur.user_id = au.id
LEFT JOIN dsa_clients dc ON dc.user_id = ur.id
WHERE au.email = 'client@test.com';
```

---

## 🔍 Most Common Issues

### Issue 1: "Auto Confirm User" Not Checked

**Symptom:** User exists but login fails
**Fix:** 
- Delete user in Dashboard
- Recreate with "Auto Confirm User" checked

### Issue 2: Environment Variables Not Loaded

**Symptom:** "Failed to fetch" or connection errors
**Fix:**
- Check `.env` file exists in project root
- Restart dev server after changing `.env`
- Variables must start with `VITE_`

### Issue 3: Wrong Email/Password

**Symptom:** "Invalid login credentials"
**Fix:**
- Double-check email spelling
- Try copy-pasting password
- Verify password matches what was set

### Issue 4: User Role Not Created

**Symptom:** Login works but shows "User not found" after
**Fix:**
- Run SQL script to create user role
- Or manually insert into `user_roles` table

---

## 🆘 Still Not Working?

1. **Check Supabase Dashboard:**
   - Is your project active?
   - Are you in the correct project?
   - Check API settings match `.env` file

2. **Check Network:**
   - Open DevTools → Network tab
   - Look for failed requests to Supabase
   - Check error messages

3. **Reset Everything:**
   - Delete all test users
   - Start fresh with the setup script
   - Follow `QUICK_SETUP.md` step by step

4. **Test with Simple User:**
   - Create one user manually
   - Test login
   - If works, then create others

---

## 📞 Quick Reference

**Login Credentials:**
- Email: `client@test.com` (or `client@demo.com`)
- Password: `Test@123456` (or `Demo@123456`)

**SQL Editor Location:**
- Supabase Dashboard → SQL Editor → New query

**Auth Users Location:**
- Supabase Dashboard → Authentication → Users

**Environment Variables:**
- Supabase Dashboard → Settings → API

---

**After fixing, try logging in again!** 🎉
