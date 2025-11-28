# Test Users for Seven Fincorp

## 🔐 Dummy Sign-In Credentials

Use these test accounts to explore different user roles in the system.

---

## Quick Test Credentials

### 👤 Client (DSA Partner)
```
Email: client@test.com
Password: Test@123456
Role: DSA Client
Company: Test Corporation
```

### 👤 KAM (Key Account Manager)
```
Email: kam@test.com
Password: Test@123456
Role: KAM
```

### 👤 Credit Team
```
Email: credit@test.com
Password: Test@123456
Role: Credit Team
```

### 👤 NBFC Partner
```
Email: nbfc@test.com
Password: Test@123456
Role: NBFC Partner
```

---

## 🛠️ Setup Instructions

### Option 1: Quick Setup (SQL Script)

Run this SQL script in your Supabase SQL Editor to create all test users at once:

```sql
-- This script creates test users with proper roles and profiles
-- Note: You'll need to create the auth users manually first via Supabase Dashboard

-- Step 1: Create auth users in Supabase Dashboard first
-- Then get their UUIDs and replace them below

-- Example structure (replace UUIDs with actual ones):
DO $$
DECLARE
  client_auth_id uuid := '<CLIENT_AUTH_UUID>';
  kam_auth_id uuid := '<KAM_AUTH_UUID>';
  credit_auth_id uuid := '<CREDIT_AUTH_UUID>';
  nbfc_auth_id uuid := '<NBFC_AUTH_UUID>';

  client_role_id uuid;
  kam_role_id uuid;
  credit_role_id uuid;
  nbfc_role_id uuid;
BEGIN
  -- Create user roles
  INSERT INTO user_roles (user_id, role, account_status)
  VALUES
    (client_auth_id, 'client', 'Active'),
    (kam_auth_id, 'kam', 'Active'),
    (credit_auth_id, 'credit_team', 'Active'),
    (nbfc_auth_id, 'nbfc', 'Active')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO client_role_id;

  -- Get role IDs
  SELECT id INTO client_role_id FROM user_roles WHERE user_id = client_auth_id;
  SELECT id INTO kam_role_id FROM user_roles WHERE user_id = kam_auth_id;
  SELECT id INTO credit_role_id FROM user_roles WHERE user_id = credit_auth_id;
  SELECT id INTO nbfc_role_id FROM user_roles WHERE user_id = nbfc_auth_id;

  -- Create DSA Client profile
  INSERT INTO dsa_clients (
    user_id,
    company_name,
    contact_person,
    email,
    phone,
    kam_id,
    commission_rate,
    is_active
  )
  VALUES (
    client_role_id,
    'Test Corporation',
    'John Doe',
    'client@test.com',
    '+91 9876543210',
    kam_role_id,
    0.015,
    true
  )
  ON CONFLICT DO NOTHING;

  -- Create NBFC Partner profile
  INSERT INTO nbfc_partners (
    user_id,
    name,
    contact_person,
    email,
    phone,
    address_region,
    is_active
  )
  VALUES (
    nbfc_role_id,
    'Test NBFC Bank',
    'Jane Smith',
    'nbfc@test.com',
    '+91 9876543211',
    'Mumbai',
    true
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Test users created successfully!';
END $$;
```

### Option 2: Step-by-Step Setup

#### Step 1: Create Auth Users (Supabase Dashboard)

1. Go to: Supabase Dashboard → Authentication → Users
2. Click "Add user" (or "Invite user")
3. Create each user:

**Client User:**
- Email: `client@test.com`
- Password: `Test@123456`
- Confirm email: ✓ (check this)

**KAM User:**
- Email: `kam@test.com`
- Password: `Test@123456`
- Confirm email: ✓

**Credit User:**
- Email: `credit@test.com`
- Password: `Test@123456`
- Confirm email: ✓

**NBFC User:**
- Email: `nbfc@test.com`
- Password: `Test@123456`
- Confirm email: ✓

#### Step 2: Get User UUIDs

After creating auth users, copy their UUIDs from the Authentication → Users table.

#### Step 3: Create User Roles

```sql
-- Replace <uuid> with actual UUIDs from auth.users

-- Client role
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('<client-auth-uuid>', 'client', 'Active');

-- KAM role
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('<kam-auth-uuid>', 'kam', 'Active');

-- Credit Team role
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('<credit-auth-uuid>', 'credit_team', 'Active');

-- NBFC role
INSERT INTO user_roles (user_id, role, account_status)
VALUES ('<nbfc-auth-uuid>', 'nbfc', 'Active');
```

#### Step 4: Create Client Profile

```sql
-- Get the role IDs first
SELECT id, role FROM user_roles;

-- Then create DSA client profile
INSERT INTO dsa_clients (
  user_id,              -- Use role_id from above
  company_name,
  contact_person,
  email,
  phone,
  kam_id,              -- Use KAM role_id
  commission_rate,
  is_active
)
VALUES (
  '<client-role-id>',
  'Test Corporation',
  'John Doe',
  'client@test.com',
  '+91 9876543210',
  '<kam-role-id>',
  0.015,               -- 1.5% commission
  true
);
```

#### Step 5: Create NBFC Profile

```sql
INSERT INTO nbfc_partners (
  user_id,              -- Use NBFC role_id
  name,
  contact_person,
  email,
  phone,
  address_region,
  is_active
)
VALUES (
  '<nbfc-role-id>',
  'Test NBFC Bank',
  'Jane Smith',
  'nbfc@test.com',
  '+91 9876543211',
  'Mumbai',
  true
);
```

---

## 🧪 Testing Each Role

### As Client (DSA Partner):
1. Login: `client@test.com` / `Test@123456`
2. Expected to see:
   - Dashboard with stats
   - "New Application" button
   - Commission ledger
   - Own applications only

### As KAM:
1. Login: `kam@test.com` / `Test@123456`
2. Expected to see:
   - All applications from managed clients (Test Corporation)
   - Client management page
   - "Onboard Client" button
   - Can update application statuses

### As Credit Team:
1. Login: `credit@test.com` / `Test@123456`
2. Expected to see:
   - Global view of ALL applications
   - All clients list
   - Payout approval section
   - Can update any status

### As NBFC Partner:
1. Login: `nbfc@test.com` / `Test@123456`
2. Expected to see:
   - Applications assigned to Test NBFC Bank
   - Decision recording interface
   - Limited to assigned files only

---

## 📝 Creating Sample Data

After creating test users, add some sample data:

### Create a Test Application:

1. Login as Client (`client@test.com`)
2. Click "New Application"
3. Fill the form:
   - Applicant Name: Test Applicant
   - Loan Product: Home Loan
   - Loan Amount: ₹50,00,000
   - Submit

### Create Test Commission Entry:

```sql
-- Get client ID
SELECT id FROM dsa_clients WHERE email = 'client@test.com';

-- Create commission entry
INSERT INTO commission_ledger (
  client_id,
  transaction_type,
  amount,
  balance_after,
  description,
  status,
  date
)
VALUES (
  '<client-id>',
  'pay_out',
  50000,
  50000,
  'Commission for File #SF123456',
  'completed',
  CURRENT_DATE
);
```

### Raise a Test Query:

1. Login as KAM
2. Go to Applications
3. Click on an application
4. Click "Raise Query"
5. Enter query text and submit

---

## 🔍 Verification Checklist

After setup, verify:

- [ ] All 4 test users can login
- [ ] Each user sees role-appropriate dashboard
- [ ] Client can create new application
- [ ] KAM can see client applications
- [ ] Credit team sees all applications
- [ ] Commission ledger shows for client
- [ ] No permission errors in console
- [ ] Real-time updates work (open 2 browsers)

---

## 🚨 Troubleshooting

### "User not found" error:
- Check that user exists in auth.users
- Verify email is confirmed in auth dashboard

### "No role found" error:
- Check user_roles table has entry
- Verify role column matches: 'client', 'kam', 'credit_team', 'nbfc'

### "Permission denied" error:
- Check RLS policies are enabled
- Verify user_id FK links correctly

### Can't see data:
- Login as correct role
- Check client has kam_id set
- Verify RLS policies allow access

---

## 📋 Quick SQL Verification

```sql
-- Check all test users
SELECT
  ur.id as role_id,
  au.email,
  ur.role,
  ur.account_status
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email LIKE '%@test.com';

-- Check client profile
SELECT
  dc.*,
  ur_kam.role as kam_role
FROM dsa_clients dc
LEFT JOIN user_roles ur_kam ON dc.kam_id = ur_kam.id
WHERE dc.email = 'client@test.com';

-- Check NBFC profile
SELECT * FROM nbfc_partners
WHERE email = 'nbfc@test.com';

-- Check applications count
SELECT
  dc.company_name,
  COUNT(la.id) as app_count
FROM dsa_clients dc
LEFT JOIN loan_applications la ON dc.id = la.client_id
GROUP BY dc.company_name;
```

---

## 🎯 Common Test Scenarios

### Scenario 1: Full Application Workflow
1. Client creates application (draft)
2. Client submits → status: pending_kam_review
3. KAM reviews → status: forwarded_to_credit
4. Credit assigns to NBFC → status: sent_to_nbfc
5. NBFC approves → status: approved
6. Application disbursed → status: disbursed

### Scenario 2: Query Resolution
1. KAM raises query to client
2. Client responds
3. KAM marks as resolved

### Scenario 3: Commission Payout
1. Client requests payout
2. Credit team approves
3. Entry added to ledger

---

## 🔒 Security Notes

⚠️ **IMPORTANT:** These are test credentials only!

- Change passwords before production
- Delete test users in production
- Use strong passwords in real environment
- Enable 2FA for production users

---

## 📞 Need Help?

If test users aren't working:
1. Check Supabase logs for errors
2. Verify RLS policies in Database → Policies
3. Check browser console for API errors
4. Review QUICK_START.md for setup steps

---

**Status:** Ready for Testing
**Users Created:** 0/4 (Run SQL scripts above)
**Sample Data:** 0 applications (Create via UI after login)

---

*Last Updated: November 27, 2025*
