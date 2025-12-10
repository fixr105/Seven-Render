# How to Find Backend Console Logs

## Quick Steps:

### 1. Find the Terminal Running the Backend

**On Mac:**
- Look for a terminal window that shows: `🚀 Server running on port 3001`
- Or press `Cmd + Tab` to cycle through open windows and find the terminal

**If you can't find it:**
1. Open a **new terminal window**
2. Run this command to find the backend process:
   ```bash
   ps aux | grep "tsx watch" | grep -v grep
   ```
3. You'll see something like:
   ```
   rahulgonsalves  12345  ...  node .../tsx watch src/server.ts
   ```

### 2. Start the Backend (if not running)

If the backend isn't running, open a terminal and run:

```bash
cd "/Users/rahulgonsalves/Downloads/7 git/Seven-Dashboard/backend"
npm run dev
```

You should see:
```
🚀 Server running on port 3001
📡 Environment: development
```

### 3. What to Look For in Backend Logs

When you onboard a client, you should see logs like:

```
[createClient] Creating client record: CLIENT-123
[createClient] Assigned KAM: "KAM-456"
[createClient] Client record created successfully
[listClients] KAM ID: "KAM-456", User ID: "USER-789"
[listClients] All clients in database:
  - Client Name (ID: CLIENT-123), Assigned KAM: "KAM-456"
[listClients] ✅ MATCHED: Client Name (Assigned KAM: "KAM-456")
```

### 4. Check Browser Console Too

1. Open your browser
2. Press `F12` (or `Cmd+Option+I` on Mac)
3. Click the **Console** tab
4. Look for logs starting with `[Clients]`

You should see:
```
[Clients] 📥 Fetching clients, forceRefresh: true
[Clients] 📦 API response received: { success: true, dataLength: 5 }
[Clients] ✅ Mapped clients: 5
```

## Still Can't Find It?

Run this command in a new terminal to see recent backend activity:

```bash
tail -f /tmp/backend-start.log 2>/dev/null || echo "Backend log file not found. Make sure backend is running with 'npm run dev'"
```

