# SAP Role Request Agent

A Gen AI-powered application for SAP end users to manage role requests through an intelligent chatbot interface.

## 🎯 Features

- **5 Core Functionalities**:
  1. Search roles by transaction code (tcode)
  2. Search roles by role name
  3. Search roles of existing users
  4. Check status of role requests
  5. Analyze SU53 authorization failure screenshots

- **Advanced Tool Calling**: LLM dynamically invokes functions based on user intent
- **Lego-Themed UI**: Fun, colorful ChatGPT-like interface
- **Local Data Storage**: JSON-based data for POC/demo purposes
- **Full-Stack Architecture**: Separate backend and frontend

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/REST    ┌─────────────────┐
│   Frontend      │◄────────────────►│   Backend       │
│   (React)       │                  │   (Node.js)     │
│                 │                  │                 │
│ - Chat UI       │                  │ - Tool Calling  │
│ - Lego Theme    │                  │ - LLM Integration│
│ - Real-time     │                  │ - Data Queries  │
└─────────────────┘                  └─────────────────┘
                                           │
                                           ▼
                                   ┌─────────────────┐
                                   │   Data          │
                                   │   (JSON)        │
                                   │                 │
                                   │ - SAP Systems   │
                                   │ - Roles         │
                                   │ - Tcodes        │
                                   │ - Mappings      │
                                   └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### 1. Backend Setup
```bash
cd backend
npm install
# Configure .env with your LLM endpoint
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## 🔧 Configuration

### Backend (.env)
```env
PORT=3001
LLM_ENDPOINT=https://your-llm-endpoint.com/api/generate
LLM_API_KEY=your_api_key_here
```

### Tool Calling
The agent uses advanced function calling where the LLM can invoke these tools:
- `searchRolesByTcode(tcode)`
- `searchRolesByName(roleName)`
- `searchRolesOfUser(userId)`
- `checkRequestStatus(requestId)`
- `analyzeSU53Screenshot(imageData)`

## 📁 Project Structure

```
sap-role-agent/
├── backend/                    # Node.js Express server
│   ├── server.js              # Main server with tool calling
│   ├── data.json              # Local database
│   ├── test-tools.js          # Tool testing script
│   ├── .env                   # Environment config
│   └── package.json
├── frontend/                   # React application
│   ├── src/
│   │   ├── App.jsx            # Chat interface
│   │   └── App.css            # Lego theme styles
│   ├── public/
│   └── package.json
└── README.md                  # This file
```

## 🧪 Testing

### Backend Tools
```bash
cd backend
node test-tools.js
```

This tests all tool functions with sample data.

### API Testing
```bash
# Test chat endpoint
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find roles for SE38"}'

# Test individual tools
curl -X POST http://localhost:3001/test-tool \
  -H "Content-Type: application/json" \
  -d '{"toolName": "searchRolesByTcode", "parameters": {"tcode": "SE38"}}'
```

## 🎨 UI Theme

The frontend features a Lego-inspired design:
- **Colors**: Red, yellow, blue, green gradients
- **Typography**: Clean, modern fonts
- **Layout**: ChatGPT-like interface with message bubbles
- **Animations**: Typing indicators and smooth transitions

## 🔄 Data Flow

1. **User Input** → Frontend sends message to backend
2. **LLM Analysis** → Backend sends prompt + tools to LLM
3. **Tool Calling** → LLM decides which tools to invoke
4. **Function Execution** → Backend executes tools and gets results
5. **Response Generation** → LLM creates natural language response
6. **Display** → Frontend shows response to user

## 🚧 Current Status

- ✅ Tool calling implementation
- ✅ Local data storage
- ✅ Lego-themed UI
- ✅ Basic chat functionality
- 🔄 SU53 screenshot analysis (placeholder)
- 🔄 Production deployment setup

## 📝 Usage Examples

**Search by Tcode:**
```
User: "Find roles that can access SE38"
Agent: "I found these roles: Z_BASIS_ADMIN, Z_DEV_ALL, Z_SE38"
```

**Search by Name:**
```
User: "Show me HR roles"
Agent: "Here are the HR-related roles: Z_HR_VIEWER, Z_HR_EDITOR"
```

**Check User Roles:**
```
User: "What roles does JOHN have?"
Agent: "User JOHN has: Z_HR_VIEWER in Production (2024-01-01 to 2024-12-31)"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for demonstration purposes. Please check with your organization for production use.


test code __________________________________________________________________________________________________

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const LLM_API_ENDPOINT = process.env.LLM_API_ENDPOINT || process.env.LLM_ENDPOINT;
const LLM_API_VERSION = process.env.LLM_API_VERSION;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';

// Middleware
app.use(cors());
app.use(express.json());

// Load data and config
let data;
let config;
let mockStore;
try {
  const dataPath = path.join(__dirname, 'data.json');
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const configPath = path.join(__dirname, 'config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const mockStorePath = path.join(__dirname, 'mock_store.json');
  mockStore = JSON.parse(fs.readFileSync(mockStorePath, 'utf8'));
  console.log('Backend Data Loaded Successfully');
} catch (error) {
  console.error('Error loading data or config:', error);
  process.exit(1);
}

const mockApprovers = {
  P1: { primary: 'Alex Johnson', backup: 'Morgan Reed' },
  D1: { primary: 'Mia Carter', backup: 'Jordan Brooks' },
  Q1: { primary: 'Samira Patel', backup: 'Casey Liu' }
};

function resolveMockApproverName(request) {
  if (!request) return 'Approval Pending';
  if (request.approver_name) return request.approver_name;
  if (request.approver_id && request.approver_id !== 'Approval Pending') return request.approver_id;
  const systemId = request.payload_summary?.system;
  return mockApprovers[systemId]?.primary || 'Approval Pending';
}

function getNextReqNo() {
  const reqNos = Object.keys(mockStore.requests).map(n => parseInt(n, 10));
  const maxReqNo = reqNos.length > 0 ? Math.max(...reqNos) : 1001000999;
  return (maxReqNo + 1).toString();
}

// ==================== CORE SAP FUNCTIONS (THE TOOLS) ====================

function searchRolesByName(roleName) {
  if (!roleName) return [];
  const upperName = roleName.toUpperCase();
  return data.roles.filter(role => 
    role.role_name.toUpperCase().includes(upperName) ||
    role.role_desc.toUpperCase().includes(upperName)
  );
}

function searchRolesByTcode(tcode) {
  if (!tcode) return [];
  const upperTcode = tcode.toUpperCase();
  const tcodeObj = data.tcodes.find(tc => tc.tcode_code.toUpperCase() === upperTcode);
  if (!tcodeObj) return [];
  const roleIds = data.role_tcodes.filter(rt => rt.tcode_id === tcodeObj.tcode_id).map(rt => rt.role_id);
  return data.roles.filter(role => roleIds.includes(role.role_id));
}

function searchRolesOfUser(userId) {
  if (!userId) return [];
  const user = data.users.find(u => u.user_name.toLowerCase() === userId.toLowerCase());
  if (!user) return [];
  const assignments = data.user_role_assignments.filter(a => a.user_id === user.user_id);
  return assignments.map(a => {
    const role = data.roles.find(r => r.role_id === a.role_id);
    return { ...role, assignment_id: a.user_role_assignment_id };
  });
}

function getExistingAccess(systemId, userId) {
  const user = data.users.find(u => u.user_name.toLowerCase() === userId.toLowerCase());
  if (!user) return { error: `User ${userId} not found` };
  
  const system = config.systems.find(s => s.id === systemId);
  if (!system) return { error: `System ${systemId} not found` };
  
  const assignments = data.user_role_assignments.filter(a => a.user_id === user.user_id);
  const roles = assignments.map(a => {
    const role = data.roles.find(r => r.role_id === a.role_id);
    return { role_name: role.role_name, role_desc: role.role_desc };
  });
  
  return { user: user.user_name, system: system.display, roles: roles, role_count: roles.length };
}

function createRoleRequest(userId, roleName, systemId) {
  const user = data.users.find(u => u.user_name.toLowerCase() === userId.toLowerCase());
  if (!user) return { error: `User ${userId} not found` };
  
  const role = data.roles.find(r => r.role_name.toLowerCase() === roleName.toLowerCase());
  if (!role) return { error: `Role ${roleName} not found` };
  
  const system = config.systems.find(s => s.id === systemId);
  if (!system) return { error: `System ${systemId} not found. Use P1, D1, or Q1.` };
  
  const reqNo = getNextReqNo();
  const newRequest = {
    approver_id: "Approval Pending",
    approver_name: mockApprovers[systemId]?.primary || 'Approval Pending',
    created_at: new Date().toISOString(),
    payload_summary: { system: systemId, username: userId, Roles: [roleName], Userid: "SYSTEM" },
    req_no: reqNo,
    request_id: crypto.randomUUID(),
    stage: "Approval Pending",
    status: "PENDING"
  };
  
  mockStore.requests[reqNo] = newRequest;
  fs.writeFileSync(path.join(__dirname, 'mock_store.json'), JSON.stringify(mockStore, null, 2));
  
  return { success: true, request_number: reqNo, message: `Role request submitted. Request number: ${reqNo}.` };
}

function checkRequestStatus(requestId) {
  let request = mockStore.requests[requestId] || data.user_requests.find(r => r.req_no === requestId || r.request_id == requestId);
  if (!request) return { error: "Request not found." };

  return {
    Reqstatus: request.status || 'PENDING',
    Reqcurrentstage: request.stage || request.current_stage || 'SUBMITTED',
    ApproverId: resolveMockApproverName(request),
    ReqNo: request.req_no
  };
}

// ==================== AGENT CONFIGURATION & TOOLS ====================

const availableTools = [
  {
    type: "function",
    function: {
      name: "check_request_status",
      description: "Check the status of a user's role request. Ask the user for their Request Number (ReqNo) before calling this.",
      parameters: {
        type: "object",
        properties: { ReqNo: { type: "string", description: "The request number (e.g., REQ123456)" } },
        required: ["ReqNo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_roles",
      description: "Search for SAP roles by name, transaction code (tcode), or by copying from another user.",
      parameters: {
        type: "object",
        properties: {
          RoleName: { type: "string", description: "The role name or keyword to search for" },
          Tcode: { type: "string", description: "The SAP transaction code (e.g., SE38)" },
          CopyUser: { type: "string", description: "The user ID to copy roles from" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_existing_access",
      description: "Check the existing roles assigned to a user in a specific system. You must have both the System (P1, D1, Q1) and the User ID.",
      parameters: {
        type: "object",
        properties: {
          System: { type: "string", description: "The system ID (P1, D1, or Q1)" },
          UserId: { type: "string", description: "The user ID to check" }
        },
        required: ["System", "UserId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_role",
      description: "Submit a new role request. You must have the User ID, exact Role Name, and System (P1, D1, Q1) before calling this.",
      parameters: {
        type: "object",
        properties: {
          Userid: { type: "string", description: "The user ID receiving the role" },
          RoleName: { type: "string", description: "The exact name of the role to request" },
          SystemName: { type: "string", description: "The system ID (P1, D1, Q1)" }
        },
        required: ["Userid", "RoleName", "SystemName"]
      }
    }
  }
];

async function executeTool(name, args) {
  console.log(`[Agent] Executing Tool: ${name}`, args);
  switch (name) {
    case 'check_request_status': return checkRequestStatus(args.ReqNo);
    case 'search_roles':
      if (args.CopyUser) return { roles: searchRolesOfUser(args.CopyUser) };
      if (args.Tcode) return { roles: searchRolesByTcode(args.Tcode) };
      if (args.RoleName) return { roles: searchRolesByName(args.RoleName) };
      return { error: "No search parameters provided." };
    case 'get_existing_access': return getExistingAccess(args.System, args.UserId);
    case 'request_role': return createRoleRequest(args.Userid, args.RoleName, args.SystemName);
    default: return { error: `Tool ${name} not recognized.` };
  }
}

async function callLLM(messages) {
  const endpointUrl = LLM_API_VERSION
    ? `${LLM_API_ENDPOINT}${LLM_API_ENDPOINT.includes('?') ? '&' : '?'}api-version=${encodeURIComponent(LLM_API_VERSION)}`
    : LLM_API_ENDPOINT;

  const response = await axios.post(endpointUrl, {
    model: OPENAI_MODEL,
    messages: messages,
    tools: availableTools,
    tool_choice: 'auto'
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
      'api-key': process.env.LLM_API_KEY,
      'Content-Type': 'application/json'
    }
  });
  return response.data.choices[0].message;
}

// ==================== CHAT ENDPOINT (AGENT LOOP) ====================

app.post('/chat', async (req, res) => {
  const { message, conversation_history = [] } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

  const systemPrompt = {
    role: 'system',
    content: `You are an intelligent SAP Role Request Assistant. 
    Help users manage SAP roles using the tools provided.
    If you do not have enough information to use a tool, politely ask the user for the missing details (e.g., "What is your User ID?" or "Which system: P1, D1, or Q1?").
    Never guess system IDs or User IDs. Always confirm before submitting a request.
    Keep answers concise, friendly, and plain text without markdown formatting.`
  };

  // Convert incoming history to match OpenAI schema (remove tool calls from frontend history for clean re-entry)
  const cleanHistory = conversation_history.map(msg => ({ role: msg.role, content: msg.content }));
  let messages = [systemPrompt, ...cleanHistory, { role: 'user', content: message }];

  try {
    let requiresAction = true;
    let finalAssistantMessage = null;

    while (requiresAction) {
      const llmMessage = await callLLM(messages);
      messages.push(llmMessage);

      if (llmMessage.tool_calls && llmMessage.tool_calls.length > 0) {
        for (const toolCall of llmMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = await executeTool(toolCall.function.name, args);
          
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(toolResult)
          });
        }
      } else {
        requiresAction = false;
        finalAssistantMessage = llmMessage.content;
      }
    }

    // Filter out system and tool messages to send a clean history back to the frontend
    const updatedHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content || "" }))
      .filter(m => m.content !== "");

    res.json({ response: finalAssistantMessage, conversation_history: updatedHistory });

  } catch (error) {
    console.error('Agent Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

app.listen(PORT, () => {
  console.log(`Agent Server running on port ${PORT}`);
});
