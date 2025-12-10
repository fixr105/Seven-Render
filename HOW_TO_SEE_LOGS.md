# How to See [Clients] Logs in Browser Console

## Step-by-Step Instructions:

### 1. Open Browser Console
- Press `F12` (or `Cmd+Option+I` on Mac)
- Click the **Console** tab

### 2. Filter Console Logs
In the console, you'll see a filter box. Type:
```
[Clients]
```

This will show ONLY logs that start with `[Clients]` and hide the source map errors.

### 3. Make Sure Log Level is Set Correctly
- Look for log level buttons (usually: Verbose, Info, Warnings, Errors)
- Make sure **Info** and **Verbose** are enabled (not just Errors)
- Or click "All levels" to see everything

### 4. Clear the Console
- Click the 🚫 icon (or press `Ctrl+L` / `Cmd+K`) to clear old logs
- This makes it easier to see new logs

### 5. Onboard a Client
1. Go to the Clients page
2. Click "Onboard Client"
3. Fill in the form:
   - Company Name: Test Company
   - Contact Person: Test Person
   - Email: test@example.com (use a unique email)
   - Phone: 1234567890
4. Click "Submit"

### 6. Watch the Console
You should see logs like:
```
[Clients] Client created successfully: {...}
[Clients] Created client email: test@example.com
[Clients] 🔄 Refreshing client list (attempt 1/5) after 1000ms
[Clients] 📥 Fetching clients, forceRefresh: true
[Clients] 📦 API response received: { success: true, dataLength: X }
[Clients] ✅ Mapped clients: X
[Clients] Client list: [...]
```

### 7. If You Still Don't See Logs
1. **Hard refresh the page**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Check if console is filtered**: Make sure the filter box doesn't have anything that would hide `[Clients]` logs
3. **Try onboarding again**: Sometimes the first load doesn't show logs

## What to Share
After onboarding, copy and paste ALL logs that start with `[Clients]` (not the source map errors).

