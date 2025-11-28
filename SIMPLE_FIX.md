# 🚀 Simple Fix - Create Test User in 3 Steps

You're seeing "Invalid email or password" because the user doesn't exist yet. Here's the **easiest way** to fix it:

---

## ✅ Step 1: Create Auth User (2 minutes)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Go to Authentication → Users**
   - Click "Users" in the left sidebar
   - Click "Add user" button

3. **Fill in the form:**
   ```
   Email: client@test.com
   Password: Test@123456
   ```
   
4. **✅ CRITICAL:** Check "Auto Confirm User" checkbox
   - This is VERY important! Without it, login will fail.

5. **Click "Create user"**

6. **Copy the UUID**
   - You'll see the user in the table
   - Copy the UUID (the long ID like: `abc12345-def6-7890-...`)

---

## ✅ Step 2: Run SQL Script (1 minute)

1. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

2. **Open the file:** `scripts/create-single-user.sql`

3. **Find this line:**
   ```sql
   user_uuid uuid := 'USER_UUID_HERE';
   ```

4. **Replace `USER_UUID_HERE` with your UUID:**
   ```sql
   user_uuid uuid := 'abc12345-def6-7890-ghij-klmnopqrstuv';
   ```

5. **Click "Run" button**

You should see: ✅ SUCCESS messages

---

## ✅ Step 3: Login! (30 seconds)

1. **Go to:** http://localhost:5173

2. **Login with:**
   ```
   Email: client@test.com
   Password: Test@123456
   ```

3. **✅ Done!** You should see the dashboard.

---

## 🔍 Quick Check: Did It Work?

Run this in SQL Editor to verify:

```sql
SELECT 
  au.email,
  au.email_confirmed_at,
  ur.role,
  dc.company_name
FROM auth.users au
LEFT JOIN user_roles ur ON ur.user_id = au.id
LEFT JOIN dsa_clients dc ON dc.user_id = ur.id
WHERE au.email = 'client@test.com';
```

**Expected Result:**
- Should return 1 row
- `email_confirmed_at` should NOT be NULL
- `role` should be `client`
- `company_name` should be `Test Corporation`

---

## ❌ Still Not Working?

### Check 1: Email Confirmed?
```sql
SELECT email, email_confirmed_at 
FROM auth.users 
WHERE email = 'client@test.com';
```

**If `email_confirmed_at` is NULL:**
- Delete the user in Dashboard
- Recreate with "Auto Confirm User" checked

### Check 2: Environment Variables
Check your `.env` file:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**If wrong or missing:**
1. Get values from: Supabase Dashboard → Settings → API
2. Update `.env` file
3. **Restart dev server:** Stop (Ctrl+C) and run `npm run dev` again

### Check 3: Browser Console
1. Press F12 to open DevTools
2. Go to "Console" tab
3. Try logging in
4. Look for error messages
5. Share the error if you need help

---

## 📝 Alternative: Manual SQL (If Script Doesn't Work)

If you prefer to do it manually:

```sql
-- 1. Get your user UUID first:
SELECT id, email FROM auth.users WHERE email = 'client@test.com';

-- 2. Replace YOUR_UUID with the ID from above:
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('YOUR_UUID'::uuid, 'client', 'Active')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Create client profile:
INSERT INTO dsa_clients (
  user_id, company_name, contact_person, email, phone, 
  commission_rate, modules_enabled, is_active
)
SELECT 
  ur.id,
  'Test Corporation', 'John Doe', 'client@test.com', '+91 9876543210',
  0.015,
  '{"ledger": true, "queries": true, "applications": true, "form_builder": true}'::jsonb,
  true
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'client@test.com'
ON CONFLICT (user_id) DO NOTHING;
```

---

## ✅ What You Should See After Login

- Dashboard with statistics cards
- "New Application" button
- Navigation sidebar
- Commission ledger access
- Recent applications table

---

**That's it! Follow these 3 steps and you'll be logged in.** 🎉

Need more help? Check `TROUBLESHOOTING_LOGIN.md` for detailed troubleshooting.
