// ─────────────────────────────────────────────────
// Stage 2 & 3: In-Memory Database (simulates MongoDB)
// with Composite Index support for query optimization
// ─────────────────────────────────────────────────

const crypto = require("crypto");

class Database {

    constructor() {
        // Collections (simulating MongoDB collections)
        this.collections = {
            notifications: [],
            students: []
        };

        // Indexes (simulating MongoDB indexes)
        // Stage 3: Composite indexes for query optimization
        this.indexes = {
            // Index: (studentId, isRead, createdAt DESC)
            // Speeds up: GET /notifications/:studentId?isRead=false
            notifications_studentId_isRead_createdAt: new Map(),

            // Index: (type, createdAt DESC)
            // Speeds up: Placement notifications from last 7 days
            notifications_type_createdAt: new Map()
        };
    }

    // ─── Generate ObjectId (simulating MongoDB _id) ───
    generateId() {
        return crypto.randomUUID();
    }

    // ─── INSERT ───
    insertNotification(doc) {

        const notification = {
            _id: this.generateId(),
            studentId: doc.studentId,
            type: doc.type || "Event",
            message: doc.message,
            isRead: false,
            priority: doc.priority || 1,
            createdAt: doc.createdAt || new Date().toISOString()
        };

        // Insert into collection
        this.collections.notifications.push(notification);

        // Update composite index: (studentId, isRead, createdAt)
        const indexKey1 = `${notification.studentId}:${notification.isRead}`;

        if (!this.indexes.notifications_studentId_isRead_createdAt.has(indexKey1)) {
            this.indexes.notifications_studentId_isRead_createdAt.set(indexKey1, []);
        }

        this.indexes.notifications_studentId_isRead_createdAt.get(indexKey1).push(notification._id);

        // Update composite index: (type, createdAt)
        const indexKey2 = notification.type;

        if (!this.indexes.notifications_type_createdAt.has(indexKey2)) {
            this.indexes.notifications_type_createdAt.set(indexKey2, []);
        }

        this.indexes.notifications_type_createdAt.get(indexKey2).push(notification._id);

        return notification;
    }

    // ─── FIND by studentId (uses index) ───
    findByStudentId(studentId, options = {}) {

        const { page = 1, limit = 20, isRead } = options;

        // Stage 3: Use composite index instead of full scan
        let indexKey;

        if (isRead !== undefined) {
            indexKey = `${studentId}:${isRead}`;
        }

        let results;

        if (indexKey && this.indexes.notifications_studentId_isRead_createdAt.has(indexKey)) {

            // ✅ INDEX SCAN — O(k) where k = matching docs
            const ids = this.indexes.notifications_studentId_isRead_createdAt.get(indexKey);

            results = ids.map(id =>
                this.collections.notifications.find(n => n._id === id)
            ).filter(Boolean);

        } else {
            // Filter from all notifications for this student
            results = this.collections.notifications.filter(n => {
                let match = n.studentId === studentId;

                if (isRead !== undefined) match = match && n.isRead === isRead;

                return match;
            });
        }

        // Sort by createdAt DESC (index already covers this order)
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Stage 4: Pagination — only return requested page
        const total = results.length;
        const start = (page - 1) * limit;
        const paginated = results.slice(start, start + limit);

        return {
            total,
            page,
            limit,
            data: paginated
        };
    }

    // ─── FIND by type and date range (uses index) ───
    findByTypeAndDate(type, daysAgo = 7) {

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysAgo);

        // Stage 3: Use type index
        const ids = this.indexes.notifications_type_createdAt.get(type) || [];

        return ids.map(id =>
            this.collections.notifications.find(n => n._id === id)
        ).filter(n => n && new Date(n.createdAt) >= cutoff)
         .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // ─── FIND ONE by _id ───
    findById(id) {
        return this.collections.notifications.find(n => n._id === id) || null;
    }

    // ─── UPDATE — Mark as read ───
    markAsRead(id) {

        const notification = this.findById(id);

        if (!notification) return null;

        // Remove from old index (isRead: false)
        const oldKey = `${notification.studentId}:false`;
        const oldIndex = this.indexes.notifications_studentId_isRead_createdAt.get(oldKey);

        if (oldIndex) {
            const pos = oldIndex.indexOf(id);
            if (pos !== -1) oldIndex.splice(pos, 1);
        }

        // Update document
        notification.isRead = true;

        // Add to new index (isRead: true)
        const newKey = `${notification.studentId}:true`;

        if (!this.indexes.notifications_studentId_isRead_createdAt.has(newKey)) {
            this.indexes.notifications_studentId_isRead_createdAt.set(newKey, []);
        }

        this.indexes.notifications_studentId_isRead_createdAt.get(newKey).push(id);

        return notification;
    }

    // ─── DELETE ───
    deleteNotification(id) {

        const notification = this.findById(id);

        if (!notification) return null;

        // Remove from collection
        const index = this.collections.notifications.findIndex(n => n._id === id);
        this.collections.notifications.splice(index, 1);

        // Remove from indexes
        const indexKey1 = `${notification.studentId}:${notification.isRead}`;
        const arr1 = this.indexes.notifications_studentId_isRead_createdAt.get(indexKey1);

        if (arr1) {
            const pos1 = arr1.indexOf(id);
            if (pos1 !== -1) arr1.splice(pos1, 1);
        }

        const arr2 = this.indexes.notifications_type_createdAt.get(notification.type);

        if (arr2) {
            const pos2 = arr2.indexOf(id);
            if (pos2 !== -1) arr2.splice(pos2, 1);
        }

        return notification;
    }

    // ─── Get all notifications for a student (no pagination, for priority calc) ───
    findAllByStudentId(studentId) {
        return this.collections.notifications
            .filter(n => n.studentId === studentId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // ─── Stats ───
    getStats() {
        return {
            totalNotifications: this.collections.notifications.length,
            indexEntries: {
                studentId_isRead_createdAt: this.indexes.notifications_studentId_isRead_createdAt.size,
                type_createdAt: this.indexes.notifications_type_createdAt.size
            }
        };
    }
}

module.exports = new Database();
