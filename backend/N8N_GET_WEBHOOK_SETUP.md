# n8n GET Webhook Setup Guide

## Problem

The workflow you showed is configured for **POST** operations (upsert), but the backend needs **GET** webhooks to fetch data.

## GET vs POST Webhooks

### POST Webhook (What you showed)
- **Purpose**: Create or update records
- **Method**: POST
- **Nodes**: Webhook → Create/Update Record → Respond
- **Used for**: Creating/updating Client Form Mapping entries

### GET Webhook (What backend needs)
- **Purpose**: Fetch/search records
- **Method**: GET
- **Nodes**: Webhook → **Search Records** → Respond
- **Used for**: Reading Client Form Mapping data

## Correct GET Webhook Workflow

For `/webhook/clientformmapping` GET requests, you need:

```json
{
  "nodes": [
    {
      "parameters": {
        "path": "clientformmapping",
        "httpMethod": "GET",  // ← Important: GET, not POST
        "responseMode": "responseNode",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "name": "Webhook (GET)"
    },
    {
      "parameters": {
        "operation": "list",  // ← Important: "list" not "upsert"
        "base": {
          "__rl": true,
          "value": "appzbyi8q7pJRl1cd",
          "mode": "list",
          "cachedResultName": "Seven Dashboard"
        },
        "table": {
          "__rl": true,
          "value": "tbl70C8uPKmoLkOQJ",
          "mode": "list",
          "cachedResultName": "Client Form Mapping"
        },
        "options": {
          "fields": []  // Empty = return all fields
        }
      },
      "type": "n8n-nodes-base.airtable",
      "typeVersion": 2.1,
      "name": "Search Records"  // ← Important: Search, not Create/Update
    },
    {
      "parameters": {
        "respondWith": "allIncomingItems",
        "options": {}
      },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.4,
      "name": "Respond to Webhook"
    }
  ],
  "connections": {
    "Webhook (GET)": {
      "main": [
        [
          {
            "node": "Search Records",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Search Records": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Key Differences

| Feature | POST Webhook | GET Webhook |
|---------|-------------|-------------|
| **HTTP Method** | POST | GET |
| **Webhook Method** | `httpMethod: "POST"` or default | `httpMethod: "GET"` |
| **Airtable Operation** | `operation: "upsert"` | `operation: "list"` |
| **Node Name** | "Create or update a record" | "Search Records" or "List Records" |
| **Purpose** | Write data | Read data |

## Response Format

The GET webhook should return an array of records:

```json
[
  {
    "id": "rec123",
    "createdTime": "2025-01-01T00:00:00.000Z",
    "fields": {
      "Mapping ID": "MAP-001",
      "Client": "CL001",
      "Category": "Personal Information",
      "Is Required": "True",
      "Display Order": "1"
    }
  },
  {
    "id": "rec456",
    "createdTime": "2025-01-01T00:00:00.000Z",
    "fields": {
      "Mapping ID": "MAP-002",
      "Client": "CL001",
      "Category": "Financial Information",
      "Is Required": "True",
      "Display Order": "2"
    }
  }
]
```

## Setup Steps

1. **Create a new workflow** for GET operations (or modify existing)
2. **Add Webhook node**:
   - Path: `clientformmapping`
   - HTTP Method: **GET** (important!)
   - Response Mode: `responseNode`
3. **Add Airtable node**:
   - Operation: **List** (not Upsert)
   - Base: Seven Dashboard
   - Table: Client Form Mapping
   - Options → Fields: Leave empty (returns all fields)
4. **Add Respond to Webhook node**:
   - Respond With: `allIncomingItems`
5. **Connect nodes**: Webhook → Search Records → Respond
6. **Activate workflow** in production mode

## Testing

Test the GET webhook:

```bash
curl -X GET "https://fixrrahul.app.n8n.cloud/webhook/clientformmapping"
```

Should return JSON array of records.

## All GET Webhooks Needed

You need separate GET workflows for each table:

- `/webhook/clientformmapping` → Client Form Mapping
- `/webhook/loanproducts` → Loan Products
- `/webhook/loanapplication` → Loan Applications
- `/webhook/client` → Clients
- `/webhook/commisionledger` → Commission Ledger
- `/webhook/notifications` → Notifications
- ... (see `backend/src/services/airtable/n8nEndpoints.ts` for full list)

Each should use:
- HTTP Method: **GET**
- Airtable Operation: **List**
- Return all records as JSON array

