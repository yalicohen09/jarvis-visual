const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 🟢 משרת את הקבצים מהתיקייה public
app.use(express.static(path.join(__dirname, 'public')));
const os = require('os');

// 🔵 API ל־CPU Usage אמיתי
app.get('/cpu-usage', (req, res) => {
  const cpus = os.cpus();
  const load = cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b);
    return 1 - cpu.times.idle / total;
  });
  const avgLoad = load.reduce((a, b) => a + b) / load.length;
  res.json({ usage: avgLoad });
});

// 🟣 Night Mode Status
let nightModeOn = false;

app.get('/night-mode-status', (req, res) => {
  res.json({ night_mode: nightModeOn });
});

// WebSocket עידכון מצב Night Mode
wss.on('connection', function connection(ws) {
  console.log('🔗 Client connected!');
  
  ws.on('message', function incoming(message) {
    const textMessage = message.toString();
    console.log('📩 received:', textMessage);

    // 🟠 עידכון Night Mode במצב אמיתי
    if (textMessage === 'night_mode_on') nightModeOn = true;
    if (textMessage === 'night_mode_off') nightModeOn = false;

    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(textMessage);
      }
    });
  });
});

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
