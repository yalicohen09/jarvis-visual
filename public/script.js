// WebSocket לשינוי הפנים
const ws = new WebSocket('wss://jarvis-visual.onrender.com');
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'news') {
      const newsFeed = document.getElementById('news-feed');
      const item = document.createElement('div');
      item.textContent = '🟡 ' + data.message;
      item.style.borderBottom = '1px solid #444';
      item.style.padding = '4px';
      newsFeed.prepend(item);
      return;
    }
  } catch (e) {
    // לא JSON? אולי זה night_mode או דיבור
  }

  const face = document.getElementById('jarvis-face');
  if (event.data === 'start_talking') {
    face.src = 'https://cdn.glitch.global/e2b1c048-c542-433a-a1b0-8c21b6c18e4c/open.png?v=1745346330557';
  } else if (event.data === 'stop_talking') {
    face.src = 'https://cdn.glitch.global/e2b1c048-c542-433a-a1b0-8c21b6c18e4c/closed.png?v=1745346349736';
  }
};


// Waveform אנימציה
const waveCanvas = document.getElementById('waveform');
const waveCtx = waveCanvas.getContext('2d');
waveCanvas.width = waveCanvas.offsetWidth;
waveCanvas.height = waveCanvas.offsetHeight;

function drawWaveform() {
  waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
  waveCtx.beginPath();
  for (let i = 0; i < waveCanvas.width; i += 5) {
    const y = waveCanvas.height / 2 + Math.sin(i * 0.05 + Date.now() * 0.005) * 20;
    waveCtx.lineTo(i, y);
  }
  waveCtx.strokeStyle = '#00ffff';
  waveCtx.stroke();
  requestAnimationFrame(drawWaveform);
}
drawWaveform();

// גרף CPU דינמי
const cpuCanvas = document.getElementById('cpuGraph');
const cpuCtx = cpuCanvas.getContext('2d');
cpuCanvas.width = cpuCanvas.offsetWidth;
cpuCanvas.height = cpuCanvas.offsetHeight;
let cpuData = [];

function drawCpuGraph() {
  cpuCtx.clearRect(0, 0, cpuCanvas.width, cpuCanvas.height);
  cpuCtx.beginPath();
  cpuData.push(Math.random() * cpuCanvas.height);
  if (cpuData.length > cpuCanvas.width) cpuData.shift();
  cpuData.forEach((point, index) => {
    cpuCtx.lineTo(index, cpuCanvas.height - point);
  });
  cpuCtx.strokeStyle = '#00ffff';
  cpuCtx.stroke();
  requestAnimationFrame(drawCpuGraph);
}
drawCpuGraph();

// גרף ביטקוין + עדכון מחיר עם בדיקה סופית
const btcCanvas = document.getElementById('btcGraph');
const btcCtx = btcCanvas.getContext('2d');
btcCanvas.width = btcCanvas.offsetWidth;
btcCanvas.height = btcCanvas.offsetHeight;
let btcData = [];

function drawBtcGraph() {
  fetch('/btc-price')
    .then(response => response.json())
    .then(data => {
      console.log('🔎 BTC DATA:', data);  // תראה מה מגיע

      const rawPrice = Number(data.price);  // קלט מהשרת
      if (!rawPrice) {
        console.error('❌ מחיר לא חוקי:', data.price);
        return;
      }

      const price = rawPrice.toFixed(2);
      document.getElementById('btc-price').innerText = `$${price}`;
      
      btcData.push(Number(rawPrice));
      
      if (btcData.length > btcCanvas.width) btcData.shift();

      btcCtx.clearRect(0, 0, btcCanvas.width, btcCanvas.height);
      btcCtx.beginPath();
      btcData.forEach((point, index) => {
        const scaledPoint = btcCanvas.height - ((point - Math.min(...btcData)) / (Math.max(...btcData) - Math.min(...btcData) || 1)) * btcCanvas.height;
        btcCtx.lineTo(index, scaledPoint);
      });
      btcCtx.strokeStyle = '#00ffff';
      btcCtx.shadowColor = '#00ffff';
      btcCtx.shadowBlur = 10;
      btcCtx.lineWidth = 2;
      btcCtx.stroke();
    })
    .catch((error) => {
      console.error('❌ שגיאה ב־BTC Fetch:', error);
      btcCtx.clearRect(0, 0, btcCanvas.width, btcCanvas.height);
      btcCtx.fillStyle = '#ff0000';
      btcCtx.fillText('BTC ERROR', 10, 50);
    });
  setTimeout(drawBtcGraph, 5000);
}
drawBtcGraph();

// עדכון השעונים
function updateClocks() {
  const now = new Date();
  const israel = now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const london = now.toLocaleTimeString('en-GB', { timeZone: 'Europe/London' });
  const ny = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
  const moscow = now.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow' });
  const paris = now.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });

  document.getElementById('clock-israel').innerText = israel;
  document.getElementById('clock-london').innerText = london;
  document.getElementById('clock-ny').innerText = ny;
  document.getElementById('clock-moscow').innerText = moscow;
  document.getElementById('clock-paris').innerText = paris;
}
setInterval(updateClocks, 1000);
updateClocks();

// בדיקת מצב האור
function updateLightsStatus() {
  fetch('https://maker.ifttt.com/trigger/check_lights/with/key/cgNYs4fx61JOz-4SO4i_D0eFM5rWbuC0kEQawB_JqAT')
    .then(res => res.json())
    .then(data => {
      const status = data.lights_on ? "ON" : "OFF";
      document.getElementById('lights-status').innerText = `LIGHTS: ${status}`;
    })
    .catch(() => {
      document.getElementById('lights-status').innerText = "LIGHTS: ERROR";
    });
}
setInterval(updateLightsStatus, 5000);
updateLightsStatus();

// בדיקת מצב ה־Night Mode
function updateNightModeStatus() {
  fetch('/night-mode-status')
    .then(res => res.json())
    .then(data => {
      const nightStatus = document.getElementById('night-mode-status');
      nightStatus.innerText = `NIGHT MODE: ${data.night_mode ? 'ON' : 'OFF'}`;
    })
    .catch(() => {
      document.getElementById('night-mode-status').innerText = "NIGHT MODE: ERROR";
    });
}
setInterval(updateNightModeStatus, 5000);
updateNightModeStatus();
