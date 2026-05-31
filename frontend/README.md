# SAP Role Request Agent - Frontend

A Lego-themed chatbot interface for SAP role management powered by Gen AI.

## Features

- **ChatGPT-like Interface**: Clean, intuitive chat experience
- **Lego Theme**: Fun, colorful design inspired by Lego bricks
- **Real-time Communication**: Live chat with the SAP Role Agent backend
- **Responsive Design**: Works on desktop and mobile devices
- **Typing Indicators**: Visual feedback during agent responses

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Make sure the backend is running on `http://localhost:3001`

## Architecture

The frontend communicates with the backend via REST API:

- **POST /chat**: Sends user messages and receives agent responses
- The backend handles tool calling and LLM integration
- Responses are displayed in a chat-like interface

## Lego Theme

The interface uses a Lego-inspired color scheme:
- **Primary Colors**: Red, yellow, blue, green
- **Background**: Clean white with subtle patterns
- **Chat Bubbles**: Color-coded for user (blue) and bot (orange) messages
- **Header**: Gradient background with Lego brick pattern

## User Experience

Users can interact with the agent for:

1. **Search roles by Tcode**: "Find roles for SE38"
2. **Search roles by name**: "Show me HR roles"
3. **Check user roles**: "What roles does user JOHN have?"
4. **Check request status**: "Status of request REQ001"
5. **SU53 analysis**: "Analyze this authorization error" (placeholder)

## Development

### Project Structure
```
frontend/
├── src/
│   ├── App.jsx          # Main chat component
│   ├── App.css          # Lego-themed styles
│   ├── main.jsx         # React entry point
│   └── assets/          # Static assets
├── public/              # Public assets
├── package.json         # Dependencies
└── vite.config.js       # Vite configuration
```

### Key Components

- **Message Display**: Shows conversation history
- **Input Field**: User message input with send button
- **Typing Indicator**: Animated dots during agent response
- **Responsive Layout**: Adapts to different screen sizes

## Integration

The frontend expects the backend to be running and accessible. Configure the API endpoint in the chat component if needed.

## Building for Production

```bash
npm run build
```

This creates optimized production files in the `dist/` directory.