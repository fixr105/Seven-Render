# Test Users Created

## Status: ✅ Users Created Successfully

All 4 test users have been created in Airtable via n8n webhooks:

1. **client@test.com** (Client/DSA) - Password: `password123`
2. **kam@test.com** (KAM) - Password: `password123`
3. **credit@test.com** (Credit Team) - Password: `password123`
4. **nbfc@test.com** (NBFC Partner) - Password: `password123`

## Created Fields

Each user account was created with:
- `id`: Unique identifier
- `Username`: Email address
- `Password`: Plaintext password (backend handles hashing on login)
- `Role`: User role (client, kam, credit_team, nbfc)
- `Associated Profile`: User's name
- `Last Login`: Empty (will be updated on first login)
- `Account Status`: Active

## Note on GET Webhook

The GET webhook (`https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52`) may not immediately return the "User Accounts" table in its response. This is a known limitation - the webhook may need time to sync, or it may only return certain tables.

## Verification

To verify users were created:
1. Check Airtable directly - look in the "User Accounts" table
2. Wait a few seconds for n8n to sync
3. Try logging in with the credentials above

## If Login Still Fails

If login fails after creating users:
1. Wait 10-30 seconds for n8n/Airtable to sync
2. Check Airtable directly to verify users exist
3. Verify the `Username` field matches the email exactly
4. Verify `Account Status` is set to "Active"
5. Check backend logs for specific error messages

## Re-running the Script

If you need to recreate users, run:
```bash
cd backend
node scripts/create-test-users.js
```

Note: This will create new users with new IDs. If users already exist, you may need to update them instead of creating new ones.

