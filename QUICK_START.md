# Quick Start Guide

## 🚀 Start Both Servers

### Option 1: Start Backend First (Recommended)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Wait for: `🚀 Server running on port 3001`

**Terminal 2 - Frontend:**
```bash
npm run dev
```
Wait for: `Local: http://localhost:8000`

### Option 2: Check if Backend is Running

```bash
# Check if backend is running
lsof -ti:3001 && echo "✅ Backend is running" || echo "❌ Backend is NOT running"

# If not running, start it:
cd backend && npm run dev
```

## 🔍 Troubleshooting Network Errors

### Error: "NetworkError when attempting to fetch resource"

**Cause:** Backend server is not running

**Solution:**
1. Open a new terminal
2. Navigate to backend: `cd backend`
3. Start server: `npm run dev`
4. Wait for: `🚀 Server running on port 3001`
5. Refresh your browser

### Error: "Cannot connect to backend API"

**Check:**
- ✅ Backend server is running on port 3001
- ✅ Frontend is running on port 8000
- ✅ No firewall blocking localhost:3001
- ✅ Check browser console for CORS errors

### Verify Backend is Running

```bash
# Test backend health endpoint
curl http://localhost:3001/health

# Or test login endpoint
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"client@test.com","password":"Test@123"}'
```

## 📝 Environment Variables

Make sure `.env` file exists in project root:

```env
VITE_API_BASE_URL=http://localhost:3001
```

Or leave it empty to use Vite proxy (default: `/api`)

## ✅ Success Indicators

**Backend Running:**
- Terminal shows: `🚀 Server running on port 3001`
- `curl http://localhost:3001/health` returns success

**Frontend Running:**
- Browser opens to `http://localhost:8000`
- No console errors about network failures
- Login page loads correctly

## 🐛 Common Issues

1. **Port 3001 already in use:**
   ```bash
   # Kill process on port 3001
   lsof -ti:3001 | xargs kill -9
   ```

2. **Port 8000 already in use:**
   ```bash
   # Kill process on port 8000
   lsof -ti:8000 | xargs kill -9
   ```

3. **Module not found errors:**
   ```bash
   # Reinstall dependencies
   npm install
   cd backend && npm install
   ```

