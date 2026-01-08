# API Documentation

## Base URL

- **Production**: `https://seven-dash.fly.dev/api`
- **Development**: `http://localhost:3001/api`

## Authentication

Most endpoints require JWT authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Or use HTTP-only cookies (automatically set on login).

## Endpoints

### Authentication

#### POST /auth/login
Login and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "kam",
    "name": "User Name"
  }
}
```

#### POST /auth/validate
Validate user credentials via n8n webhook.

**Request:**
```json
{
  "username": "username",
  "passcode": "passcode"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "kam",
    "name": "User Name"
  }
}
```

#### GET /auth/me
Get current user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "kam",
    "name": "User Name"
  }
}
```

#### POST /auth/refresh
Refresh JWT token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /auth/logout
Logout and invalidate token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Health & Metrics

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "uptime": 12345,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "server": { "status": "healthy" },
    "memory": { "status": "healthy", "message": "Heap used: 50MB / 200MB" },
    "n8n": { "status": "healthy", "latency": 150 }
  }
}
```

#### GET /uptime
Uptime monitoring endpoint (for external services).

**Response:**
```json
{
  "success": true,
  "status": "up",
  "responseTime": 50,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "message": "All systems operational"
}
```

#### GET /metrics
Prometheus-format metrics.

**Response:**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total 1234
...
```

#### GET /metrics/json
JSON-format metrics.

**Response:**
```json
{
  "success": true,
  "metrics": {
    "requests": {
      "total": 1234,
      "errors": 5,
      "successRate": "99.59%"
    },
    "performance": {
      "averageResponseTime": 150,
      "uptime": 86400
    }
  }
}
```

### Client Routes

#### GET /client/dashboard
Get client dashboard data.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalApplications": 10,
    "pendingApplications": 2,
    "approvedApplications": 5
  }
}
```

#### GET /client/form-config
Get form configuration for client.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "config": {
    "modules": [...],
    "categories": [...]
  }
}
```

#### GET /client/configured-products
Get list of configured product IDs for client.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "productIds": ["product-id-1", "product-id-2"]
}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message",
  "requestId": "req-1234567890-abc"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable (health check failed)

## Rate Limiting

Endpoints are rate-limited:

- **Auth endpoints**: 5 requests per 15 minutes
- **API endpoints**: 100 requests per 15 minutes
- **File upload**: 10 requests per hour

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets

## Role-Based Access Control

Different roles have access to different endpoints:

- **client**: Can only access their own data
- **kam**: Can access data for their managed clients
- **credit_team**: Can access all data
- **nbfc**: Can only access assigned files

## Request IDs

All requests include a `X-Request-ID` header for tracking. This ID is included in error responses and logs.
