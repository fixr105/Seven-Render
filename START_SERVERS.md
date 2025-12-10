# How to Start the Servers

## Quick Start

### Terminal 1 - Frontend (Port 3000)
```bash
cd "/Users/rahulgonsalves/Downloads/7 git/Seven-Dashboard"
npm run dev
```
Frontend will start on: **http://localhost:3000**

### Terminal 2 - Backend (Port 3001)
```bash
cd "/Users/rahulgonsalves/Downloads/7 git/Seven-Dashboard/backend"
npm run dev
```
Backend will start on: **http://localhost:3001**

## Verify Servers Are Running

### Check Frontend
```bash
curl http://localhost:3000
```
Should return HTML content.

### Check Backend
```bash
curl http://localhost:3001/health
```
Should return: `{"success":true,"message":"API is running"}`

## Troubleshooting

### Backend Not Starting?
1. Check if port 3001 is already in use:
   ```bash
   lsof -i:3001
   ```
2. If something is using port 3001, kill it or change the port in `backend/src/server.ts`

### Frontend Can't Connect to Backend?
1. Make sure backend is running on port 3001
2. Check `.env` file has: `VITE_API_BASE_URL=http://localhost:3001`
3. Restart frontend after changing `.env`

## Port Configuration

- **Frontend**: Port 3000 (Vite dev server)
- **Backend**: Port 3001 (Express API server)
- **API URL**: http://localhost:3001

