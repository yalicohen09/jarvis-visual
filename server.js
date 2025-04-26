const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const axios = require('axios');  // ✅ ודא שזה למעלה

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 🟢 משרת את הקבצים מהתיקייה public
app.use(express.static(path.join(__dirname, 'public')));

// 🔵 API ל־CPU Usage פייק
app.get('/cpu-usage', (req, res) => {
  const usage = Math.random() * 0.5 + 0.3; // פייק בין 30% ל־80%
  res.json({ usage });
});

// 🟣 Night Mode Status
let nightModeOn = false;

app.get('/night-mode-status', (req, res) => {
  res.json({ night_mode: nightModeOn });
});

// 🟠 Proxy ל־BTC Price (בלי לוגים)
app.get('/btc-price', async (req, res) => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'BTC API error' });
  }
});

// WebSocket לניהול Night Mode ופנים
wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    const textMessage = message.toString();

    // Night Mode
    if (textMessage === 'night_mode_on') nightModeOn = true;
    if (textMessage === 'night_mode_off') nightModeOn = false;

    // שולח את ההודעה לכל ה־Clients
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(textMessage);
      }
    });
  });
});

// דיפולט – מחזיר index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// מאזין לפורט
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on PORT ${PORT}`);
});
