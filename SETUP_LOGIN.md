# 🚀 Setup Login - 2 Minute Guide

## ✅ Login is Now Fixed!

The login page now uses **real Supabase authentication**. You just need to create one test user to get started.

---

## Quick Setup (2 Minutes)

### Step 1: Create Auth User

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add user"**
3. Enter:
   ```
   Email: client@demo.com
   Password: Demo@123456
   ```
4. ✅ **IMPORTANT:** Check "Auto Confirm Email"
5. Click **"Create user"**

### Step 2: Setup User Profile

Copy the **User ID** (UUID) from the users table, then run this in **SQL Editor**:

```sql
SELECT setup_test_client('client@demo.com', 'PASTE_USER_ID_HERE'::uuid);
```

Example:
```sql
SELECT setup_test_client('client@demo.com', 'abc12345-def6-7890-1234-567890abcdef'::uuid);
```

### Step 3: Login! 🎉

1. Go to your app: `http://localhost:5173`
2. You'll see a **blue demo box** with credentials
3. Click "Auto-fill demo credentials" (or type manually)
4. Click "Sign In"

**Done! You should now see the Client Dashboard!**

---

## 🎯 What You'll See

After login as client:
- ✅ Dashboard with stats
- ✅ "New Application" button
- ✅ Recent applications list
- ✅ Commission ledger access
- ✅ Navigation sidebar

---

## 📝 Create the Setup Function (If Needed)

If you get "function does not exist", run this first:

```sql
CREATE OR REPLACE FUNCTION setup_test_client(user_email text, user_auth_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
  client_id uuid;
BEGIN
  -- Create user role
  INSERT INTO user_roles (user_id, role, account_status)
  VALUES (user_auth_id, 'client', 'Active')
  ON CONFLICT (user_id) DO UPDATE SET role = 'client'
  RETURNING id INTO role_id;

  -- Create client profile
  INSERT INTO dsa_clients (
    user_id, company_name, contact_person, email, phone, commission_rate, is_active
  )
  VALUES (
    role_id, 'Demo Client Corp', 'Demo User', user_email, '+91 9999999999', 0.015, true
  )
  ON CONFLICT (user_id) DO UPDATE SET email = user_email
  RETURNING id INTO client_id;

  RETURN jsonb_build_object(
    'success', true,
    'role_id', role_id,
    'client_id', client_id,
    'message', 'Client setup complete'
  );
END;
$$;
```

---

## 🐛 Troubleshooting

### "Invalid login credentials"
- ✅ Make sure you checked "Auto Confirm Email" when creating user
- ✅ Use exact password: `Demo@123456` (capital D, @ symbol)
- ✅ Use exact email: `client@demo.com`

### Login successful but shows "User not found"
- ✅ Make sure you ran the `setup_test_client` function
- ✅ Check this query returns data:
  ```sql
  SELECT * FROM user_roles
  WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'client@demo.com');
  ```

### "Function setup_test_client does not exist"
- ✅ Run the CREATE FUNCTION SQL above first

### Can't see dashboard after login
- ✅ Check browser console for errors (F12)
- ✅ Verify user_roles entry exists
- ✅ Verify dsa_clients profile exists

---

## ✅ Verify Everything Works

Run these queries to verify setup:

```sql
-- 1. Check auth user exists
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'client@demo.com';
-- Should return 1 row with confirmed_at not null

-- 2. Check user role exists
SELECT ur.id, ur.role, ur.account_status
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'client@demo.com';
-- Should return 1 row with role = 'client'

-- 3. Check client profile exists
SELECT dc.company_name, dc.email, dc.commission_rate
FROM dsa_clients dc
JOIN user_roles ur ON dc.user_id = ur.id
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'client@demo.com';
-- Should return 1 row with company name and email
```

All three should return data!

---

## 🎯 Next Steps

After logging in successfully:

1. **Create an Application**
   - Click "New Application" button
   - Fill the form
   - Submit

2. **Check Commission Ledger**
   - Click "Ledger" in sidebar
   - View balance and transactions

3. **Test Real-time**
   - Open app in 2 browser windows
   - Create application in one
   - Watch it appear in the other

---

## 🔐 Create More Test Users

Want to test other roles? Create more auth users:

**KAM User:**
```
Email: kam@demo.com
Password: Demo@123456
```
Then run:
```sql
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('KAM_USER_ID'::uuid, 'kam', 'Active');
```

**Credit Team:**
```
Email: credit@demo.com
Password: Demo@123456
```
Then run:
```sql
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('CREDIT_USER_ID'::uuid, 'credit_team', 'Active');
```

---

## ✨ New Features

The login page now has:
- ✅ Real Supabase authentication
- ✅ Auto-redirect if already logged in
- ✅ Demo credentials box with auto-fill
- ✅ Error messages for failed login
- ✅ Loading states
- ✅ Password show/hide toggle

---

**That's it! You should now be able to login successfully!** 🎉

If you still have issues, check the browser console (F12) for specific error messages.
