const http = require('http');
const data = JSON.stringify({
  conversation_history: [
    { role: 'user', content: 'I want to request a role' },
    { role: 'assistant', content: 'Which system should I request the role in? 1) P1 - Production, 2) D1 - Development, 3) Q1 - Quality.' },
    { role: 'user', content: 'P1 for user USJODUG' },
    { role: 'assistant', content: 'Do you already have a role name, or would you like to search roles? Reply with "role name" or "search roles."' },
    { role: 'user', content: 'search roles' },
    { role: 'assistant', content: 'Would you like to search roles by tcode (option 1) or copy roles from another user (option 2)?' },
    { role: 'user', content: 'option 2' },
    { role: 'assistant', content: 'Please provide the username of the user whose roles you want to copy.' }
  ],
  message: 'UKMAHOL'
});

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(body);
  });
});
req.on('error', err => console.error(err));
req.write(data);
req.end();
