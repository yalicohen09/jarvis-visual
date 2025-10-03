import express from "express";
import fetch from "node-fetch";
import { google } from "googleapis";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 5000;

// ===== OAuth =====
const oauth2Client = new google.auth.OAuth2(
  "1060382255075-a51dbvl8uncects4gdq6q0j349p448f1.apps.googleusercontent.com", // Client ID
  "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",                                       // Client Secret
  "https://jarvis-visual.onrender.com/oauth2callback"                           // Redirect URI
);

// אם הגדרת GOOGLE_REFRESH_TOKEN ב-Render, נטעין אותו כדי שהשרת יישאר מחובר גם אחרי restart
if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  console.log("🔄 Loaded refresh_token from env; server will auto-refresh access tokens.");
}

app.use(bodyParser.json());
app.use(express.static("public"));

// ===== סטטוס התחברות =====
app.get("/auth/status", async (req, res) => {
  try {
    // אם יש refresh_token או access_token — ננסה להוציא access token תקף
    if (oauth2Client.credentials?.refresh_token || oauth2Client.credentials?.access_token) {
      // פעולה זו תרענן/תוודא טוקן תקף
      await oauth2Client.getAccessToken();
      return res.json({ authenticated: true });
    }
    return res.json({ authenticated: false });
  } catch (e) {
    return res.json({ authenticated: false });
  }
});

// ===== התחברות ל-Google Fit =====
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

// ===== קבלת code ושמירת refresh_token ללוגים (תעתיק ל-ENV) =====
app.get("/oauth2callback", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // אם קיבלנו refresh_token בהתחברות הראשונה—נדפיס בלוג כדי שתעתיק ל-Render Env
    if (tokens.refresh_token) {
      console.log("✅ SAVE THIS IN RENDER ENV AS GOOGLE_REFRESH_TOKEN:");
      console.log(tokens.refresh_token);
    } else {
      console.log("ℹ️ No refresh_token returned (possibly already granted).");
    }

    res.send("✅ התחברת בהצלחה ל-Google Fit! אם זו הפעם הראשונה, פתח את הלוגים של Render והעתק את ה-refresh_token למשתנה סביבה בשם GOOGLE_REFRESH_TOKEN.");
  } catch (err) {
    console.error("❌ שגיאה בקבלת טוקן:", err?.response?.data || err);
    res.status(500).send("שגיאה בהתחברות ל-Google Fit");
  }
});

// ===== עזר: ערכי דיפולט =====
const safe = (v, fallback = "--") =>
  (v === undefined || v === null || Number.isNaN(v)) ? fallback : v;

// ===== Endpoint נתוני בריאות =====
app.get("/garmin", async (req, res) => {
  try {
    // אם אין לנו אף טוקן—נודיע לקליינט שהוא לא מחובר
    if (!oauth2Client.credentials?.access_token && !oauth2Client.credentials?.refresh_token) {
      return res.status(401).json({ error: "NotAuthenticated" });
    }

    // ודא access token תקף (מרענן אוטומטית אם יש refresh_token)
    await oauth2Client.getAccessToken();

    const fitness = google.fitness({ version: "v1", auth: oauth2Client });

    const now = Date.now();
    const tenMin = 10 * 60 * 1000;
    const day = 24 * 60 * 60 * 1000;

    // --- דופק אחרון (10 דקות אחורה) ---
    const hrDataset = `${(now - tenMin)}000000-${now}000000`;
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

    // --- שינה 24 שעות אחרונות (בדקות) ---
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

    res.json({
      heartRate: safe(Math.round(heartRate)),
      steps: safe(steps, 0),
      calories: safe(Math.round(calories), 0),
      sleep: safe(Math.round(sleepMinutes), 0),
      bloodPressure: "--/--",
      trainingReadiness: "--"
    });
  } catch (err) {
    console.error("❌ שגיאה בשליפת נתונים:", err?.response?.data || err);
    // אם קיבלנו 401/invalid_grant — נבקש מהקליינט להתחבר מחדש
    return res.status(401).json({ error: "NotAuthenticated" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
