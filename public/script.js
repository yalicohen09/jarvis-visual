// WebSocket לשינוי הפנים
const ws = new WebSocket('wss://jarvis-visual.onrender.com');

ws.onopen = () => {
  console.log("✅ WebSocket התחבר בהצלחה");
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log("📨 קיבלתי מהשרת:", data);
  } catch (e) {
    console.warn("🔵 לא JSON – אולי פקודת דיבור רגילה:", event.data);
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

// גרף ביטקוין + עדכון מחיר
const btcCanvas = document.getElementById('btcGraph');
const btcCtx = btcCanvas.getContext('2d');
btcCanvas.width = btcCanvas.offsetWidth;
btcCanvas.height = btcCanvas.offsetHeight;
let btcData = [];

function drawBtcGraph() {
  fetch('/btc-price')
    .then(response => response.json())
    .then(data => {
      const rawPrice = Number(data.price);
      if (!rawPrice) return;

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
    .catch(() => {
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

// --- נתוני Garmin (דמו כרגע) ---
async function checkAuth() {
  try {
    const r = await fetch("/auth/status", { cache: "no-store" });
    const j = await r.json();
    return !!j.authenticated;
  } catch {
    return false;
  }
}

function setHealthText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

async function updateGarmin() {
  const authed = await checkAuth();
  const connectBtn = document.getElementById("connect-fit-btn");
  if (!authed) {
    if (connectBtn) connectBtn.style.display = "block";
    // נציג placeholderים ולא נבצע רידיירקט אוטומטי
    setHealthText("garmin-hr",        "❤️ דופק: --");
    setHealthText("garmin-bp",        "🩸 לחץ דם: --/--");
    setHealthText("garmin-readiness", "⚡ מוכנות לאימון: --");
    setHealthText("garmin-steps",     "👣 צעדים: --");
    setHealthText("garmin-calories",  "🔥 קלוריות: --");
    setHealthText("garmin-sleep",     "💤 שינה: --");
    return;
  } else if (connectBtn) {
    connectBtn.style.display = "none";
  }

  try {
    const res = await fetch("/garmin", { cache: "no-store" });
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();

    const hr   = (data.heartRate ?? "--");
    const bp   = (data.bloodPressure ?? "--/--");
    const tr   = (data.trainingReadiness ?? "--");
    const st   = (data.steps ?? 0);
    const cal  = (data.calories ?? 0);
    const slp  = (data.sleep ?? 0);

    setHealthText("garmin-hr",        `❤️ דופק: ${hr} BPM`);
    setHealthText("garmin-bp",        `🩸 לחץ דם: ${bp}`);
    setHealthText("garmin-readiness", `⚡ מוכנות לאימון: ${tr}`);
    setHealthText("garmin-steps",     `👣 צעדים: ${st}`);
    setHealthText("garmin-calories",  `🔥 קלוריות: ${cal}`);
    setHealthText("garmin-sleep",     `💤 שינה: ${slp} דקות`);
  } catch (e) {
    console.error("Garmin panel error:", e);
  }
}

const btn = document.getElementById("connect-fit-btn");
if (btn) {
  btn.addEventListener("click", () => {
    window.location.href = "/auth";
  });
}

setInterval(updateGarmin, 8000);
updateGarmin();


