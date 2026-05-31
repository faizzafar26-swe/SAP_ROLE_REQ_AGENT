# SAP Role Request Agent - Backend

A Gen AI-powered backend service for SAP role management with advanced tool calling capabilities.

## Features

- **Tool Calling**: Advanced LLM integration with function calling for dynamic tool execution
- **SAP Role Management**: Search roles by tcode, name, user assignments, and request status
- **Local Data Storage**: Uses JSON file instead of database for POC/demo purposes
- **RESTful API**: Clean endpoints for chat and tool testing

## Available Tools

1. **searchRolesByTcode**: Find SAP roles that have access to specific transaction codes
2. **searchRolesByName**: Search roles by name or description
3. **searchRolesOfUser**: Get current role assignments for a user
4. **checkRequestStatus**: Check status of role requests
5. **analyzeSU53Screenshot**: Analyze authorization failure screenshots (placeholder)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```
   PORT=3001
   LLM_API_ENDPOINT=https://aicafe.hcl.com/AICafeService/api/v1/subscription/openai/deployments/gpt-4.1/chat/completions
   LLM_API_VERSION=2024-12-01-preview
   OPENAI_MODEL=gpt-4.1
   LLM_API_KEY=your_api_key_here
   ```

3. Start the server:
   ```bash
   npm run dev
   ```

## API Endpoints

### POST /chat
Main chat endpoint with tool calling support.

**Request:**
```json
{
  "message": "Find roles for transaction SE38"
}
```

**Response:**
```json
{
  "response": "Based on your request, I found these roles that have access to SE38:\n\nZ_BASIS_ADMIN: Basis Administrator\nZ_DEV_ALL: access to all T.codes\nZ_SE38: access to se38"
}
```

### POST /test-tool
Test individual tools without LLM integration.

**Request:**
```json
{
  "toolName": "searchRolesByTcode",
  "parameters": {
    "tcode": "SE38"
  }
}
```

### GET /health
Health check endpoint.

## Tool Calling Architecture

The agent uses advanced tool calling where the LLM can dynamically invoke functions based on user intent:

1. User sends a message
2. LLM analyzes the message and decides which tools to call
3. Backend executes the tools and returns results
4. LLM generates a natural language response based on tool results

## Testing

Run the included test script to verify tool functionality:

```bash
node test-tools.js
```

This will test all available tools with sample data and display results.

## Data Structure

The application uses a local JSON file (`data.json`) with the following structure:
- `sap_systems`: SAP system definitions
- `roles`: SAP role catalog
- `tcodes`: Transaction code definitions
- `role_tcodes`: Role to tcode mappings
- `users`: User information
- `user_requests`: Role request tracking
- `request_roles`: Roles in requests
- `user_role_assignments`: Current user assignments
- `audit_log`: Change tracking

## Integration with Frontend

The backend provides a `/chat` endpoint that the React frontend uses for the chatbot interface. The frontend has a Lego-themed design and provides a ChatGPT-like experience for SAP role requests.
