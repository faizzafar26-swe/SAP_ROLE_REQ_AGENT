import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Welcome from './Welcome';

function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [messages, setMessages] = useState([
    { text: 'Hello! I am your SAP Role Request Agent. How can I help you today?', sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const quickActions = [
    { label: 'Request role', message: 'I want to request a role' },
    { label: 'Check request status', message: 'Check my request status' }
  ];

  const sendMessage = async (messageText = input) => {
    const text = messageText.toString().trim();
    if (!text) return;

    const userMessage = { text, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send message with conversation history
      const response = await axios.post('http://localhost:3001/chat', {
        message: text,
        conversation_history: conversationHistory
      });

      const botMessage = { text: response.data.response, sender: 'bot' };
      setMessages(prev => [...prev, botMessage]);

      // Update conversation history from backend response
      if (response.data.conversation_history) {
        setConversationHistory(response.data.conversation_history);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { 
        text: error.response?.data?.error || 'Sorry, I could not connect to the server.', 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([
      { text: 'Hello! I am your SAP Role Request Agent. How can I help you today?', sender: 'bot' }
    ]);
    setConversationHistory([]);
    setInput('');
    setIsLoading(false);
    // Keep the user in the chat interface when starting a new chat
    setShowWelcome(false);
  };

  const handleWelcomeStart = () => {
    setWelcomeLoading(true);
    setTimeout(() => {
      setWelcomeLoading(false);
      setShowWelcome(false);
    }, 700);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return showWelcome ? (
    <Welcome
      onStart={handleWelcomeStart}
      loading={welcomeLoading}
      loadingIcon="/lego%20page%20loading%20icon.png"
    />
  ) : (
    <div className="app">
      <header className="header">
        <img src="/LEGO-Logo-1972-1998.png" alt="LEGO" className="lego-logo" />
        <h1>SAP Role Request Agent</h1>
        <div className="header-controls">
          <button onClick={startNewChat} className="new-chat-btn">
            New Chat
          </button>
        </div>
      </header>
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender}`}>
              <div className="message-bubble">
                {msg.text}
              </div>
            </div>
          ))}
          {messages.length === 1 && !isLoading && (
            <div className="quick-actions">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="quick-action-btn"
                  onClick={() => sendMessage(action.message)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {isLoading && (
            <div className="message bot">
              <div className="message-bubble typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
