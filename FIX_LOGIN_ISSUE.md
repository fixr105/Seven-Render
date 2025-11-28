# 🔧 Fix "Invalid login credentials" Error

## The Problem

You're seeing "Invalid login credentials" because **the test users haven't been created in Supabase yet**.

---

## ✅ Quick Fix (5 Minutes)

### Step 1: Create User in Supabase Dashboard (2 min)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Go to Authentication → Users**
   - Click "Users" in the left sidebar
   - Click "Add user" button (top right)

3. **Create the user:**
   ```
   Email: client@test.com
   Password: Test@123456
   ```
   - ✅ **IMPORTANT:** Check "Auto Confirm User" or "Auto Confirm Email"
   - Click "Create user"

4. **Copy the User ID (UUID)**
   - After creating, you'll see the user in the table
   - Copy the UUID (looks like: `abc12345-def6-7890-ghij-klmnopqrstuv`)

---

### Step 2: Create User Role (2 min)

1. **Go to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

2. **Run this SQL** (replace `YOUR_USER_ID` with the UUID you copied):

```sql
-- Step 1: Create user role
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('YOUR_USER_ID'::uuid, 'client', 'Active')
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Create client profile
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

**Example (with actual UUID):**
```sql
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid, 'client', 'Active')
ON CONFLICT (user_id) DO NOTHING;
```

---

### Step 3: Test Login (1 min)

1. **Go back to your app:** http://localhost:5173
2. **Login with:**
   - Email: `client@test.com`
   - Password: `Test@123456`

**✅ Should work now!**

---

## 🔍 Still Not Working?

### Check 1: Is Email Confirmed?

Run this in SQL Editor:
```sql
SELECT email, email_confirmed_at 
FROM auth.users 
WHERE email = 'client@test.com';
```

**If `email_confirmed_at` is NULL:**
- Delete the user in Dashboard
- Recreate with "Auto Confirm User" checked

---

### Check 2: Does Role Exist?

Run this:
```sql
SELECT ur.* 
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'client@test.com';
```

**If no results:**
- Run Step 2 SQL again

---

### Check 3: Environment Variables

Check your `.env` file exists and has:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**If wrong:**
1. Get values from: Supabase Dashboard → Settings → API
2. Update `.env` file
3. **Restart dev server:** Ctrl+C, then `npm run dev`

---

## 📋 Complete Setup Script

Want to create all 4 test users at once? Use:

- **File:** `scripts/setup-users.sql`
- **Guide:** `scripts/setup-users-guide.md`

---

## 🆘 Quick Diagnostic

Run this in SQL Editor to check everything:

```sql
-- Quick diagnostic
SELECT 
  au.email,
  CASE WHEN au.email_confirmed_at IS NOT NULL THEN '✅' ELSE '❌' END as confirmed,
  CASE WHEN ur.id IS NOT NULL THEN '✅' ELSE '❌' END as role,
  CASE WHEN dc.id IS NOT NULL THEN '✅' ELSE '❌' END as profile
FROM auth.users au
LEFT JOIN user_roles ur ON ur.user_id = au.id
LEFT JOIN dsa_clients dc ON dc.user_id = ur.id
WHERE au.email = 'client@test.com';
```

All should show ✅

---

## ✅ After Login Works

You should see:
- Dashboard with stats
- Navigation sidebar
- "New Application" button
- Commission ledger access

---

**Need more help?** See `TROUBLESHOOTING_LOGIN.md` for detailed troubleshooting.
