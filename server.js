const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// WebSocket logic
wss.on('connection', function connection(ws) {
  console.log('🔗 Client connected!');
  
  ws.on('message', function incoming(message) {
    console.log('📩 received:', message);
    // משדר את ההודעה לכולם
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

// Serve static files from public/
app.use(express.static('public'));

// Start server
server.listen(3000, function () {
  console.log('🚀 Server running on PORT 3000');
});
