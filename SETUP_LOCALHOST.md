# 🚀 Setup Dummy Users & Run on Localhost

This guide helps you quickly set up dummy test users and run the application on localhost.

## Prerequisites

1. Node.js installed (v18+)
2. Supabase project set up
3. Environment variables configured

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**To get these values:**
1. Go to your Supabase Dashboard
2. Click **Settings** → **API**
3. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

---

## Step 3: Create Test Users

### Option A: Manual Setup (Recommended)

1. **Go to Supabase Dashboard** → **Authentication** → **Users**
2. **Create 4 users** (click "Add user" for each):

| Email | Password | Auto-Confirm Email? |
|-------|----------|---------------------|
| `client@test.com` | `Test@123456` | ✅ Yes |
| `kam@test.com` | `Test@123456` | ✅ Yes |
| `credit@test.com` | `Test@123456` | ✅ Yes |
| `nbfc@test.com` | `Test@123456` | ✅ Yes |

3. **Copy the UUID** of each user from the users table
4. **Go to SQL Editor** → **New query**
5. **Copy and paste** the SQL from `scripts/setup-users.sql`
6. **Replace the placeholder UUIDs** at the top with your actual UUIDs
7. **Click "Run"**

### Option B: Automated Setup (Requires Service Role Key)

If you have the Supabase Service Role Key:

1. Add to `.env`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. Run the setup script:
   ```bash
   node scripts/setup-dummy-users.js
   ```

---

## Step 4: Start the Development Server

```bash
npm run dev
```

The app will start at: **http://localhost:5173**

---

## Step 5: Login and Test

### Test User Credentials

**Client (DSA Partner):**
- Email: `client@test.com`
- Password: `Test@123456`
- Can: Create applications, view ledger, raise queries

**KAM (Key Account Manager):**
- Email: `kam@test.com`
- Password: `Test@123456`
- Can: Manage clients, review applications, update status

**Credit Team:**
- Email: `credit@test.com`
- Password: `Test@123456`
- Can: View all applications, approve payouts, manage clients

**NBFC Partner:**
- Email: `nbfc@test.com`
- Password: `Test@123456`
- Can: Review assigned applications, make decisions

---

## Verification Checklist

After setup, verify everything works:

- [ ] All 4 users can login successfully
- [ ] Client sees dashboard with stats
- [ ] KAM sees client management page
- [ ] Credit team sees all applications
- [ ] No console errors in browser
- [ ] Real-time updates work (open 2 browser windows)

---

## Troubleshooting

### "Invalid login credentials"
- Make sure you checked "Auto Confirm Email" when creating users
- Verify email and password are correct
- Check user exists in `auth.users` table

### "User not found" after login
- Run the SQL setup script to create user roles
- Check `user_roles` table has entries for your users

### Environment variables not loading
- Make sure `.env` file is in project root
- Restart the dev server after changing `.env`
- Check variable names start with `VITE_`

### Port already in use
- Change port: `npm run dev -- --port 3000`
- Or kill the process using port 5173

---

## Quick Reference

**Start server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

**Type check:**
```bash
npm run typecheck
```

---

## Next Steps

1. ✅ Test login with all roles
2. ✅ Create a test application (as client)
3. ✅ Update application status (as KAM)
4. ✅ Test query system
5. ✅ Check commission ledger

---

**Need help?** Check the console logs or Supabase Dashboard for error details.
