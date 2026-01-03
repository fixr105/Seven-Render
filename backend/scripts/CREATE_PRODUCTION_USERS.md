# Create Production Users Script

This script creates production users in Airtable via n8n webhooks.

## Users Created

The script creates the following users:

1. **KAM Users:**
   - Sagar (username: `Sagar`, password: `pass@123`)
   - Jaishali (username: `Jaishali`, password: `pass@123`)
   - Archi (username: `Archi`, password: `pass@123`)

2. **Credit Team Users:**
   - Basavaraj (username: `Basavaraj`, password: `pass@123`)
   - Rahul (username: `Rahul`, password: `pass@123`)

## What the Script Does

1. **Creates User Accounts** in the `User Accounts` table via `/webhook/adduser`
   - Username: As specified
   - Password: `pass@123`
   - Role: `kam` or `credit_team`
   - Associated Profile: User's name
   - Email and Phone: Left blank (as requested)
   - Status: `Active`

2. **Creates Profile Records:**
   - **KAM Users**: Creates entries in `KAM Users` table via `/webhook/KAMusers`
     - Name: User's name
     - Email: User's name (same as Name)
     - Role: `kam`
     - Status: `Active`
   
   - **Credit Team Users**: Creates entries in `Credit Team Users` table via `/webhook/CREDITTEAMUSERS`
     - Name: User's name
     - Email: User's name (same as Name)
     - Role: `credit_team`
     - Status: `Active`

3. **Verifies Creations:**
   - Calls GET endpoints to verify each user account exists
   - Verifies profile records exist
   - Checks that roles and statuses are correct

## Usage

### Option 1: Using npm script (Recommended)

```bash
cd backend
npm run create:users
```

### Option 2: Direct execution

```bash
cd backend
node scripts/create-production-users.js
```

## Environment Variables

The script uses the following environment variables (from `.env` file):

- `N8N_BASE_URL`: Base URL for n8n webhooks (default: `https://fixrrahul.app.n8n.cloud`)

## Output

The script provides detailed logging:

- ✅ Success messages for each created user and profile
- ❌ Error messages if creation fails
- 🔍 Verification results showing which users were found
- 📊 Summary at the end with:
  - Count of successfully created users
  - Count of failed creations
  - Verification results

## Example Output

```
🚀 Starting production user creation script...

📡 Using n8n base URL: https://fixrrahul.app.n8n.cloud

📋 Users to create: 5

============================================================
Processing: Sagar (kam)
============================================================

📝 Creating user account: Sagar (kam)...
   ✅ Created user account: Sagar

📝 Creating KAM profile: Sagar...
   ✅ Created KAM profile: Sagar

...

============================================================
VERIFICATION PHASE
============================================================

🔍 Verifying user account: Sagar...
   ✅ Found user account: Sagar
   Role: kam
   Status: Active

...

============================================================
SUMMARY
============================================================

✅ Successfully created: 5 users
   - Sagar (kam)
   - Jaishali (kam)
   - Archi (kam)
   - Basavaraj (credit_team)
   - Rahul (credit_team)

🔍 Verification Results:
   ✅ Verified: 5 users
      - Sagar (kam)
      - Jaishali (kam)
      - Archi (kam)
      - Basavaraj (credit_team)
      - Rahul (credit_team)

✅ All users created and verified successfully!
```

## Error Handling

The script handles errors gracefully:

- If a user account creation fails, it logs the error and continues with the next user
- If a profile creation fails, it logs the error but the user account may still exist
- Verification failures are reported in the summary
- Exit code 1 is returned if any operations fail
- Exit code 0 is returned if all operations succeed

## Notes

- The script includes delays between requests to avoid rate limiting
- All HTTP responses are logged for debugging
- The script uses the exact field names required by the n8n webhooks
- Passwords are sent as plaintext (n8n/Airtable handles hashing if needed)

## Troubleshooting

If the script fails:

1. **Check n8n webhook URLs**: Verify that the webhooks are accessible
2. **Check network connectivity**: Ensure you can reach the n8n instance
3. **Check Airtable permissions**: Verify the n8n workflows have permission to create records
4. **Review error messages**: The script logs detailed error information
5. **Check for duplicate users**: If a user already exists, the creation may fail

## Modifying Users

To modify the list of users, edit the `users` array in `create-production-users.js`:

```javascript
const users = [
  { username: "NewUser", password: "pass@123", role: "kam", associatedProfile: "NewUser", status: "Active" },
  // Add more users...
];
```

