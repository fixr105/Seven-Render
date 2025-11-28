# Quick Setup Guide for Dummy Users

## 🎯 Fastest Method (5 minutes)

### Step 1: Create Auth Users in Supabase Dashboard

1. Go to: **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Add user"** button 4 times and create:

| # | Email | Password | Auto-Confirm? |
|---|-------|----------|---------------|
| 1 | `client@test.com` | `Test@123456` | ✅ Check this |
| 2 | `kam@test.com` | `Test@123456` | ✅ Check this |
| 3 | `credit@test.com` | `Test@123456` | ✅ Check this |
| 4 | `nbfc@test.com` | `Test@123456` | ✅ Check this |

**Important:** Make sure to check "Auto Confirm User" or "Auto Confirm Email" for each user!

### Step 2: Get User IDs

After creating users, run this in **SQL Editor**:

```sql
SELECT id, email FROM auth.users WHERE email LIKE '%@test.com';
```

Copy all 4 UUIDs.

### Step 3: Run Setup SQL

1. Go to **SQL Editor** → **New query**
2. Open file: `scripts/setup-users.sql`
3. Find this section at the top:

```sql
client_auth_uuid uuid := '00000000-0000-0000-0000-000000000001'; -- Replace with actual UUID
kam_auth_uuid uuid := '00000000-0000-0000-0000-000000000002';    -- Replace with actual UUID
credit_auth_uuid uuid := '00000000-0000-0000-0000-000000000003'; -- Replace with actual UUID
nbfc_auth_uuid uuid := '00000000-0000-0000-0000-000000000004';   -- Replace with actual UUID
```

4. Replace each UUID with the actual ones from Step 2
5. Click **"Run"**

### Step 4: Verify

Run this to verify users were created:

```sql
SELECT
  ur.role,
  au.email,
  ur.account_status
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email LIKE '%@test.com'
ORDER BY ur.role;
```

You should see 4 rows.

---

## ✅ Done! Now login:

**Start the dev server:**
```bash
npm run dev
```

**Login credentials:**
- Email: `client@test.com` / Password: `Test@123456`
- Email: `kam@test.com` / Password: `Test@123456`
- Email: `credit@test.com` / Password: `Test@123456`
- Email: `nbfc@test.com` / Password: `Test@123456`
