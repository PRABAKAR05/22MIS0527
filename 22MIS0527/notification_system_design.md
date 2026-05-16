# Campus Notification System — Design Document

**Roll No:** 22MIS0527  
**Name:** Prabakar

---

## Stage 1 — REST API Design

### Overview

The notification system exposes RESTful APIs for CRUD operations on notifications.

### Endpoints

| Method | Endpoint                        | Description                      |
|--------|---------------------------------|----------------------------------|
| POST   | `/notifications`                | Create a new notification        |
| GET    | `/notifications/:studentId`     | Get all notifications for student|
| PATCH  | `/notifications/:id/read`       | Mark notification as read        |
| DELETE | `/notifications/:id`            | Delete a notification            |
| GET    | `/notifications/:studentId/top` | Get top 10 priority notifications|
| POST   | `/notifications/bulk`           | Send to all students (queue)     |

### Request/Response Examples

#### POST /notifications
```json
// Request
{
  "studentId": "22MIS0527",
  "type": "Placement",
  "message": "TCS Hiring Drive Tomorrow at 10 AM",
  "createdAt": "2026-05-16T10:00:00Z"
}

// Response (201)
{
  "success": true,
  "notification": {
    "_id": "uuid-123",
    "studentId": "22MIS0527",
    "type": "Placement",
    "message": "TCS Hiring Drive Tomorrow at 10 AM",
    "isRead": false,
    "createdAt": "2026-05-16T10:00:00Z"
  }
}
```

#### GET /notifications/:studentId
```json
// Response (200)
{
  "studentId": "22MIS0527",
  "total": 25,
  "page": 1,
  "limit": 20,
  "notifications": [...]
}
```

#### PATCH /notifications/:id/read
```json
// Response (200)
{
  "success": true,
  "message": "Notification marked as read"
}
```

#### DELETE /notifications/:id
```json
// Response (200)
{
  "success": true,
  "message": "Notification deleted"
}
```

---

## Stage 2 — Database Design

### Database Choice: MongoDB (NoSQL)

**Why MongoDB over SQL?**

| Factor             | MongoDB (NoSQL)         | SQL (MySQL/PostgreSQL)   |
|--------------------|-------------------------|--------------------------|
| Write throughput    | ✅ High                 | ❌ Moderate              |
| Schema flexibility  | ✅ Flexible             | ❌ Rigid                 |
| Horizontal scaling  | ✅ Native sharding      | ❌ Complex               |
| Notification data   | ✅ JSON-like documents  | ❌ Requires JOINs        |
| Read at scale       | ✅ Fast with indexes    | ✅ Fast with indexes     |

Notifications are:
- **Write-heavy** — thousands created daily
- **Flexible** — different types have different metadata
- **Time-series-like** — ordered by creation time
- **No complex JOINs** — simple key-value lookups

### Collections

#### students collection
```json
{
  "_id": "ObjectId",
  "rollNo": "22MIS0527",
  "name": "Prabakar",
  "email": "ppra ba0705@gmail.com",
  "department": "MIS"
}
```

#### notifications collection
```json
{
  "_id": "ObjectId",
  "studentId": "22MIS0527",
  "type": "Placement",
  "message": "Amazon Hiring Drive — 20th May",
  "isRead": false,
  "priority": 3,
  "createdAt": "2026-05-16T10:00:00Z"
}
```

---

## Stage 3 — Query Optimization

### Problem

With 5 million+ notification rows, this query is **slow**:

```sql
SELECT * FROM notifications
WHERE studentID = '22MIS0527'
  AND isRead = false
ORDER BY createdAt DESC;
```

**Why?** Without indexes, the DB performs a **full table scan** — checking every row.

### Solution: Composite Index

```javascript
db.notifications.createIndex({
    studentId: 1,
    isRead: 1,
    createdAt: -1
});
```

**Why this index order?**

1. `studentId` — **equality filter** (narrows to one student's data)
2. `isRead` — **equality filter** (narrows to unread only)
3. `createdAt: -1` — **sort** (returns newest first without in-memory sort)

This is called a **covered query** — the DB uses only the index, never touching the actual documents.

### Should every column have an index?

**❌ NO**, because indexes:
- Consume **extra storage** (each index is a separate B-tree)
- **Slow down writes** (every INSERT/UPDATE must update all indexes)
- Increase **maintenance overhead**

**Rule:** Only index columns used in WHERE, ORDER BY, or JOIN clauses of frequent queries.

### Additional Index for Placement Notifications (last 7 days)

```javascript
db.notifications.createIndex({
    type: 1,
    createdAt: -1
});
```

For the query:
```sql
SELECT * FROM notifications
WHERE type = 'Placement'
  AND createdAt >= NOW() - INTERVAL 7 DAY;
```

---

## Stage 4 — Handling Database Overload

### Problem

Every time a student refreshes:
```
App → Database Query → Response
```

With 50,000 students refreshing = **50,000 DB queries** per minute → **Database overload**.

### Solution 1: Redis Cache

```
User Request
     ↓
 Redis Cache ← Check here first
     ↓ (cache miss)
 MongoDB ← Only if not in cache
     ↓
 Store in Redis (TTL: 60s)
     ↓
 Return Response
```

**Implementation:**
```javascript
async function getNotifications(studentId) {
    // 1. Check cache
    const cached = cache.get(`notifications:${studentId}`);
    if (cached) return cached; // Cache HIT

    // 2. Cache MISS → query DB
    const data = await db.find({ studentId });

    // 3. Store in cache with TTL
    cache.set(`notifications:${studentId}`, data, 60);

    return data;
}
```

### Solution 2: Pagination

Instead of loading 10,000 notifications:

```javascript
// Load only 20 per page
GET /notifications/22MIS0527?page=1&limit=20
```

### Solution 3: WebSockets

Push notifications **instantly** instead of polling:

```javascript
// Server pushes to connected clients
io.to(studentId).emit("notification", newNotification);
```

### Cache Invalidation

When a new notification is created → **clear that student's cache**:

```javascript
cache.del(`notifications:${studentId}`);
```

---

## Stage 5 — Notify All Students (Bulk)

### Problem

Admin sends "Placement Drive Alert" to 50,000 students.

### ❌ Bad Approach (Synchronous Loop)
```javascript
for (const student of allStudents) {
    await sendEmail(student); // BLOCKING — takes hours!
}
```

**Problems:** Very slow, blocks server, one failure stops everything.

### ✅ Good Approach: Queue-Based Architecture

```
Admin API (POST /notifications/bulk)
        ↓
   Message Queue (BullMQ / RabbitMQ / Kafka)
        ↓
   Worker 1   Worker 2   Worker 3   (parallel)
        ↓         ↓         ↓
   Email      Push       SMS
```

**Implementation:**
```javascript
// Producer — API adds jobs to queue
app.post("/notifications/bulk", (req, res) => {
    const { message, type } = req.body;
    
    // Add to queue (non-blocking)
    messageQueue.enqueue({
        message,
        type,
        targetStudents: allStudents
    });
    
    res.json({ status: "queued", message: "Notifications being sent" });
});

// Consumer — Worker processes jobs asynchronously
function processQueue() {
    while (queue.hasJobs()) {
        const job = queue.dequeue();
        // Process each student notification
        for (const student of job.targetStudents) {
            createNotification(student, job.message, job.type);
        }
    }
}
```

**Why queues?**
- ✅ **Asynchronous** — API returns immediately
- ✅ **Scalable** — add more workers for throughput
- ✅ **Fault tolerant** — failed jobs retry automatically
- ✅ **Decoupled** — DB save and email are separate concerns

### Should DB save and email happen together?

**❌ NO** — Use separate workers/services:
- Worker 1: Save to database
- Worker 2: Send email
- Worker 3: Send push notification

This way, if email service fails, the DB save still succeeds.

---

## Stage 6 — Priority Inbox (DSA Implementation)

### Problem

Students receive hundreds of notifications. They need the **most important ones** shown first.

### Priority Weights

| Type        | Weight |
|-------------|--------|
| Placement   | 3      |
| Result      | 2      |
| Event       | 1      |

### Priority Formula

```
Priority Score = TypeWeight + RecencyScore
```

Where:
- `RecencyScore` = Higher for newer notifications (e.g., hours since creation / 24)

### Data Structure: Min-Heap (Priority Queue)

**Why Min-Heap?**

For "Top K" problems, a min-heap of size K is optimal:
- Time: **O(n log k)** where n = total notifications, k = top results
- Space: **O(k)**

**Algorithm:**
1. Iterate through all notifications
2. Calculate priority score for each
3. Maintain a min-heap of size 10
4. If new score > heap minimum → replace
5. Return heap contents (sorted)

### Example Output

```
Top 10 Priority Notifications:
1. [Placement] Microsoft Hiring Drive (Score: 3.95)
2. [Placement] Google Campus Placement (Score: 3.88)
3. [Placement] Amazon SDE Intern (Score: 3.75)
4. [Result] Semester 6 Results Published (Score: 2.92)
5. [Result] Internal Assessment Marks (Score: 2.83)
6. [Event] Hackathon Registration Open (Score: 1.96)
...
```

---

## Technology Stack

| Component      | Technology          | Purpose                    |
|----------------|---------------------|----------------------------|
| Runtime        | Node.js             | Server-side JavaScript     |
| Framework      | Express.js          | REST API                   |
| Database       | MongoDB (simulated) | Document store             |
| Cache          | Redis (simulated)   | In-memory caching          |
| Queue          | BullMQ (simulated)  | Async job processing       |
| DSA            | Min-Heap            | Priority inbox ranking     |

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    Client (Student App)                   │
└────────────────────────┬─────────────────────────────────┘
                         │
                    REST API / WebSocket
                         │
┌────────────────────────┴─────────────────────────────────┐
│                   Express.js Server                       │
│                                                           │
│  POST /notifications          → Create notification       │
│  GET  /notifications/:id      → Get (with cache)          │
│  PATCH /notifications/:id/read→ Mark as read              │
│  DELETE /notifications/:id    → Delete                    │
│  GET  /notifications/:id/top  → Priority inbox (heap)     │
│  POST /notifications/bulk     → Queue-based bulk send     │
└──────┬────────────┬───────────────┬──────────────────────┘
       │            │               │
   ┌───┴───┐   ┌───┴───┐    ┌──────┴──────┐
   │ Cache  │   │  DB   │    │   Queue     │
   │(Redis) │   │(Mongo)│    │  (BullMQ)   │
   └────────┘   └───────┘    └──────┬──────┘
                                    │
                              ┌─────┴─────┐
                              │  Workers   │
                              │ Email/Push │
                              └────────────┘
```
