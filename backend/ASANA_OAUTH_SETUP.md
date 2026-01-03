# Asana OAuth Setup Guide

## OAuth Credentials Provided

- **Client ID**: `1212642476076052`
- **Client Secret**: `5ab9fe0e0ecf7d33b39d60b7abbfd252`

## Authentication Methods

Asana integration supports two authentication methods:

### Method 1: Personal Access Token (PAT) - **Recommended for Server-to-Server**

**Why use PAT?**
- ✅ Simpler setup (no OAuth flow)
- ✅ No user interaction required
- ✅ Perfect for server-to-server integration
- ✅ No token expiration (unless revoked)

**Setup:**
1. Go to https://app.asana.com/0/my-apps
2. Click "Create new token"
3. Give it a name (e.g., "Seven Fincorp Integration")
4. Copy the token

**Add to `.env`:**
```env
ASANA_PAT=your_personal_access_token_here
```

### Method 2: OAuth 2.0 - For User-Facing Applications

**When to use OAuth:**
- User-facing applications where users need to authorize
- When you need to act on behalf of specific users
- When you need refresh tokens

**Setup Steps:**

1. **Add OAuth credentials to `.env`:**
```env
ASANA_CLIENT_ID=1212642476076052
ASANA_CLIENT_SECRET=5ab9fe0e0ecf7d33b39d60b7abbfd252
ASANA_REDIRECT_URI=http://localhost:3001/auth/asana/callback
```

2. **Configure Redirect URI in Asana:**
   - Go to https://app.asana.com/0/my-apps
   - Find your app (Client ID: 1212642476076052)
   - Add redirect URI: `http://localhost:3001/auth/asana/callback`
   - For production: `https://yourdomain.com/auth/asana/callback`

3. **OAuth Flow** (if implementing user-facing OAuth):
   - User clicks "Connect Asana"
   - Redirect to Asana authorization
   - User authorizes
   - Receive authorization code
   - Exchange code for access token
   - Store access token

4. **Add access token to `.env`:**
```env
ASANA_OAUTH_ACCESS_TOKEN=your_oauth_access_token_here
```

## Current Implementation

The service currently uses **PAT (Personal Access Token)** method, which is recommended for server-to-server integration.

**Priority:**
1. `ASANA_PAT` (checked first)
2. `ASANA_OAUTH_ACCESS_TOKEN` (fallback)

## Quick Start (Recommended)

For server-to-server integration, use PAT:

```bash
# Get PAT from Asana
# Add to backend/.env
ASANA_PAT=your_personal_access_token_here

# Restart backend
npm run dev
```

## OAuth Credentials Storage

**Security Notes:**
- ✅ Client ID can be public (used in OAuth flow)
- ❌ Client Secret must be kept private (never commit to git)
- ❌ Access tokens must be kept private

**Current Storage:**
- Client ID: `1212642476076052` (can be in code/config)
- Client Secret: `5ab9fe0e0ecf7d33b39d60b7abbfd252` (should be in `.env` only)

## Environment Variables

### Required (choose one):
```env
# Option 1: Personal Access Token (Recommended)
ASANA_PAT=your_pat_token

# Option 2: OAuth Access Token
ASANA_OAUTH_ACCESS_TOKEN=your_oauth_token
```

### Optional (for OAuth flow):
```env
ASANA_CLIENT_ID=1212642476076052
ASANA_CLIENT_SECRET=5ab9fe0e0ecf7d33b39d60b7abbfd252
ASANA_REDIRECT_URI=http://localhost:3001/auth/asana/callback
```

## Testing

### Test with PAT:
```bash
# Set PAT in .env
ASANA_PAT=your_token

# Test task creation
curl -X POST https://app.asana.com/api/1.0/tasks \
  -H "Authorization: Bearer $ASANA_PAT" \
  -H "Content-Type: application/json" \
  -d '{"data": {"name": "Test", "projects": ["1211908004694493"]}}'
```

### Test with OAuth Token:
```bash
# Set OAuth token in .env
ASANA_OAUTH_ACCESS_TOKEN=your_token

# Same API call works
```

## Next Steps

1. **For Server-to-Server (Current Use Case)**: Use PAT
   - Get PAT from Asana
   - Add to `.env`: `ASANA_PAT=...`
   - Done!

2. **For User-Facing OAuth** (if needed later):
   - Implement OAuth flow endpoints
   - Store user tokens per user
   - Use user's token for their tasks

## Security Checklist

- [ ] Client Secret stored in `.env` (not committed)
- [ ] `.env` in `.gitignore`
- [ ] Access tokens never logged
- [ ] OAuth redirect URI configured in Asana app
- [ ] HTTPS for production redirect URI

