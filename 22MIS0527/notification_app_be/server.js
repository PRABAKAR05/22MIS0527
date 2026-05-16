// ─────────────────────────────────────────────────────────────
// Campus Notification System — Express.js Server
// Covers all 6 stages of the evaluation task
//
// Stage 1: REST API Design (CRUD endpoints)
// Stage 2: Database Design (MongoDB-style in-memory DB)
// Stage 3: Query Optimization (composite indexes)
// Stage 4: Database Overload Prevention (Redis-style cache)
// Stage 5: Bulk Notifications (Queue-based async processing)
// Stage 6: Priority Inbox (Min-Heap, Top-K DSA)
// ─────────────────────────────────────────────────────────────

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
    createNotification,
    getNotifications,
    markAsRead,
    deleteNotification,
    sendBulkNotification,
    getTopNotifications,
    getSystemStats
} = require("./notificationService");

const app = express();

app.use(cors());
app.use(express.json());

// ─── Health Check ───
app.get("/", (req, res) => {
    res.json({
        service: "Campus Notification System",
        version: "2.0.0",
        rollNo: "22MIS0527",
        stages: {
            "Stage 1": "REST API Design",
            "Stage 2": "Database Design (MongoDB-simulated)",
            "Stage 3": "Query Optimization (Composite Indexes)",
            "Stage 4": "Cache Layer (Redis-simulated)",
            "Stage 5": "Bulk Notifications (Queue-based)",
            "Stage 6": "Priority Inbox (Min-Heap)"
        },
        endpoints: [
            "POST   /notifications              → Create notification",
            "GET    /notifications/:studentId    → Get notifications (cached + paginated)",
            "PATCH  /notifications/:id/read      → Mark as read",
            "DELETE /notifications/:id           → Delete notification",
            "GET    /notifications/:studentId/top→ Top 10 priority (Min-Heap)",
            "POST   /notifications/bulk          → Send to all students (queued)",
            "GET    /stats                       → System stats"
        ]
    });
});

// ──────────────────────────────────────────────────
// Stage 1: REST API Endpoints (CRUD)
// ──────────────────────────────────────────────────

// POST /notifications — Create a new notification
app.post("/notifications", (req, res) => {

    const { studentId, type, message, createdAt } = req.body;

    if (!studentId || !message) {
        return res.status(400).json({
            error: "Missing required fields: studentId and message"
        });
    }

    const notification = createNotification({
        studentId,
        type: type || "Event",
        message,
        createdAt
    });

    console.log(`\n✅ Created: [${notification.type}] "${notification.message}" → ${studentId}`);

    res.status(201).json({
        success: true,
        notification
    });
});

// GET /notifications/:studentId — Get notifications (with cache + pagination)
app.get("/notifications/:studentId", (req, res) => {

    const { studentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = getNotifications(studentId, { page, limit });

    console.log(`\n📋 Fetched notifications for ${studentId} — source: ${result.source}`);

    res.json(result);
});

// PATCH /notifications/:id/read — Mark notification as read
app.patch("/notifications/:id/read", (req, res) => {

    const { id } = req.params;

    const notification = markAsRead(id);

    if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
    }

    console.log(`\n👁️ Marked as read: ${id}`);

    res.json({
        success: true,
        message: "Notification marked as read",
        notification
    });
});

// DELETE /notifications/:id — Delete notification
app.delete("/notifications/:id", (req, res) => {

    const { id } = req.params;

    const notification = deleteNotification(id);

    if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
    }

    console.log(`\n🗑️ Deleted: ${id}`);

    res.json({
        success: true,
        message: "Notification deleted",
        notification
    });
});

// ──────────────────────────────────────────────────
// Stage 5: Bulk Notification (Queue-based)
// ──────────────────────────────────────────────────

app.post("/notifications/bulk", (req, res) => {

    const { message, type, students } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Missing required field: message" });
    }

    const result = sendBulkNotification(message, type || "Event", students);

    res.json(result);
});

// ──────────────────────────────────────────────────
// Stage 6: Priority Inbox (Top-K using Min-Heap)
// ──────────────────────────────────────────────────

app.get("/notifications/:studentId/top", (req, res) => {

    const { studentId } = req.params;
    const k = parseInt(req.query.k) || 10;

    const result = getTopNotifications(studentId, k);

    console.log(`\n🏆 Top ${k} priority notifications for ${studentId}`);

    res.json(result);
});

// ──────────────────────────────────────────────────
// System Stats
// ──────────────────────────────────────────────────

app.get("/stats", (req, res) => {
    res.json(getSystemStats());
});

// ──────────────────────────────────────────────────
// Seed sample data for demonstration
// ──────────────────────────────────────────────────

function seedData() {

    console.log("\n📦 Seeding sample notifications...\n");

    const sampleNotifications = [
        { studentId: "22MIS0527", type: "Placement", message: "Microsoft Hiring Drive — May 20" },
        { studentId: "22MIS0527", type: "Placement", message: "Google Campus Placement — May 22" },
        { studentId: "22MIS0527", type: "Placement", message: "Amazon SDE Intern — Apply by May 25" },
        { studentId: "22MIS0527", type: "Result",    message: "Semester 6 Results Published" },
        { studentId: "22MIS0527", type: "Result",    message: "Internal Assessment Marks Updated" },
        { studentId: "22MIS0527", type: "Event",     message: "Hackathon Registration Open" },
        { studentId: "22MIS0527", type: "Event",     message: "Cultural Fest — June 1" },
        { studentId: "22MIS0527", type: "Event",     message: "Workshop on AI/ML — May 28" },
        { studentId: "22MIS0527", type: "Placement", message: "TCS NQT Results Announced" },
        { studentId: "22MIS0527", type: "Result",    message: "CGPA Updated for Semester 5" },
        { studentId: "22MIS0527", type: "Event",     message: "Sports Day — May 30" },
        { studentId: "22MIS0527", type: "Placement", message: "Infosys InfyTQ Registration" },
        { studentId: "22MIS0527", type: "Event",     message: "Fee Payment Deadline — June 5" },
        { studentId: "22MIS0527", type: "Result",    message: "Lab Exam Schedule Released" },
        { studentId: "22MIS0527", type: "Placement", message: "Wipro Elite Hiring — June 10" },
    ];

    // Insert with slightly different timestamps for recency scoring
    sampleNotifications.forEach((n, i) => {

        const date = new Date();
        date.setHours(date.getHours() - i * 2); // Each one 2 hours older

        createNotification({
            ...n,
            createdAt: date.toISOString()
        });
    });

    console.log(`📦 Seeded ${sampleNotifications.length} notifications for 22MIS0527\n`);
}

// ──────────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log("═".repeat(55));
    console.log("  🔔 Campus Notification System");
    console.log("  Roll No: 22MIS0527");
    console.log(`  Server:  http://localhost:${PORT}`);
    console.log("═".repeat(55));
    console.log("\n  Stages Implemented:");
    console.log("  1️⃣  REST API Design (CRUD endpoints)");
    console.log("  2️⃣  Database Design (MongoDB-simulated)");
    console.log("  3️⃣  Query Optimization (Composite Indexes)");
    console.log("  4️⃣  Cache Layer (Redis-simulated, TTL 60s)");
    console.log("  5️⃣  Bulk Notifications (Queue-based async)");
    console.log("  6️⃣  Priority Inbox (Min-Heap, Top-K)\n");
    console.log("═".repeat(55));

    // Seed sample data
    seedData();

    // Show Priority Inbox demo
    const topResult = getTopNotifications("22MIS0527", 10);

    console.log("\n🏆 PRIORITY INBOX DEMO (Top 10 for 22MIS0527):");
    console.log("─".repeat(55));

    topResult.topNotifications.forEach(n => {
        console.log(
            `  ${n.rank}. [${n.type}] ${n.message} (Score: ${n.priorityScore})`
        );
    });

    console.log("─".repeat(55));
    console.log(`  Algorithm: ${topResult.algorithm}`);
    console.log(`  Total notifications: ${topResult.totalNotifications}`);
    console.log(`  Showing top: ${topResult.showing}\n`);
});

module.exports = app;
