import express from "express";
import fetch from "node-fetch";
import { google } from "googleapis";
import bodyParser from "body-parser";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 5000;

// ===== OAuth =====
const oauth2Client = new google.auth.OAuth2(
  "1060382255075-a51dbvl8uncects4gdq6q0j349p448f1.apps.googleusercontent.com", // Client ID
  "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",                                       // Client Secret
  "https://jarvis-visual.onrender.com/oauth2callback"                           // Redirect URI
);

// ---- טעינת טוקנים מקובץ (אם קיימים) ----
const TOKENS_PATH = "./tokens.json";
function loadTokens() {
  try {
    if (fs.existsSync(TOKENS_PATH)) {
      const raw = fs.readFileSync(TOKENS_PATH, "utf-8");
      const tokens = JSON.parse(raw);
      oauth2Client.setCredentials(tokens);
      return tokens;
    }
  } catch (e) {
    console.error("⚠️ Failed to load tokens:", e);
  }
  return null;
}
let tokens = loadTokens();

app.use(bodyParser.json());
app.use(express.static("public"));

// ===== שלב 1: התחברות ל-Google Fit =====
app.get("/auth", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/fitness.heart_rate.read",
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.sleep.read",
      "https://www.googleapis.com/auth/fitness.body.read"
    ],
  });
  res.redirect(url);
});

// ===== שלב 2: קבלת ה-code בחזרה ושמירת טוקנים =====
app.get("/oauth2callback", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens: newTokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(newTokens);
    tokens = newTokens;
    // נשמור לקובץ כדי שלא יאבד אחרי sleep/אתחול
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(newTokens, null, 2));
    console.log("✅ קיבלתי ושמרתי טוקנים (כולל refresh_token אם קיים).");
    res.send("✅ התחברת בהצלחה ל-Google Fit! עכשיו האתר יכול להביא נתוני בריאות אמיתיים.");
  } catch (err) {
    console.error("❌ שגיאה בקבלת טוקן:", err);
    res.status(500).send("שגיאה בהתחברות ל-Google Fit");
  }
});

// ===== עזר: פונקציית דיפולט לערכים חסרים =====
const safe = (v, fallback = "--") =>
  (v === undefined || v === null || Number.isNaN(v)) ? fallback : v;

// ===== שלב 3: Endpoint בריאות =====
app.get("/garmin", async (req, res) => {
  try {
    // אם אין טוקנים טעונים – נבקש ללקוח להתחבר
    if (!tokens && !oauth2Client.credentials?.access_token) {
      return res.status(401).json({ error: "NotAuthenticated" });
    }

    // googleapis ינסה לרענן אוטומטית אם יש refresh_token
    const fitness = google.fitness({ version: "v1", auth: oauth2Client });

    // טווחי זמן
    const now = Date.now();
    const tenMin = 10 * 60 * 1000;
    const day = 24 * 60 * 60 * 1000;

    // --- דופק אחרון (10 דקות אחורה) ---
    const hrDataset = `${(now - tenMin)}000000-${now}000000`; // ns
    const hrResponse = await fitness.users.dataSources.datasets.get({
      userId: "me",
      dataSourceId: "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm",
      datasetId: hrDataset
    });
    const hrPoints = hrResponse.data.point || [];
    const heartRate = hrPoints.length > 0 ? hrPoints[hrPoints.length - 1].value[0].fpVal : null;

    // --- צעדים היום ---
    const stepsResponse = await fitness.users.dataset.aggregate({
      userId: "me",
      requestBody: {
        aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
        bucketByTime: { durationMillis: day },
        startTimeMillis: now - day,
        endTimeMillis: now
      }
    });
    const steps = stepsResponse.data.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal ?? 0;

    // --- קלוריות היום ---
    const calResponse = await fitness.users.dataset.aggregate({
      userId: "me",
      requestBody: {
        aggregateBy: [{ dataTypeName: "com.google.calories.expended" }],
        bucketByTime: { durationMillis: day },
        startTimeMillis: now - day,
        endTimeMillis: now
      }
    });
    const calories = calResponse.data.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal ?? 0;

    // --- שינה 24 שעות אחרונות (דקות) ---
    const sleepResponse = await fitness.users.dataset.aggregate({
      userId: "me",
      requestBody: {
        aggregateBy: [{ dataTypeName: "com.google.sleep.segment" }],
        bucketByTime: { durationMillis: day },
        startTimeMillis: now - day,
        endTimeMillis: now
      }
    });
    let sleepMinutes = 0;
    const sleepPoints = sleepResponse.data.bucket?.[0]?.dataset?.[0]?.point || [];
    sleepPoints.forEach(p => {
      const durMin = (Number(p.endTimeNanos) - Number(p.startTimeNanos)) / 1e9 / 60;
      if (!Number.isNaN(durMin)) sleepMinutes += durMin;
    });

    // נחזיר תמיד ערכים מוגדרים (לא undefined)
    res.json({
      heartRate: safe(Math.round(heartRate)),
      steps: safe(steps, 0),
      calories: safe(Math.round(calories), 0),
      sleep: safe(Math.round(sleepMinutes), 0),
      bloodPressure: "--/--",       // אין ב-Google Fit
      trainingReadiness: "--"       // אין ב-Google Fit
    });

  } catch (err) {
    console.error("❌ שגיאה בשליפת נתונים:", err?.response?.data || err);
    // אם קיבלנו 401 מגוגל – נחזיר 401 כדי שהקליינט יפנה ל-/auth
    return res.status(401).json({ error: "NotAuthenticated" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
