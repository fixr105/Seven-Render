# n8n Login Workflow Fix - Complete Instructions

## Overview

This document provides step-by-step instructions to update your n8n `/webhook/validate` workflow to ensure it returns accurate JSON responses with all required profile IDs for all user types.

## Current Issue

The n8n workflow's AI Agent may not consistently return all required profile IDs (kam_id, client_id, nbfc_id, credit_team_id) in the correct format, causing login responses to miss critical profile data.

## Required Changes

### 1. Update AI Agent Prompt

**Location**: AI Agent node in your `/webhook/validate` workflow

**Current Prompt Issues**:
- May not explicitly request all profile IDs
- May not handle all user roles correctly

**Updated Prompt** (replace the entire prompt text):

```
# n8n AI Agent Prompt for User Validation

## System Prompt for AI Agent

You are a user authentication agent. Your task is to validate user credentials and return user information in a specific JSON format.

## Your Task:
1. Receive username and passcode from the webhook request
2. Validate the credentials against the Airtable database using the Airtable tool
3. Return user information in the EXACT JSON format specified below

## Input:
- username: string (from webhook body)
- passcode: string (from webhook body)
- Airtable user records (from Airtable tool)

## Validation Rules:
1. Check if the username exists in the User Accounts table
2. Check if the passcode matches the Password field (case-sensitive)
3. Check if Account Status is "Active"
4. If any check fails, return status: "error" with error message

## Output Format (CRITICAL - Must match exactly):

For SUCCESSFUL validation, return:
{
  "status": "success",
  "username": "user@example.com",
  "role": "KAM" | "client" | "credit_team" | "nbfc",
  "associated_profile": "Profile Name",
  "kam_id": "KAM_1021" | null,
  "client_id": "CL001" | null,
  "nbfc_id": "NBFC_001" | null,
  "credit_team_id": "CREDIT_001" | null
}

For FAILED validation, return:
{
  "status": "error",
  "error": "Incorrect credentials" | "Account is not active" | "User not found"
}

## Profile ID Rules (CRITICAL):

1. **KAM Users**:
   - role: "KAM"
   - kam_id: Must fetch from KAM Users table where Email matches username
   - Use "KAM ID" field from KAM Users table, or record id if field not available
   - associated_profile: Use "Name" field from KAM Users table
   - client_id, nbfc_id, credit_team_id: null

2. **Client Users**:
   - role: "client"
   - client_id: Must fetch from Clients table where Contact Email/Phone contains username OR Client Name matches
   - Use "Client ID" field from Clients table, or record id if field not available
   - associated_profile: Use "Client Name" field from Clients table
   - kam_id, nbfc_id, credit_team_id: null

3. **Credit Team Users**:
   - role: "credit_team"
   - credit_team_id: Must fetch from Credit Team Users table where Email matches username
   - Use "Credit Team ID" field from Credit Team Users table, or record id if field not available
   - associated_profile: Use "Name" field from Credit Team Users table
   - kam_id, client_id, nbfc_id: null

4. **NBFC Users**:
   - role: "nbfc"
   - nbfc_id: Must fetch from NBFC Partners table where Contact Email/Phone contains username
   - Use record id from NBFC Partners table
   - associated_profile: Use "Lender Name" field from NBFC Partners table
   - kam_id, client_id, credit_team_id: null

## CRITICAL RULES:
- NEVER return test user data (test@example.com, test-user-123, Test User)
- NEVER return hardcoded or default user data
- If user is not found, return status: "error" with error: "User not found"
- If password is incorrect, return status: "error" with error: "Incorrect credentials"
- If account status is not "Active", return status: "error" with error: "Account is not active"
- Only return status: "success" if username AND passcode match exactly AND account is Active
- ALWAYS include all profile ID fields (kam_id, client_id, nbfc_id, credit_team_id) - use null for fields that don't apply
- ALWAYS fetch profile data from the appropriate table based on role

## Example Outputs:

KAM User:
{
  "status": "success",
  "username": "kam@example.com",
  "role": "KAM",
  "associated_profile": "Key Account Manager – North Zone",
  "kam_id": "KAM_1021",
  "client_id": null,
  "nbfc_id": null,
  "credit_team_id": null
}

Client User:
{
  "status": "success",
  "username": "client@example.com",
  "role": "client",
  "associated_profile": "ABC Corporation",
  "kam_id": null,
  "client_id": "CL001",
  "nbfc_id": null,
  "credit_team_id": null
}

Credit Team User:
{
  "status": "success",
  "username": "credit@example.com",
  "role": "credit_team",
  "associated_profile": "Credit Analyst",
  "kam_id": null,
  "client_id": null,
  "nbfc_id": null,
  "credit_team_id": "CREDIT_001"
}

NBFC User:
{
  "status": "success",
  "username": "nbfc@example.com",
  "role": "nbfc",
  "associated_profile": "NBFC Partner Name",
  "kam_id": null,
  "client_id": null,
  "nbfc_id": "recXXXXXXXXXXXX",
  "credit_team_id": null
}

Error Example:
{
  "status": "error",
  "error": "Incorrect credentials"
}
```

### 2. Update Structured Output Parser JSON Schema

**Location**: Structured Output Parser node

**Current Schema** (update to include all fields):

```json
{
  "status": "success",
  "username": "kam@test.com",
  "role": "KAM",
  "associated_profile": "Key Account Manager – North Zone",
  "kam_id": "KAM_1021",
  "client_id": null,
  "nbfc_id": null,
  "credit_team_id": null
}
```

**Important**: The schema should show an example for each role type. You can use the KAM example above, but ensure the parser accepts:
- `status`: "success" | "error"
- `username`: string
- `role`: "KAM" | "client" | "credit_team" | "nbfc"
- `associated_profile`: string | null
- `kam_id`: string | null
- `client_id`: string | null
- `nbfc_id`: string | null
- `credit_team_id`: string | null
- `error`: string (only when status is "error")

### 3. Update Respond to Webhook Node

**Location**: Respond to Webhook node

**Current Issue**: May have hardcoded test user data

**Fix**: 
1. Open the "Respond to Webhook" node
2. Set "Response Body" to: `={{ $json.body }}` or `={{ $json }}`
3. Ensure "Response Mode" is set to "responseNode"
4. Remove any hardcoded JSON test data

**Correct Configuration**:
- Response Mode: `responseNode`
- Response Body: `={{ $json.body }}` (this passes through the AI Agent's output)

### 4. Verify Airtable Tool Connection

**Location**: Search records in Airtable node

**Ensure**:
- Base: "Seven Dashboard" (appzbyi8q7pJRl1cd)
- Table: "User Accounts" (tbl7RRcehD5xLiPv7)
- Operation: "search"
- Credentials are properly configured

**Note**: The AI Agent should also have access to:
- KAM Users table (for KAM role)
- Clients table (for client role)
- Credit Team Users table (for credit_team role)
- NBFC Partners table (for nbfc role)

You may need to add additional Airtable tool nodes connected to the AI Agent for each role-specific table.

## Testing Checklist

After making these changes, test with:

1. **KAM User**:
   ```bash
   curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
     -H "Content-Type: application/json" \
     -d '{"username": "kam@example.com", "passcode": "password123"}'
   ```
   Expected: Returns kam_id, role: "KAM", associated_profile

2. **Client User**:
   ```bash
   curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
     -H "Content-Type: application/json" \
     -d '{"username": "client@example.com", "passcode": "password123"}'
   ```
   Expected: Returns client_id, role: "client", associated_profile

3. **Credit Team User**:
   ```bash
   curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
     -H "Content-Type: application/json" \
     -d '{"username": "credit@example.com", "passcode": "password123"}'
   ```
   Expected: Returns credit_team_id, role: "credit_team", associated_profile

4. **NBFC User**:
   ```bash
   curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
     -H "Content-Type: application/json" \
     -d '{"username": "nbfc@example.com", "passcode": "password123"}'
   ```
   Expected: Returns nbfc_id, role: "nbfc", associated_profile

5. **Invalid Credentials**:
   ```bash
   curl -X POST https://fixrrahul.app.n8n.cloud/webhook/validate \
     -H "Content-Type: application/json" \
     -d '{"username": "invalid@example.com", "passcode": "wrong"}'
   ```
   Expected: Returns status: "error", error: "Incorrect credentials"

## Important Notes

1. **Backend Integration**: The backend `/auth/validate` endpoint currently bypasses this n8n webhook and uses the same logic as `/auth/login`. However, if you want to use the n8n workflow, ensure the response format matches what the backend expects.

2. **Field Name Mapping**: The backend expects:
   - `username` → `email`
   - `kam_id` → `kamId`
   - `client_id` → `clientId`
   - `nbfc_id` → `nbfcId`
   - `credit_team_id` → `creditTeamId`

3. **Workflow Activation**: Ensure the workflow is **Active** (green toggle) in n8n.

4. **Error Handling**: The AI Agent should always return a valid JSON response, even for errors. Never return empty responses or HTML error pages.

## Troubleshooting

### Issue: Workflow returns empty response
- Check if workflow is Active
- Check AI Agent is connected to Airtable tool
- Verify Airtable credentials
- Check workflow execution logs in n8n

### Issue: Missing profile IDs
- Verify AI Agent prompt includes instructions to fetch profile data
- Check if Airtable tool has access to role-specific tables
- Verify Structured Output Parser schema includes all fields
- Check workflow execution logs to see what AI Agent returned

### Issue: Wrong profile IDs
- Verify email matching logic in AI Agent prompt
- Check Airtable table field names match what's in the prompt
- Verify role-specific table lookups are correct

## Next Steps

1. Update the AI Agent prompt with the new prompt text above
2. Update Structured Output Parser schema
3. Verify Respond to Webhook node configuration
4. Test with all user types
5. Verify backend receives correct profile IDs

After completing these steps, all users should be able to login with accurate profile data!
