# ✅ Setup Complete - Dummy Users & Localhost

## What Has Been Created

### 📝 Setup Files

1. **`scripts/setup-users.sql`** - Complete SQL script to create all dummy users
   - Creates user roles
   - Creates client and NBFC profiles
   - Creates sample data

2. **`scripts/setup-users-guide.md`** - Quick 5-minute setup guide

3. **`scripts/setup-dummy-users.js`** - Optional automated Node.js script
   - Requires SUPABASE_SERVICE_ROLE_KEY in .env

4. **`QUICK_SETUP.md`** - Complete quick reference guide

5. **`SETUP_LOCALHOST.md`** - Detailed documentation

---

## 🚀 Next Steps

### 1. Create Dummy Users (5 minutes)

**Option A: Using SQL Script (Recommended)**

1. Create auth users in Supabase Dashboard:
   - Go to: Authentication → Users
   - Create 4 users with "Auto Confirm Email" checked:
     - `client@test.com` / `Test@123456`
     - `kam@test.com` / `Test@123456`
     - `credit@test.com` / `Test@123456`
     - `nbfc@test.com` / `Test@123456`

2. Get UUIDs:
   ```sql
   SELECT id, email FROM auth.users WHERE email LIKE '%@test.com';
   ```

3. Run `scripts/setup-users.sql` in SQL Editor (replace UUIDs first)

**Option B: Using Automated Script**
- Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Run: `node scripts/setup-dummy-users.js`

### 2. Development Server

The server should now be running at:
- **URL:** http://localhost:5173

If not running, start it with:
```bash
npm run dev
```

### 3. Test Login

Use these credentials:

| Role | Email | Password |
|------|-------|----------|
| Client | `client@test.com` | `Test@123456` |
| KAM | `kam@test.com` | `Test@123456` |
| Credit | `credit@test.com` | `Test@123456` |
| NBFC | `nbfc@test.com` | `Test@123456` |

---

## 📋 Test User Details

### Client (DSA Partner)
- **Company:** Test Corporation
- **Contact:** John Doe
- **Commission Rate:** 1.5%
- **KAM Assigned:** kam@test.com

### NBFC Partner
- **Name:** Test NBFC Bank
- **Contact:** Jane Smith
- **Region:** Mumbai, Maharashtra

---

## 🎯 What Each User Can Do

### Client (`client@test.com`)
- ✅ Create new loan applications
- ✅ View own applications
- ✅ View commission ledger
- ✅ Request payouts
- ✅ Raise queries
- ✅ Track application status

### KAM (`kam@test.com`)
- ✅ View assigned clients' applications
- ✅ Update application statuses
- ✅ Manage clients
- ✅ Onboard new clients
- ✅ Raise queries to clients
- ✅ Forward applications to credit

### Credit Team (`credit@test.com`)
- ✅ View ALL applications
- ✅ Update any application status
- ✅ Approve/reject payout requests
- ✅ Manage all clients
- ✅ Raise queries to KAMs
- ✅ Assign applications to NBFCs

### NBFC (`nbfc@test.com`)
- ✅ View assigned applications
- ✅ Record approval/rejection decisions
- ✅ Update application status

---

## ✅ Verification

After creating users, verify with:

```sql
-- Check all test users
SELECT ur.role, au.email, ur.account_status
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email LIKE '%@test.com'
ORDER BY ur.role;

-- Check client profile
SELECT dc.company_name, dc.email, dc.commission_rate
FROM dsa_clients dc
WHERE dc.email = 'client@test.com';

-- Check NBFC profile
SELECT np.name, np.email, np.is_active
FROM nbfc_partners np
WHERE np.email = 'nbfc@test.com';
```

---

## 🐛 Troubleshooting

### Server Not Starting
- Check `.env` file exists and has correct values
- Check port 5173 is not in use
- Run `npm install` again

### Login Issues
- Verify users created in Supabase Dashboard
- Check "Auto Confirm Email" was checked
- Verify SQL script ran successfully
- Check browser console for errors

### Environment Variables
- `.env` file must be in project root
- Variables must start with `VITE_`
- Restart server after changing `.env`

---

## 📚 Documentation

- **Quick Setup:** `QUICK_SETUP.md`
- **Detailed Guide:** `SETUP_LOCALHOST.md`
- **SQL Setup:** `scripts/setup-users-guide.md`
- **Main README:** `README.md`

---

## 🎉 You're Ready!

1. ✅ Dependencies installed
2. ✅ .env file exists
3. ✅ Setup scripts created
4. ✅ Development server running
5. ⏳ Create dummy users (follow Step 1 above)
6. ⏳ Test login and explore the system

---

**Need help?** Check the browser console or Supabase Dashboard logs for error details.
