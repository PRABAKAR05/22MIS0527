require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
    sendNotification,
    getNotifications,
    setPreferences,
    getPreferences,
    NOTIFICATION_TYPES
} = require("./notificationService");

const app = express();

app.use(cors());
app.use(express.json());

// ─── Auth middleware ───
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.split(" ")[1];

    if (token !== process.env.TOKEN) {
        return res.status(403).json({ error: "Invalid token" });
    }

    next();
}

// ─── Health check ───
app.get("/", (req, res) => {
    res.json({
        service: "Notification System",
        status: "running",
        version: "1.0.0",
        endpoints: [
            "POST /notifications/send",
            "GET  /notifications/:depotId",
            "POST /notifications/preferences",
            "GET  /notifications/preferences/:depotId"
        ]
    });
});

// ─── POST /notifications/send ───
app.post("/notifications/send", authenticate, async (req, res) => {
    try {
        const { depotId, type, channels, payload } = req.body;

        // Validation
        if (!depotId || !type) {
            return res.status(400).json({
                error: "Missing required fields: depotId and type"
            });
        }

        if (!NOTIFICATION_TYPES[type]) {
            return res.status(400).json({
                error: `Invalid notification type: ${type}`,
                validTypes: Object.keys(NOTIFICATION_TYPES)
            });
        }

        const result = await sendNotification(
            depotId,
            type,
            channels || ["in-app"],
            payload || {}
        );

        res.status(result.success ? 200 : 200).json(result);

    } catch (error) {
        console.error("Error sending notification:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── GET /notifications/:depotId ───
app.get("/notifications/:depotId", authenticate, (req, res) => {
    const depotId = parseInt(req.params.depotId);

    if (isNaN(depotId)) {
        return res.status(400).json({ error: "depotId must be a number" });
    }

    const depotNotifications = getNotifications(depotId);

    res.json({
        depotId,
        count: depotNotifications.length,
        notifications: depotNotifications
    });
});

// ─── POST /notifications/preferences ───
app.post("/notifications/preferences", authenticate, (req, res) => {
    const { depotId, channels, emailAddress, webhookUrl, minPriority } = req.body;

    if (!depotId) {
        return res.status(400).json({ error: "Missing required field: depotId" });
    }

    const prefs = setPreferences(depotId, {
        channels,
        emailAddress,
        webhookUrl,
        minPriority
    });

    res.json({
        success: true,
        preferences: prefs
    });
});

// ─── GET /notifications/preferences/:depotId ───
app.get("/notifications/preferences/:depotId", authenticate, (req, res) => {
    const depotId = parseInt(req.params.depotId);

    if (isNaN(depotId)) {
        return res.status(400).json({ error: "depotId must be a number" });
    }

    res.json({
        preferences: getPreferences(depotId)
    });
});

// ─── Start server ───
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`\n🔔 Notification System running on http://localhost:${PORT}`);
    console.log(`   Endpoints:`);
    console.log(`   POST /notifications/send`);
    console.log(`   GET  /notifications/:depotId`);
    console.log(`   POST /notifications/preferences`);
    console.log(`   GET  /notifications/preferences/:depotId\n`);
});

module.exports = app;
