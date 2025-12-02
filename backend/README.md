# Seven Fincorp Backend API

TypeScript Node.js backend API for Seven Fincorp Loan Management & Credit Dashboard.

## Architecture

- **Framework**: Express.js
- **Language**: TypeScript
- **Data Layer**: Airtable (via n8n webhooks)
- **Authentication**: JWT
- **Authorization**: Role-Based Access Control (RBAC)

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
- `JWT_SECRET`: Secret key for JWT tokens
- `N8N_GET_WEBHOOK_URL`: n8n GET webhook URL
- `N8N_POST_*_URL`: n8n POST webhook URLs

4. Run development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user info

### Client (DSA) Routes
- `GET /client/dashboard` - Client dashboard overview
- `GET /client/form-config` - Get form configuration for client

### Loan Applications
- `POST /loan-applications` - Create draft application (CLIENT)
- `GET /loan-applications` - List applications (filtered by role)
- `GET /loan-applications/:id` - Get single application
- `POST /loan-applications/:id/submit` - Submit application (CLIENT)

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── types/            # TypeScript type definitions
│   ├── services/         # Business logic services
│   │   ├── airtable/    # n8n/Airtable integration
│   │   └── auth/        # Authentication service
│   ├── controllers/     # Route controllers
│   ├── middleware/       # Express middleware
│   ├── routes/           # Route definitions
│   ├── utils/            # Utility functions
│   └── server.ts         # Express app entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## Role-Based Access Control

- **CLIENT**: Can only access their own data
- **KAM**: Can access data for their managed clients
- **CREDIT**: Can access all data
- **NBFC**: Can only access assigned files

## Development

The backend uses:
- `tsx` for running TypeScript directly in development
- `express` for HTTP server
- `jsonwebtoken` for JWT authentication
- `bcryptjs` for password hashing
- `zod` for request validation
- `node-fetch` for HTTP requests to n8n

## Environment Variables

See `.env.example` for all required environment variables.

