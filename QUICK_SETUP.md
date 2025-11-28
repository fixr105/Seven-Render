# 🚀 Quick Setup - Dummy Users & Localhost

## Summary

This guide will help you:
1. ✅ Create 4 dummy test users
2. ✅ Start the localhost development server
3. ✅ Test the system

---

## Step 1: Environment Setup (2 minutes)

### Create `.env` file

Create a file named `.env` in the project root with:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Get these values from:**
- Supabase Dashboard → Settings → API
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **anon/public key** → `VITE_SUPABASE_ANON_KEY`

---

## Step 2: Create Dummy Users (5 minutes)

### Method: SQL Script (Recommended)

1. **Create Auth Users in Supabase Dashboard:**
   - Go to: Supabase Dashboard → Authentication → Users
   - Click "Add user" 4 times and create:

| Email | Password | Auto-Confirm Email |
|-------|----------|-------------------|
| `client@test.com` | `Test@123456` | ✅ Yes |
| `kam@test.com` | `Test@123456` | ✅ Yes |
| `credit@test.com` | `Test@123456` | ✅ Yes |
| `nbfc@test.com` | `Test@123456` | ✅ Yes |

2. **Get User UUIDs:**
   - Run in SQL Editor:
   ```sql
   SELECT id, email FROM auth.users WHERE email LIKE '%@test.com';
   ```
   - Copy all 4 UUIDs

3. **Run Setup SQL:**
   - Open: `scripts/setup-users.sql`
   - Replace placeholder UUIDs at the top with your actual UUIDs
   - Run in SQL Editor

4. **Verify:**
   ```sql
   SELECT ur.role, au.email FROM user_roles ur
   JOIN auth.users au ON ur.user_id = au.id
   WHERE au.email LIKE '%@test.com';
   ```

**Detailed instructions:** See `scripts/setup-users-guide.md`

---

## Step 3: Start Localhost Server

```bash
npm run dev
```

The app will start at: **http://localhost:5173**

---

## Step 4: Test Login

### Test User Credentials

| Role | Email | Password |
|------|-------|----------|
| **Client** | `client@test.com` | `Test@123456` |
| **KAM** | `kam@test.com` | `Test@123456` |
| **Credit** | `credit@test.com` | `Test@123456` |
| **NBFC** | `nbfc@test.com` | `Test@123456` |

### What Each Role Can Do

**Client (DSA Partner):**
- Create loan applications
- View commission ledger
- Raise queries
- Track application status

**KAM (Key Account Manager):**
- Manage clients
- Review applications
- Update status
- Onboard new clients

**Credit Team:**
- View all applications
- Approve/reject payouts
- Update any status
- Manage clients globally

**NBFC Partner:**
- Review assigned applications
- Make approval/rejection decisions
- Record lender decisions

---

## Verification Checklist

After setup, verify:

- [ ] All 4 users can login
- [ ] Client dashboard shows stats
- [ ] KAM can see client management
- [ ] Credit team sees all applications
- [ ] No console errors
- [ ] Real-time updates work

---

## Troubleshooting

### "Invalid login credentials"
- ✅ Check "Auto Confirm Email" was checked when creating users
- ✅ Verify email/password spelling
- ✅ Check user exists in `auth.users` table

### "User not found" after login
- ✅ Run the SQL setup script (`scripts/setup-users.sql`)
- ✅ Check `user_roles` table has entries

### Environment variables not loading
- ✅ `.env` file in project root
- ✅ Variable names start with `VITE_`
- ✅ Restart dev server after changing `.env`

### Port 5173 already in use
```bash
npm run dev -- --port 3000
```

---

## Files Created

1. **`scripts/setup-users.sql`** - Complete SQL setup script
2. **`scripts/setup-users-guide.md`** - Step-by-step guide
3. **`scripts/setup-dummy-users.js`** - Automated Node.js script (optional)
4. **`SETUP_LOCALHOST.md`** - Detailed setup documentation

---

## Next Steps

1. ✅ Test login with all roles
2. ✅ Create a test application (as client)
3. ✅ Test status updates (as KAM)
4. ✅ Test query system
5. ✅ Check commission ledger

---

## Quick Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck

# Preview production build
npm run preview
```

---

**🎉 You're all set! The system is ready for testing on localhost.**
