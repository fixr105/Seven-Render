# 🚀 Quick Start - Create Login Account

## You're seeing "Invalid login credentials" because no user exists yet!

Follow these 3 simple steps to create your first login account:

---

## Step 1️⃣: Open Supabase Dashboard

1. Go to your **Supabase Project Dashboard**
2. Click **"Authentication"** in the left sidebar
3. Click **"Users"** tab

You should see an empty users table.

---

## Step 2️⃣: Create a New User

1. Click the **"Add user"** button (top right)
2. A form will appear. Fill it in:

   ```
   📧 Email: client@demo.com
   🔑 Password: Demo@123456
   ```

3. **✅ VERY IMPORTANT:**
   - Scroll down and find **"Auto Confirm User"** checkbox
   - **CHECK THIS BOX** ✅
   - This is critical! Without this, the email won't be confirmed and login will fail

4. Click **"Create user"** button

5. You should now see the user in the table. **Copy the UUID** (looks like: `a1b2c3d4-e5f6-7890-1234-567890abcdef`)

---

## Step 3️⃣: Setup User Profile

1. In Supabase Dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Paste this SQL (replace `YOUR_USER_ID` with the UUID you copied):

   ```sql
   SELECT setup_test_client('client@demo.com', 'YOUR_USER_ID'::uuid);
   ```

   **Example:**
   ```sql
   SELECT setup_test_client('client@demo.com', 'a1b2c3d4-e5f6-7890-1234-567890abcdef'::uuid);
   ```

4. Click **"Run"** (or press Ctrl+Enter)

5. You should see a success message:
   ```json
   {
     "success": true,
     "role_id": "...",
     "client_id": "...",
     "message": "Client setup complete! You can now login.",
     "email": "client@demo.com"
   }
   ```

---

## Step 4️⃣: Login! 🎉

1. Go back to your app: `http://localhost:5173`
2. You'll see the login page with a **blue demo box**
3. Click **"Auto-fill demo credentials"** button
4. Click **"Sign In"**

**✅ Success! You should now see the Client Dashboard!**

---

## 🎯 What You Should See After Login

**Dashboard Features:**
- 📊 Stats cards: Total Applications, Pending, Approved
- 💰 Commission Balance card
- 📋 Recent Applications table
- ➕ "New Application" button (top right)
- 📱 Full navigation sidebar with:
  - Dashboard
  - Applications
  - Clients
  - Ledger

---

## 🐛 Troubleshooting

### Still getting "Invalid login credentials"?

**Check 1: Email Confirmed?**
```sql
SELECT email, email_confirmed_at FROM auth.users WHERE email = 'client@demo.com';
```
- If `email_confirmed_at` is NULL, you forgot to check "Auto Confirm User"
- Solution: Delete the user and recreate with the checkbox checked

**Check 2: Correct Password?**
- Password is: `Demo@123456`
- Note: Capital `D`, `@` symbol, numbers
- Try copy-pasting it exactly

**Check 3: User Profile Created?**
```sql
SELECT * FROM user_roles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'client@demo.com'
);
```
- Should return 1 row with role = 'client'
- If empty, run the `setup_test_client` function again

**Check 4: Client Profile Exists?**
```sql
SELECT dc.* FROM dsa_clients dc
JOIN user_roles ur ON dc.user_id = ur.id
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'client@demo.com';
```
- Should return 1 row with company_name = 'Demo Client Corp'
- If empty, run the `setup_test_client` function again

### User logged in but shows "User not found"?

This means auth worked but the profile is missing:

1. Get the auth user ID:
   ```sql
   SELECT id FROM auth.users WHERE email = 'client@demo.com';
   ```

2. Run setup again with that ID:
   ```sql
   SELECT setup_test_client('client@demo.com', 'THE_ID_FROM_ABOVE'::uuid);
   ```

### Can't see the SQL Editor or Authentication pages?

- Make sure you're logged into the correct Supabase project
- Check your project URL in `.env` file matches the dashboard

---

## 📋 Complete Verification Checklist

Run these queries to verify everything is set up correctly:

```sql
-- 1. Auth user exists and is confirmed
SELECT
  id,
  email,
  email_confirmed_at,
  CASE
    WHEN email_confirmed_at IS NULL THEN '❌ NOT CONFIRMED'
    ELSE '✅ CONFIRMED'
  END as status
FROM auth.users
WHERE email = 'client@demo.com';

-- 2. User role exists
SELECT
  ur.role,
  ur.account_status,
  '✅ Role assigned' as status
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'client@demo.com';

-- 3. Client profile exists
SELECT
  dc.company_name,
  dc.email,
  dc.commission_rate,
  dc.is_active,
  '✅ Client profile created' as status
FROM dsa_clients dc
JOIN user_roles ur ON dc.user_id = ur.id
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'client@demo.com';
```

**All three queries should return results with ✅**

---

## 🎓 Understanding the Setup

**What did we just do?**

1. **Created Auth User** (Step 2)
   - This is stored in `auth.users` table (Supabase built-in)
   - Handles login/password authentication

2. **Created User Role** (Step 3, via function)
   - Stored in `user_roles` table
   - Links auth user to application role ('client')

3. **Created Client Profile** (Step 3, via function)
   - Stored in `dsa_clients` table
   - Contains business info (company name, commission rate, etc.)

**The relationship:**
```
auth.users (Supabase)
    ↓ (linked by user_id)
user_roles (our table)
    ↓ (linked by user_id)
dsa_clients (our table)
```

---

## 🔐 Security Notes

**Why not create directly in SQL?**
- Supabase Auth handles password hashing securely
- Can't create users directly via SQL for security reasons
- Must use Supabase Dashboard or Auth API

**Production Setup:**
- Change password from `Demo@123456` to something stronger
- Enable email confirmation (uncheck auto-confirm)
- Set up email templates
- Enable 2FA

---

## 🎯 Next Steps After Login

1. **Create Your First Application**
   - Click "New Application" button
   - Fill in the loan application form
   - Submit

2. **Explore the Dashboard**
   - Check out stats cards
   - View commission ledger
   - Browse applications list

3. **Test Real-time Features**
   - Open app in 2 browser tabs
   - Create an application in one
   - Watch it appear in the other

4. **Create More Test Users**
   - Follow same steps for KAM, Credit, NBFC roles
   - See SETUP_LOGIN.md for other roles

---

## 🆘 Still Having Issues?

**Check Browser Console:**
1. Press F12 to open DevTools
2. Go to "Console" tab
3. Try logging in
4. Look for red error messages
5. Share the error message for specific help

**Check Network Tab:**
1. Press F12 to open DevTools
2. Go to "Network" tab
3. Try logging in
4. Look for failed requests (red)
5. Click on them to see details

**Check Environment Variables:**
```bash
# Make sure .env file has correct values
cat .env
```

Should contain:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📞 Quick Reference

**Login Credentials:**
```
Email: client@demo.com
Password: Demo@123456
```

**Supabase Dashboard Locations:**
- Users: Authentication → Users
- SQL: SQL Editor → New query
- Tables: Database → Tables

**Key SQL Function:**
```sql
SELECT setup_test_client('client@demo.com', 'USER_UUID'::uuid);
```

---

**🎉 That's it! You should now be able to login successfully!**

If you followed all steps and it still doesn't work, check the troubleshooting section above or open browser DevTools to see the specific error.
