const express = require("express");
const fetch = require("node-fetch");
const { google } = require("googleapis");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 5000;

// ===== OAuth הגדרות =====
const oauth2Client = new google.auth.OAuth2(
  "1060382255075-a51dbvl8uncects4gdq6q0j349p448f1.apps.googleusercontent.com", // Client ID שלך
  "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", // Client Secret שלך
  "https://jarvis-visual.onrender.com/oauth2callback" // הכתובת הרשומה ב-Google Console
);

let tokens = null;

app.use(bodyParser.json());
app.use(express.static("public"));

// ===== שלב 1: התחברות ל-Google Fit =====
app.get("/auth", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/fitness.heart_rate.read",
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.sleep.read"
    ],
  });
  res.redirect(url);
});

// ===== שלב 2: קבלת ה-code בחזרה =====
app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  const { tokens: newTokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(newTokens);
  tokens = newTokens;
  console.log("✅ התחברות הצליחה, קיבלתי טוקן");
  res.send("✅ התחברת בהצלחה! עכשיו האתר יכול להביא נתוני בריאות מה-Google Fit שלך.");
});

// ===== שלב 3: Endpoint שמחזיר דופק אמיתי =====
app.get("/garmin", async (req, res) => {
  try {
    if (!tokens) {
      return res.status(401).json({ error: "User not authenticated. Go to /auth first." });
    }

    const fitness = google.fitness({ version: "v1", auth: oauth2Client });

    const datasetId = `${Date.now() - 3600000}000000-${Date.now()}000000`; // שעה אחרונה
    const response = await fitness.users.dataSources.datasets.get({
      userId: "me",
      dataSourceId: "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm",
      datasetId: datasetId
    });

    const points = response.data.point || [];
    const hr = points.length > 0 ? points[points.length - 1].value[0].fpVal : "--";

    res.json({
      heartRate: hr,
      bloodPressure: "--/--", // Google Fit לא מחזיר לחץ דם
      trainingReadiness: "--" // אין ב-Google Fit, רק ב-Garmin
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Google Fit data" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
