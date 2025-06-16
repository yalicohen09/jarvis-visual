const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // ✅ Middleware לקריאת JSON

// 🔵 API ל־CPU Usage פייק
app.get('/cpu-usage', (req, res) => {
  const usage = Math.random() * 0.5 + 0.3;
  res.json({ usage });
});

// 🟣 Night Mode Status
let nightModeOn = false;

app.get('/night-mode-status', (req, res) => {
  res.json({ night_mode: nightModeOn });
});

// 🟠 Proxy ל־BTC Price
app.get('/btc-price', async (req, res) => {
  try {
    const response = await axios.get('https://api.coinbase.com/v2/prices/BTC-USD/spot');
    res.json({ price: parseFloat(response.data.data.amount) });
  } catch (error) {
    console.error('❌ BTC API Error:', error);
    res.status(500).json({ error: 'BTC API error' });
  }
});

// 🟡 NEW: קבלת הודעות חדשות ושידור ל־WebSocket
let latestNews = [];

app.post('/api/news', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).send('Missing message');
  latestNews.push(message);
  if (latestNews.length > 50) latestNews.shift(); // שמור עד 50 הודעות

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'news', message }));
    }
  });

  res.sendStatus(200);
});

// WebSocket לניהול Night Mode + חדשות
wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    const textMessage = message.toString();

    if (textMessage === 'night_mode_on') nightModeOn = true;
    if (textMessage === 'night_mode_off') nightModeOn = false;

    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(textMessage);
      }
    });
  });
});

// ברירת מחדל – טען index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// מאזין לפורט
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on PORT ${PORT}`);
});
