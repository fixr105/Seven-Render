# Login Troubleshooting Guide

## Common Issues and Solutions

### 1. "Invalid email or password" Error

**Possible Causes:**
- Test users don't exist in Airtable
- Backend API is not running
- Backend API URL is incorrect
- Password doesn't match

**Solutions:**

#### Check Backend API Status
1. Ensure backend is running:
   ```bash
   cd backend
   npm run dev
   ```
2. Check if API is accessible at: `http://localhost:3000/health`

#### Create Test Users in Airtable
The backend looks for users in the "User Accounts" table with:
- `Username` field = email (e.g., `client@test.com`)
- `Password` field = password (can be plaintext or hashed)
- `Role` field = role (e.g., `client`, `kam`, `credit_team`, `nbfc`)
- `Account Status` = `Active`

**Required Test Users:**
1. **Client (DSA)**
   - Username: `client@test.com`
   - Password: `password123`
   - Role: `client`
   - Account Status: `Active`

2. **KAM**
   - Username: `kam@test.com`
   - Password: `password123`
   - Role: `kam`
   - Account Status: `Active`

3. **Credit Team**
   - Username: `credit@test.com`
   - Password: `password123`
   - Role: `credit_team`
   - Account Status: `Active`

4. **NBFC**
   - Username: `nbfc@test.com`
   - Password: `password123`
   - Role: `nbfc`
   - Account Status: `Active`

#### Check Environment Variables
Ensure `VITE_API_BASE_URL` is set correctly:
- Local: `http://localhost:3000`
- Production: Your deployed backend URL

### 2. "Cannot connect to backend API" Error

**Possible Causes:**
- Backend server is not running
- Wrong API URL
- CORS issues
- Network connectivity

**Solutions:**
1. Start the backend server
2. Check browser console for CORS errors
3. Verify `VITE_API_BASE_URL` in environment variables
4. Check backend logs for errors

### 3. Backend API Not Found (404)

**Possible Causes:**
- Backend routes not configured
- Wrong endpoint path
- Backend not deployed

**Solutions:**
1. Check backend routes in `backend/src/routes/auth.routes.ts`
2. Verify backend is running and accessible
3. Test endpoint: `POST http://localhost:3000/auth/login`

## Quick Test

1. **Test Backend Health:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Test Login Endpoint:**
   ```bash
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"client@test.com","password":"password123"}'
   ```

3. **Check Browser Console:**
   - Open browser DevTools
   - Check Network tab for failed requests
   - Check Console for error messages

## Creating Test Users via Backend

If test users don't exist, you can create them using the backend API:

1. **Create User Account:**
   ```bash
   POST /kam/users
   {
     "name": "Test Client",
     "email": "client@test.com",
     "password": "password123",
     "role": "client"
   }
   ```

2. **Or use the KAM interface** to create clients with the test credentials

## Alternative: Use Supabase Auth (Legacy)

If backend API is not available, you can temporarily use Supabase:
1. Set `VITE_USE_API_AUTH=false` in environment variables
2. Ensure Supabase credentials are configured
3. Create users in Supabase


