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