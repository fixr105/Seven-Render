# Create Test Client User - Quick Guide

## 🚀 Fast Setup (2 Minutes)

### Step 1: Create Auth User in Supabase Dashboard

1. Open your **Supabase Dashboard**
2. Go to **Authentication** → **Users**
3. Click **"Add user"** button
4. Fill in:
   - **Email:** `client@demo.com`
   - **Password:** `Demo@123456`
   - ✅ **Check** "Auto Confirm Email" (IMPORTANT!)
5. Click **"Create user"**

### Step 2: Copy the User ID

After creating, you'll see the new user in the table. **Copy the UUID** (looks like: `abc12345-def6-7890-ghij-klmnopqrstuv`)

### Step 3: Run This SQL

Go to **SQL Editor** and run this (replace `YOUR_USER_ID` with the actual UUID):

```sql
-- Replace YOUR_USER_ID with the actual UUID you copied
SELECT setup_test_client('client@demo.com', 'YOUR_USER_ID'::uuid);
```

Example:
```sql
SELECT setup_test_client('client@demo.com', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid);
```

### Step 4: Login! 🎉

Go to your app and login with:
```
Email: client@demo.com
Password: Demo@123456
```

---

## ✅ What Gets Created

The setup function automatically creates:
- ✅ User role (client)
- ✅ DSA Client profile (Demo Client Corp)
- ✅ Commission rate (1.5%)
- ✅ All necessary relationships

---

## 🐛 Troubleshooting

### "Function setup_test_client does not exist"
Run this first:
```sql
CREATE OR REPLACE FUNCTION setup_test_client(user_email text, user_auth_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
  client_id uuid;
  result jsonb;
BEGIN
  INSERT INTO user_roles (user_id, role, account_status)
  VALUES (user_auth_id, 'client', 'Active')
  ON CONFLICT (user_id) DO UPDATE SET role = 'client'
  RETURNING id INTO role_id;

  INSERT INTO dsa_clients (
    user_id, company_name, contact_person, email, phone, commission_rate, is_active
  )
  VALUES (
    role_id, 'Demo Client Corp', 'Demo User', user_email, '+91 9999999999', 0.015, true
  )
  ON CONFLICT (user_id) DO UPDATE SET company_name = 'Demo Client Corp', email = user_email
  RETURNING id INTO client_id;

  RETURN jsonb_build_object('success', true, 'role_id', role_id, 'client_id', client_id);
END;
$$;
```

### "Invalid login credentials"
- Make sure you clicked "Auto Confirm Email" when creating the user
- Try password exactly: `Demo@123456`
- Check email is exactly: `client@demo.com`

### "User not found" after login
- Make sure you ran the `setup_test_client` function
- Check: `SELECT * FROM user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'client@demo.com');`

---

## 🔍 Verify Setup

```sql
-- Check auth user exists
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'client@demo.com';

-- Check role exists
SELECT ur.id, ur.role, au.email
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'client@demo.com';

-- Check client profile exists
SELECT dc.company_name, dc.email, dc.commission_rate
FROM dsa_clients dc
JOIN user_roles ur ON dc.user_id = ur.id
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'client@demo.com';
```

All three queries should return results.

---

## 📝 Alternative: Create Multiple Test Users

After Step 1-2 above, you can create all roles at once:

```sql
-- KAM User (after creating kam@demo.com in Dashboard)
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('KAM_USER_ID_HERE'::uuid, 'kam', 'Active');

-- Credit Team User (after creating credit@demo.com in Dashboard)
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('CREDIT_USER_ID_HERE'::uuid, 'credit_team', 'Active');
```

---

**That's it! You should now be able to login as a client.** 🎉
