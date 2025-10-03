import express from "express";
import fetch from "node-fetch";
import { google } from "googleapis";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 5000;

// ===== OAuth =====
const oauth2Client = new google.auth.OAuth2(
  "1060382255075-a51dbvl8uncects4gdq6q0j349p448f1.apps.googleusercontent.com", // Client ID
  "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", // Client Secret
  "https://jarvis-visual.onrender.com/oauth2callback" // Redirect URI
);

let tokens = null;

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

// ===== שלב 2: קבלת ה-code בחזרה =====
app.get("/oauth2callback", async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens: newTokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(newTokens);
    tokens = newTokens;
    console.log("✅ התחברות הצליחה, קיבלתי טוקן");
    res.send("✅ התחברת בהצלחה ל-Google Fit! עכשיו האתר יכול להביא נתוני בריאות אמיתיים.");
  } catch (err) {
    console.error("❌ שגיאה בקבלת טוקן:", err);
    res.status(500).send("שגיאה בהתחברות ל-Google Fit");
  }
});

// ===== שלב 3: Endpoint בריאות =====
app.get("/garmin", async (req, res) => {
  try {
    if (!tokens) {
      return res.status(401).json({ error: "User not authenticated. Go to /auth first." });
    }

    const fitness = google.fitness({ version: "v1", auth: oauth2Client });

    // טווח 24 שעות אחורה
    const startTime = Date.now() - 86400000;
    const endTime = Date.now();

    // --- דופק אחרון (10 דקות אחורה) ---
    const hrDataset = `${Date.now() - 600000}000000-${Date.now()}000000`;
    const hrResponse = await fitness.users.dataSources.datasets.get({
      userId: "me",
      dataSourceId: "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm",
      datasetId: hrDataset
    });
    const hrPoints = hrResponse.data.point || [];
    const heartRate = hrPoints.length > 0 ? hrPoints[hrPoints.length - 1].value[0].fpVal : "--";

    // --- צעדים ---
    const stepsResponse = await fitness.users.dataset.aggregate({
      userId: "me",
      requestBody: {
        aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startTime,
        endTimeMillis: endTime
      }
    });
    const steps = stepsResponse.data.bucket[0]?.dataset[0]?.point[0]?.value[0]?.intVal || 0;

    // --- קלוריות ---
    const calResponse = await fitness.users.dataset.aggregate({
      userId: "me",
      requestBody: {
        aggregateBy: [{ dataTypeName: "com.google.calories.expended" }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startTime,
        endTimeMillis: endTime
      }
    });
    const calories = calResponse.data.bucket[0]?.dataset[0]?.point[0]?.value[0]?.fpVal || 0;

    // --- שינה (סה"כ דקות שינה ב-24 שעות אחרונות) ---
    const sleepResponse = await fitness.users.dataset.aggregate({
      userId: "me",
      requestBody: {
        aggregateBy: [{ dataTypeName: "com.google.sleep.segment" }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startTime,
        endTimeMillis: endTime
      }
    });
    let sleepMinutes = 0;
    if (sleepResponse.data.bucket?.[0]?.dataset?.[0]?.point) {
      sleepResponse.data.bucket[0].dataset[0].point.forEach(p => {
        sleepMinutes += (p.endTimeNanos - p.startTimeNanos) / 1e9 / 60;
      });
    }

    res.json({
      heartRate,
      steps,
      calories: Math.round(calories),
      sleep: Math.round(sleepMinutes),
      bloodPressure: "--/--",       // Google Fit לא מספק
      trainingReadiness: "--"       // אין ב-Google Fit
    });

  } catch (err) {
    console.error("❌ שגיאה בשליפת נתונים:", err);
    res.status(500).json({ error: "Failed to fetch Google Fit data" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
