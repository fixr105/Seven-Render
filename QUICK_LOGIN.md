# 🚀 Quick Login Guide

## Fastest Way to Test the System

### Step 1: Create Auth Users (2 minutes)

Go to your Supabase Dashboard → Authentication → Users

Click "Add user" or "Invite user" and create these 4 users:

| Email | Password | Auto-confirm email? |
|-------|----------|---------------------|
| `client@test.com` | `Test@123456` | ✓ Yes |
| `kam@test.com` | `Test@123456` | ✓ Yes |
| `credit@test.com` | `Test@123456` | ✓ Yes |
| `nbfc@test.com` | `Test@123456` | ✓ Yes |

### Step 2: Get the User IDs

In the same page, you'll see a table with all users. Copy their UUIDs (the long ID like `abc123-def456-...`)

### Step 3: Run Setup Script

1. Go to Supabase Dashboard → SQL Editor
2. Open the file: `setup-test-users.sql`
3. **IMPORTANT:** Replace the placeholder UUIDs at the top with your actual user IDs:

```sql
-- Find this section at the top and replace:
client_auth_uuid uuid := 'PASTE-CLIENT-UUID-HERE';
kam_auth_uuid uuid := 'PASTE-KAM-UUID-HERE';
credit_auth_uuid uuid := 'PASTE-CREDIT-UUID-HERE';
nbfc_auth_uuid uuid := 'PASTE-NBFC-UUID-HERE';
```

4. Click "Run" button

### Step 4: Test Login! 🎉

Go to `http://localhost:5173` (or your app URL) and login with:

**Try as Client:**
```
Email: client@test.com
Password: Test@123456
```

You should see:
- Dashboard with stats
- "New Application" button
- Commission Ledger access

**Try as KAM:**
```
Email: kam@test.com
Password: Test@123456
```

You should see:
- Client Management page
- Applications from Test Corporation
- "Onboard Client" button

**Try as Credit Team:**
```
Email: credit@test.com
Password: Test@123456
```

You should see:
- Global view of ALL applications
- Payout approval section
- All clients list

**Try as NBFC:**
```
Email: nbfc@test.com
Password: Test@123456
```

You should see:
- Applications assigned to Test NBFC Bank
- Decision recording interface

---

## ⚡ Alternative: Manual Quick Setup

If you don't want to run SQL, follow these quick steps:

### 1. Create Auth Users (Same as above)

### 2. Create Roles Manually

Go to SQL Editor and run:

```sql
-- Get auth user IDs
SELECT id, email FROM auth.users WHERE email LIKE '%@test.com';

-- Create roles (replace UUIDs)
INSERT INTO user_roles (user_id, role) VALUES
  ('<client-auth-uuid>', 'client'),
  ('<kam-auth-uuid>', 'kam'),
  ('<credit-auth-uuid>', 'credit_team'),
  ('<nbfc-auth-uuid>', 'nbfc');
```

### 3. Create Client Profile

```sql
-- Get role IDs
SELECT id, role FROM user_roles;

-- Create client (replace IDs)
INSERT INTO dsa_clients (user_id, company_name, contact_person, email, phone, kam_id)
VALUES (
  '<client-role-id>',
  'Test Corp',
  'John Doe',
  'client@test.com',
  '9876543210',
  '<kam-role-id>'
);
```

### 4. Done! Login and Test

---

## 🐛 Troubleshooting

### "Invalid login credentials"
- Check you used exact email: `client@test.com` (not `test@client.com`)
- Check password: `Test@123456` (capital T, @ symbol, 123456)
- Verify email is confirmed in Auth dashboard

### "User not found" after login
- Check user_roles table has an entry
- Verify the user_id matches auth.users.id
- Run: `SELECT * FROM user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'client@test.com');`

### "Permission denied" errors
- Check RLS policies are enabled
- Verify role is exactly: 'client', 'kam', 'credit_team', or 'nbfc'
- Check browser console for specific error

### Can't see any data
- For clients: need dsa_clients profile created
- For KAM: need at least one client with kam_id set
- For NBFC: need nbfc_partners profile created
- Run verification queries from TEST_USERS.md

---

## 📝 What You'll See After Login

### Client Dashboard:
- Stats: Total Applications, Pending, Approved
- Commission Balance
- Recent Applications table
- "New Application" button

### KAM Dashboard:
- Managed clients' applications
- Client list with stats
- "Onboard Client" button
- Update status options

### Credit Team Dashboard:
- ALL applications across all clients
- Payout requests section
- Client management
- Status update capabilities

### NBFC Dashboard:
- Applications assigned to your NBFC
- Decision recording fields
- Document download access

---

## 🎯 Quick Test Workflow

1. **Login as Client** → Create a new application
2. **Login as KAM** → View the application, update status to "Forwarded to Credit"
3. **Login as Credit** → View application, assign to NBFC
4. **Login as NBFC** → Record decision (Approve/Reject)

---

## 💡 Tips

- Use Chrome DevTools to debug
- Check Network tab for API calls
- Console will show any RLS errors
- Open 2 browsers to test real-time sync
- Test on mobile by changing browser size

---

**Need the full documentation?** See TEST_USERS.md

**Having issues?** Check QUICK_START.md for detailed setup

---

**All test credentials use the same password: `Test@123456`**
