// ─────────────────────────────────────────────────
// Notification Service — Core Business Logic
// Connects: Database + Cache + Queue + Priority Queue
// ─────────────────────────────────────────────────

const db = require("./database");
const cache = require("./cache");
const messageQueue = require("./messageQueue");
const { getTopKNotifications } = require("./priorityQueue");

// ─── Sample student list (for bulk notifications) ───
const SAMPLE_STUDENTS = [
    "22MIS0527", "22MIS0528", "22MIS0529",
    "22MIS0530", "22MIS0531", "22MIS0532",
    "22MIS0533", "22MIS0534", "22MIS0535",
    "22MIS0536"
];

// ─── Register queue worker (Stage 5) ───
// Worker processes bulk notification jobs asynchronously
messageQueue.onJob(async (jobData) => {

    const { message, type, students } = jobData;
    const targetStudents = students || SAMPLE_STUDENTS;

    console.log(`\n👷 Worker: Creating "${type}" notification for ${targetStudents.length} students...`);

    for (const studentId of targetStudents) {
        db.insertNotification({
            studentId,
            type,
            message,
            priority: type === "Placement" ? 3 : type === "Result" ? 2 : 1
        });

        // Invalidate cache for this student
        cache.del(`notifications:${studentId}`);
    }

    console.log(`👷 Worker: Done — ${targetStudents.length} notifications created`);
});

// ────────────────────────────────────────────
// Stage 1: CRUD Operations
// ────────────────────────────────────────────

// CREATE notification
function createNotification(data) {

    const notification = db.insertNotification({
        studentId: data.studentId,
        type: data.type || "Event",
        message: data.message,
        priority: data.type === "Placement" ? 3 : data.type === "Result" ? 2 : 1,
        createdAt: data.createdAt || new Date().toISOString()
    });

    // Invalidate cache for this student (Stage 4)
    cache.del(`notifications:${notification.studentId}`);

    return notification;
}

// READ notifications (with cache + pagination)
function getNotifications(studentId, options = {}) {

    const { page = 1, limit = 20 } = options;
    const cacheKey = `notifications:${studentId}:page${page}:limit${limit}`;

    // Stage 4: Check cache first
    const cached = cache.get(cacheKey);

    if (cached) {
        return { ...cached, source: "cache" };
    }

    // Cache miss — query database (Stage 2 & 3: uses indexed query)
    const result = db.findByStudentId(studentId, { page, limit });

    // Store in cache with 60-second TTL
    cache.set(cacheKey, {
        studentId,
        total: result.total,
        page: result.page,
        limit: result.limit,
        notifications: result.data
    }, 60);

    return {
        studentId,
        total: result.total,
        page: result.page,
        limit: result.limit,
        notifications: result.data,
        source: "database"
    };
}

// MARK AS READ
function markAsRead(notificationId) {

    const notification = db.markAsRead(notificationId);

    if (!notification) return null;

    // Invalidate cache
    cache.invalidatePattern(`notifications:${notification.studentId}`);

    return notification;
}

// DELETE
function deleteNotification(notificationId) {

    const notification = db.deleteNotification(notificationId);

    if (!notification) return null;

    // Invalidate cache
    cache.invalidatePattern(`notifications:${notification.studentId}`);

    return notification;
}

// ────────────────────────────────────────────
// Stage 5: Bulk Notification (Queue-based)
// ────────────────────────────────────────────

function sendBulkNotification(message, type, students) {

    // Non-blocking: add to queue and return immediately
    const job = messageQueue.enqueue({
        message,
        type,
        students
    });

    return {
        status: "queued",
        jobId: job.id,
        message: `Notification queued for ${(students || SAMPLE_STUDENTS).length} students`
    };
}

// ────────────────────────────────────────────
// Stage 6: Priority Inbox (Min-Heap)
// ────────────────────────────────────────────

function getTopNotifications(studentId, k = 10) {

    // Get all notifications for this student
    const all = db.findAllByStudentId(studentId);

    if (all.length === 0) {
        return { studentId, topNotifications: [], message: "No notifications found" };
    }

    // Use min-heap to get top K by priority score
    const topK = getTopKNotifications(all, k);

    return {
        studentId,
        totalNotifications: all.length,
        showing: topK.length,
        algorithm: "Min-Heap Priority Queue — O(n log k)",
        topNotifications: topK.map((n, i) => ({
            rank: i + 1,
            _id: n._id,
            type: n.type,
            message: n.message,
            priorityScore: n.score,
            isRead: n.isRead,
            createdAt: n.createdAt
        }))
    };
}

// ────────────────────────────────────────────
// System Stats
// ────────────────────────────────────────────

function getSystemStats() {
    return {
        database: db.getStats(),
        cache: cache.getStats(),
        queue: messageQueue.getStats()
    };
}

module.exports = {
    createNotification,
    getNotifications,
    markAsRead,
    deleteNotification,
    sendBulkNotification,
    getTopNotifications,
    getSystemStats,
    SAMPLE_STUDENTS
};
