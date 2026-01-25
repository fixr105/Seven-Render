# Login Instructions

## Current Issue
You're seeing "No token provided" errors because you're not logged in. The token is missing from localStorage.

## Solution: Log In First

1. **Go to the Login Page**: Navigate to `http://localhost:3000/login` (or just `/login`)

2. **Enter credentials**: Use **Sagar@gmail.com** / **pass@123** for all roles.
   - **Client**, **KAM**, **Credit Team**, **NBFC** — same login; role is determined by your User Account in Airtable.

3. **After Login**: You'll be redirected to the dashboard and the token will be stored in localStorage.

## Why This Happens
- The app uses test tokens for development
- These tokens are stored in localStorage
- If you refresh the page or the token expires, you need to log in again
- The token format is: `test-token-{role}@{timestamp}`

## After Logging In
Once logged in as KAM, you should be able to:
- View clients
- Onboard new clients
- Configure form settings

The token will persist until you:
- Clear browser storage
- Log out
- Refresh after a long time
