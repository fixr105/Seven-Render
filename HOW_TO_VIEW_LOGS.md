# How to View Backend Console Logs

## Where to Find the Logs

### 1. Backend Server Terminal
The backend console logs appear in the **terminal window** where you started the backend server.

**To start the backend server:**
```bash
cd backend
npm run dev
```

**The logs will show:**
- `[createClient]` - When onboarding a client
- `[listClients]` - When fetching the client list
- `[postData]` - When calling n8n webhooks

### 2. What to Look For

#### When Onboarding a Client:
Look for logs starting with `[createClient]`:
```
[createClient] Creating client: { name, email, ... }
[createClient] Assigned KAM: "KAM_ID_HERE"
[createClient] Client record created successfully
[createClient] ✅ Client verified in database: Client Name, Assigned KAM: "KAM_ID"
```

#### When Viewing Client List:
Look for logs starting with `[listClients]`:
```
[listClients] KAM ID: "KAM_ID_HERE", User ID: "USER_ID"
[listClients] All clients in database:
  - Client Name (ID: client_id), Assigned KAM: "KAM_ID"
[listClients] ✅ MATCHED: Client Name (ID: client_id, Assigned KAM: "KAM_ID")
[listClients] ❌ NOT MATCHED: Client Name (Assigned KAM: "X" vs KAM ID: "Y")
```

### 3. Browser Console (Frontend Logs)

**To open browser console:**
- **Chrome/Edge**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
- **Firefox**: Press `F12` or `Cmd+Option+K` (Mac) / `Ctrl+Shift+K` (Windows)
- **Safari**: Enable Developer menu first, then `Cmd+Option+C`

**Look for logs starting with:**
- `[Clients]` - Frontend client list operations
- `NewApplication:` - Form configuration logs

### 4. Quick Check Commands

**Check if backend is running:**
```bash
# In a new terminal
curl http://localhost:3001/api/health
# Or check the process
ps aux | grep "tsx watch"
```

**View recent backend logs:**
If backend is running in background, check:
```bash
tail -f /tmp/backend-start.log
```

## What the Logs Tell You

1. **KAM ID Assignment**: Shows what KAM ID is being assigned to the new client
2. **KAM ID Filtering**: Shows what KAM ID is being used to filter clients
3. **Matching Logic**: Shows which clients match and which don't, with exact values

## Example Log Output

```
[createClient] Creating client: { name: "Test Client", email: "test@example.com" }
[createClient] Assigned KAM: "KAM-12345", KAM ID from user: "KAM-12345", User ID: "USER-67890"
[createClient] Client record created successfully
[createClient] ✅ Client verified in database: Test Client, Assigned KAM: "KAM-12345"

[listClients] KAM ID: "KAM-12345", User ID: "USER-67890"
[listClients] All clients in database:
  - Test Client (ID: CLIENT-123), Assigned KAM: "KAM-12345"
[listClients] ✅ MATCHED: Test Client (ID: CLIENT-123, Assigned KAM: "KAM-12345")
[listClients] Managed clients found: 1
```

## Troubleshooting

If you don't see logs:
1. Make sure backend server is running (`npm run dev` in backend folder)
2. Check the terminal window where you started the backend
3. Look for any error messages in red
4. Try restarting the backend server

