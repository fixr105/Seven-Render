# React Error #321 Fix Documentation

## Problem

React error #321 occurs when hooks are called conditionally or in different orders between renders. The error "useAuth must be used within an AuthProvider" suggests that:

1. A component is trying to use auth before the provider is mounted
2. The provider structure is inconsistent between renders
3. The environment variable `VITE_USE_API_AUTH` might not be set correctly in production

## Solution Applied

### 1. Created UnifiedAuthProvider
- Created `src/contexts/UnifiedAuthProvider.tsx` to handle both auth types
- Ensures consistent component tree structure
- Environment variable evaluated at module load time

### 2. Updated App.tsx
- Simplified provider structure
- Always wraps with `BrowserRouter` first, then `UnifiedAuthProvider`
- Ensures routing context is available before auth context

### 3. Fixed useAuthSafe
- Suppressed console.warn in production builds
- Always returns safe defaults if no provider is available

## Environment Variable

**IMPORTANT**: Ensure `VITE_USE_API_AUTH` is set correctly in your Vercel environment variables:

- Set `VITE_USE_API_AUTH=true` (or leave unset, defaults to true) to use API auth
- Set `VITE_USE_API_AUTH=false` to use Supabase auth (legacy)

## Verification Steps

1. Check Vercel environment variables:
   - Go to Vercel dashboard → Project → Settings → Environment Variables
   - Ensure `VITE_USE_API_AUTH` is set (or defaults to true)

2. Rebuild and redeploy:
   ```bash
   npm run build
   # Deploy to Vercel
   ```

3. Test the application:
   - The error should no longer occur
   - Auth should work correctly based on the environment variable

## Additional Notes

- React versions are correct (18.3.1) - no duplicates
- All components use `useAuthSafe` (not `useAuth` directly)
- Provider structure is now consistent

If the error persists after setting the environment variable correctly, it may indicate:
- A component is being rendered outside the provider tree
- The environment variable is not being read correctly in production
- There's a timing issue with provider mounting

