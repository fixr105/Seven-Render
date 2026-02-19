# KAM Product Assignment

KAMs can assign specific loan products to their clients. Clients only see products that have been assigned to them.

## Airtable Setup

Add an **Assigned Products** column to the **Clients** table:

- **Column name:** `Assigned Products`
- **Type:** Single line text (or Long text)
- **Format:** Comma-separated product IDs (e.g. `LP001,LP002,LP009`)

The n8n Client webhook must pass this field through when reading/writing. If your POST webhook maps all columns, it will work automatically.

## Flow

1. **KAM** → Clients page → "Assign Products" on a client → Select products → Save
2. **Client** → New Application → Loan Product dropdown shows only assigned products

## API Endpoints

- `GET /kam/clients/:id/assigned-products` — Returns product IDs assigned to client
- `PUT /kam/clients/:id/assigned-products` — Assign products (body: `{ productIds: string[] }`)

## Fallback

If a client has no Assigned Products (empty), they see all products with Product Documents or embedded form config (legacy behavior).
