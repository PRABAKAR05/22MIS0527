const crypto = require("crypto");

// ─── Priority levels ───
const PRIORITY = {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL"
};

const PRIORITY_ORDER = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3
};

// ─── Notification types ───
const NOTIFICATION_TYPES = {
    SCHEDULE_GENERATED: { priority: PRIORITY.LOW },
    HIGH_IMPACT_TASK: { priority: PRIORITY.HIGH },
    UPCOMING_MAINTENANCE: { priority: PRIORITY.MEDIUM },
    OVERDUE_TASK: { priority: PRIORITY.CRITICAL },
    DEPOT_SUMMARY: { priority: PRIORITY.LOW }
};

// ─── In-memory stores ───
const notifications = [];     // All notification history
const preferences = new Map(); // depotId -> preferences object

// ─── Helper: generate UUID ───
function generateId() {
    return crypto.randomUUID();
}

// ─── Get priority for a notification type ───
function getPriority(type) {
    return NOTIFICATION_TYPES[type]?.priority || PRIORITY.LOW;
}

// ─── Check if notification should be sent based on depot preferences ───
function shouldSend(depotId, type) {
    const prefs = preferences.get(depotId);

    if (!prefs) return true; // no preferences = send everything

    const typePriority = PRIORITY_ORDER[getPriority(type)];
    const minPriority = PRIORITY_ORDER[prefs.minPriority || "LOW"];

    return typePriority >= minPriority;
}

// ─── Get active channels for a depot ───
function getActiveChannels(depotId, requestedChannels) {
    const prefs = preferences.get(depotId);

    if (!prefs) {
        // Default: only in-app
        return requestedChannels.filter(ch => ch === "in-app");
    }

    return requestedChannels.filter(ch => prefs.channels[ch] === true);
}

// ─── Channel Handlers ───

// In-App: console log + store in memory
function deliverInApp(notification) {
    const timestamp = new Date().toISOString();

    console.log(
        `\n📢 [${notification.priority}] [Depot ${notification.depotId}] ${notification.type}`
    );
    console.log(`   Message: ${notification.message}`);
    console.log(`   Time: ${timestamp}`);

    if (notification.payload?.taskId) {
        console.log(
            `   Task: ${notification.payload.taskId} | Impact: ${notification.payload.impact} | Duration: ${notification.payload.duration}`
        );
    }

    return "delivered";
}

// Webhook: HTTP POST to configured URL
async function deliverWebhook(notification, webhookUrl) {
    if (!webhookUrl) return "skipped";

    const axios = require("axios");
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await axios.post(webhookUrl, {
                event: notification.type,
                depotId: notification.depotId,
                priority: notification.priority,
                message: notification.message,
                payload: notification.payload,
                timestamp: notification.createdAt
            }, {
                timeout: 5000,
                headers: { "Content-Type": "application/json" }
            });

            return "delivered";

        } catch (error) {
            console.log(
                `   ⚠ Webhook attempt ${attempt}/${maxRetries} failed: ${error.message}`
            );

            if (attempt < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    return "failed";
}

// Email: send via Nodemailer
async function deliverEmail(notification, emailAddress) {
    if (!emailAddress) return "skipped";

    try {
        const nodemailer = require("nodemailer");

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const html = `
            <h2>🔧 Vehicle Maintenance Notification</h2>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
                <tr><td><strong>Type</strong></td><td>${notification.type}</td></tr>
                <tr><td><strong>Priority</strong></td><td>${notification.priority}</td></tr>
                <tr><td><strong>Depot ID</strong></td><td>${notification.depotId}</td></tr>
                <tr><td><strong>Message</strong></td><td>${notification.message}</td></tr>
                ${notification.payload?.taskId
                    ? `<tr><td><strong>Task ID</strong></td><td>${notification.payload.taskId}</td></tr>
                       <tr><td><strong>Impact</strong></td><td>${notification.payload.impact}</td></tr>
                       <tr><td><strong>Duration</strong></td><td>${notification.payload.duration}h</td></tr>`
                    : ""
                }
            </table>
            <p style="color:#888;font-size:12px;">Sent at ${notification.createdAt}</p>
        `;

        await transporter.sendMail({
            from: process.env.SMTP_USER || "notifications@fleet.com",
            to: emailAddress,
            subject: `[${notification.priority}] ${notification.type} — Depot ${notification.depotId}`,
            html
        });

        return "delivered";

    } catch (error) {
        console.log(`   ⚠ Email delivery failed: ${error.message}`);
        return "failed";
    }
}

// ─── Main notification sender ───
async function sendNotification(depotId, type, channels, payload) {

    // Validate type
    if (!NOTIFICATION_TYPES[type]) {
        throw new Error(`Invalid notification type: ${type}`);
    }

    // Check if priority meets depot threshold
    if (!shouldSend(depotId, type)) {
        return {
            success: false,
            reason: "Notification priority below depot minimum threshold"
        };
    }

    const priority = getPriority(type);
    const activeChannels = getActiveChannels(depotId, channels || ["in-app"]);

    const notification = {
        id: generateId(),
        depotId,
        type,
        priority,
        message: payload.message || `${type} for Depot ${depotId}`,
        payload,
        channels: activeChannels,
        deliveryStatus: {},
        read: false,
        createdAt: new Date().toISOString()
    };

    // Deliver to each active channel
    const prefs = preferences.get(depotId);

    for (const channel of activeChannels) {
        switch (channel) {
            case "in-app":
                notification.deliveryStatus["in-app"] = deliverInApp(notification);
                break;
            case "webhook":
                notification.deliveryStatus["webhook"] = await deliverWebhook(
                    notification,
                    prefs?.webhookUrl
                );
                break;
            case "email":
                notification.deliveryStatus["email"] = await deliverEmail(
                    notification,
                    prefs?.emailAddress
                );
                break;
            default:
                notification.deliveryStatus[channel] = "skipped";
        }
    }

    // Store in history
    notifications.push(notification);

    return {
        success: true,
        notificationId: notification.id,
        deliveryStatus: notification.deliveryStatus
    };
}

// ─── Get notifications for a depot ───
function getNotifications(depotId) {
    return notifications
        .filter(n => n.depotId === depotId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ─── Set depot preferences ───
function setPreferences(depotId, prefs) {
    preferences.set(depotId, {
        depotId,
        channels: prefs.channels || { "in-app": true, email: false, webhook: false },
        emailAddress: prefs.emailAddress || "",
        webhookUrl: prefs.webhookUrl || "",
        minPriority: prefs.minPriority || "LOW"
    });

    return preferences.get(depotId);
}

// ─── Get depot preferences ───
function getPreferences(depotId) {
    return preferences.get(depotId) || {
        depotId,
        channels: { "in-app": true, email: false, webhook: false },
        emailAddress: "",
        webhookUrl: "",
        minPriority: "LOW"
    };
}

module.exports = {
    sendNotification,
    getNotifications,
    setPreferences,
    getPreferences,
    NOTIFICATION_TYPES,
    PRIORITY
};
