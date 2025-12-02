# Threaded Query Discussions Implementation

**Date:** 2025-12-02  
**Status:** ✅ Complete

## Overview

Implemented threaded query discussions using embedded metadata in the `content` field without modifying Airtable schema. Queries are stored in the File Auditing Log table (or Queries table if it exists) with embedded metadata tags.

## Metadata Format

Queries use embedded metadata in the `content`/`Details/Message` field:

```
[[parent:<record_id>]][[status:<open|resolved>]] message body...
```

### Examples

**Root Query:**
```
[[status:open]] Can you provide additional documents for this application?
```

**Reply:**
```
[[parent:QUERY-1234567890]][[status:open]] Yes, I'll upload them by tomorrow.
```

**Resolved Query:**
```
[[status:resolved]] Can you provide additional documents for this application?
```

## API Endpoints

### 1. POST /queries/:parentId/replies

Post a reply to an existing query.

**Request:**
```json
POST /queries/QUERY-1234567890/replies
{
  "message": "Yes, I'll upload them by tomorrow.",
  "fileId": "FILE-001",
  "actor": "user@example.com",
  "targetUserRole": "kam"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "QUERY-1764691413960-abc123",
    "parentId": "QUERY-1234567890",
    "message": "Yes, I'll upload them by tomorrow.",
    "content": "[[parent:QUERY-1234567890]][[status:open]] Yes, I'll upload them by tomorrow.",
    "status": "open"
  }
}
```

### 2. GET /queries/thread/:id

Get a complete thread (root query + all replies).

**Request:**
```
GET /queries/thread/QUERY-1234567890
```

**Response:**
```json
{
  "success": true,
  "data": {
    "root": {
      "id": "QUERY-1234567890",
      "message": "Can you provide additional documents?",
      "status": "open",
      "actor": "client@example.com",
      "timestamp": "2025-12-02T10:00:00.000Z",
      "targetUserRole": "kam",
      "resolved": false,
      "fileId": "FILE-001"
    },
    "replies": [
      {
        "id": "QUERY-1764691413960-abc123",
        "parentId": "QUERY-1234567890",
        "message": "Yes, I'll upload them by tomorrow.",
        "status": "open",
        "actor": "kam@example.com",
        "timestamp": "2025-12-02T11:00:00.000Z",
        "targetUserRole": "client",
        "resolved": false
      }
    ],
    "totalReplies": 1,
    "isResolved": false
  }
}
```

### 3. POST /queries/:id/resolve

Mark a query as resolved.

**Request:**
```
POST /queries/QUERY-1234567890/resolve
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "QUERY-1234567890",
    "status": "resolved",
    "message": "Can you provide additional documents?"
  }
}
```

**Content Update:**
- Before: `[[status:open]] Can you provide additional documents?`
- After: `[[status:resolved]] Can you provide additional documents?`

### 4. POST /queries/:id/reopen

Reopen a resolved query.

**Request:**
```
POST /queries/QUERY-1234567890/reopen
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "QUERY-1234567890",
    "status": "open",
    "message": "Can you provide additional documents?"
  }
}
```

**Content Update:**
- Before: `[[status:resolved]] Can you provide additional documents?`
- After: `[[status:open]] Can you provide additional documents?`

## Implementation Details

### Parser Utilities

**File:** `backend/src/utils/queryParser.ts`

Functions:
- `parseQueryContent(content: string)`: Extracts metadata and message
- `buildQueryContent(message, options)`: Builds content with metadata
- `updateQueryStatus(content, newStatus)`: Updates status tag
- `getParentId(content)`: Extracts parent ID
- `isRootQuery(content)`: Checks if query is root (no parent)

### Controller

**File:** `backend/src/controllers/queries.controller.ts`

Methods:
- `postReply()`: Creates reply with parent reference
- `getThread()`: Fetches root + all replies
- `resolveQuery()`: Updates status to resolved
- `reopenQuery()`: Updates status to open

### Storage

Queries are stored in:
- **Primary:** File Auditing Log table (if Queries table doesn't exist)
- **Alternative:** Queries table (if it exists in Airtable)

The system automatically detects and uses the appropriate table.

### Metadata Parsing

The parser:
1. Extracts `[[parent:<id>]]` tag to identify parent query
2. Extracts `[[status:<open|resolved>]]` tag for status
3. Strips metadata tags to get clean message for display
4. Preserves metadata when updating entries

## Usage Examples

### Creating a Thread

```typescript
// 1. Create root query (via existing query endpoint)
POST /kam/loan-applications/:id/queries
{
  "query": "Can you provide additional documents?"
}
// Returns: { id: "QUERY-1234567890", ... }

// 2. Reply to root query
POST /queries/QUERY-1234567890/replies
{
  "message": "Yes, I'll upload them by tomorrow.",
  "fileId": "FILE-001"
}

// 3. Get complete thread
GET /queries/thread/QUERY-1234567890
```

### Resolving Queries

```typescript
// Mark as resolved
POST /queries/QUERY-1234567890/resolve

// Reopen if needed
POST /queries/QUERY-1234567890/reopen
```

## Frontend Integration

### Displaying Threads

```typescript
// Fetch thread
const response = await apiService.get(`/queries/thread/${queryId}`);
const thread = response.data;

// Display root query
<div>
  <p>{thread.root.message}</p>
  <span>Status: {thread.root.status}</span>
</div>

// Display replies
{thread.replies.map(reply => (
  <div key={reply.id}>
    <p>{reply.message}</p>
    <span>By: {reply.actor}</span>
  </div>
))}
```

### Posting Replies

```typescript
await apiService.post(`/queries/${parentId}/replies`, {
  message: "Reply text here",
  fileId: applicationId,
});
```

## Data Structure

### Query Entry (in Airtable)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique query ID |
| `Details/Message` | string | Content with embedded metadata |
| `File` | string | Associated file/application ID |
| `Actor` | string | User who created the query |
| `Timestamp` | string | Creation timestamp |
| `Action/Event Type` | string | "query" or "query_reply" |
| `Target User/Role` | string | Target role for the query |
| `Resolved` | string | "True" or "False" |

### Parsed Query Object

```typescript
{
  id: string;
  parentId?: string;
  message: string; // Clean message (metadata stripped)
  status: 'open' | 'resolved';
  actor: string;
  timestamp: string;
  targetUserRole?: string;
  resolved: boolean;
}
```

## Benefits

✅ **No Schema Changes**: Uses existing `content` field  
✅ **Threaded Discussions**: Full parent-child relationships  
✅ **Status Tracking**: Open/resolved status embedded  
✅ **Backward Compatible**: Works with existing query entries  
✅ **Flexible**: Can use File Auditing Log or dedicated Queries table  

## Files Created

1. `backend/src/utils/queryParser.ts` - Metadata parsing utilities
2. `backend/src/controllers/queries.controller.ts` - Query endpoints
3. `backend/src/routes/queries.routes.ts` - Query routes
4. `backend/THREADED_QUERIES_IMPLEMENTATION.md` - This documentation

## Files Modified

1. `backend/src/routes/index.ts` - Added queries routes
2. `backend/src/types/entities.ts` - Added QueryEntry interface

## Testing

### Test Scenario 1: Create Thread

```bash
# 1. Create root query (via existing endpoint)
POST /kam/loan-applications/FILE-001/queries
{
  "query": "Need clarification on documents"
}

# 2. Reply to root
POST /queries/{rootId}/replies
{
  "message": "I'll provide them by EOD"
}

# 3. Get thread
GET /queries/thread/{rootId}
# Should return root + 1 reply
```

### Test Scenario 2: Resolve/Reopen

```bash
# Resolve
POST /queries/{id}/resolve
# Status should change to resolved

# Reopen
POST /queries/{id}/reopen
# Status should change to open
```

## Notes

- Metadata tags are preserved in storage but stripped for display
- Parent references enable full thread reconstruction
- Status can be updated without affecting message content
- Works with existing File Auditing Log structure
- No Airtable schema modifications required

