const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 🟢 משרת את הקבצים מהתיקייה public
app.use(express.static(path.join(__dirname, 'public')));

// 🔵 הגדרה שתחזיר את index.html לכל בקשה (כדי שלא יהיה 404)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🟣 WebSocket
wss.on('connection', function connection(ws) {
  console.log('🔗 Client connected!');
  
  ws.on('message', function incoming(message) {
    const textMessage = message.toString(); // 🟠 המרה ל-String

    console.log('📩 received:', textMessage); // מדפיס כמחרוזת רגילה

    // שולח את המחרוזת לכל הקליינטים
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(textMessage); // 🟢 שולח טקסט רגיל!
      }
    });
  });
});

// 🔴 מאזין לפורט של Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, function () {
  console.log(`🚀 Server running on PORT ${PORT}`);
});
