# How to Update Node.js Version in Vercel Dashboard

## Step-by-Step Instructions

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Sign in if needed

2. **Select Your Project**
   - Find and click on **"seven-dashboard"** project

3. **Navigate to Settings**
   - Click on the **"Settings"** tab (top navigation)

4. **Go to General Settings**
   - In the left sidebar, click on **"General"**

5. **Find Node.js Version**
   - Scroll down to the **"Node.js Version"** section
   - You'll see a dropdown showing the current version (likely "24.x")

6. **Change the Version**
   - Click on the dropdown
   - Select **"20.x"** from the list (or the minimum available version)
   - **Note**: If only 20.x is available, that will work! Node.js 20.x is compatible with @vercel/node
   - Click **"Save"** (if there's a save button)

7. **Redeploy**
   - After saving, Vercel may automatically trigger a redeploy
   - If not, go to the **"Deployments"** tab
   - Click the **"..."** menu on the latest deployment
   - Click **"Redeploy"**

### Method 2: Via Vercel CLI (Alternative)

If you prefer using the command line:

```bash
# Link to your project (if not already linked)
vercel link

# Update Node.js version via project settings
# Note: This may require using the Vercel API or dashboard
```

**Note:** The CLI doesn't have a direct command to change Node.js version, so Method 1 (Dashboard) is recommended.

### Method 3: Via Vercel API (Advanced)

If you have API access:

```bash
# Get your project ID first
vercel project ls

# Then use the Vercel API to update
curl -X PATCH \
  "https://api.vercel.com/v9/projects/{project-id}" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nodeVersion": "18.x"}'
```

## Visual Guide

```
Vercel Dashboard
  └── seven-dashboard (Project)
      └── Settings Tab
          └── General (Left Sidebar)
              └── Node.js Version
                  └── Dropdown: Change from "24.x" to "20.x" (or minimum available)
                      └── Save
```

## After Updating

Once you've updated the Node.js version:

1. **Wait for the change to take effect** (usually instant)
2. **Redeploy your project**:
   ```bash
   cd /Users/rahulgonsalves/Downloads/7
   vercel --prod
   ```
3. **Verify the deployment**:
   - Check the deployment logs for "Using Node.js 20.x" (or 18.x)
   - Test your API endpoints

## Troubleshooting

### If you can't find the Node.js Version setting:
- Make sure you're in the **Settings** → **General** section
- Scroll down - it might be below other settings
- Check if you have the correct permissions (you need to be a project owner/admin)

### If the dropdown doesn't show 18.x:
- **Node.js 20.x will work perfectly!** It's compatible with @vercel/node
- If only 20.x is available, use that - it's actually better (newer version)
- The error was about 24.x being too new, but 20.x is in the supported range

### If deployment still fails:
- Check the deployment logs in Vercel
- Verify the Node.js version was actually saved
- Try redeploying again

## Quick Reference

- **Dashboard URL**: https://vercel.com/dashboard
- **Project Name**: seven-dashboard
- **Current Version**: 24.x (needs to be changed)
- **Target Version**: 20.x (or 18.x if available)
- **Why**: @vercel/node runtime requires Node.js 18.x or higher (20.x works perfectly)

