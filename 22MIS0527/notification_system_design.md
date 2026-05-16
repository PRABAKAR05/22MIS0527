# Notification System Design — Vehicle Maintenance Scheduler

## 1. Overview

This document describes the design and architecture of a **Notification System** for the Vehicle Maintenance Scheduler application. The system notifies depot managers and mechanics about upcoming, overdue, and high-impact maintenance tasks via multiple channels (in-app, email, and webhook).

---

## 2. Problem Statement

The Vehicle Maintenance Scheduler selects optimal maintenance tasks per depot using a knapsack algorithm. However, there is no mechanism to **proactively alert** stakeholders when:

- A high-impact task is scheduled and needs attention.
- A task's deadline is approaching (upcoming maintenance).
- A task becomes overdue (missed maintenance window).
- The schedule is generated/updated for a depot.

Without notifications, depot managers must manually poll for updates, leading to missed maintenance windows and reduced fleet reliability.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Express.js)                │
│  POST /notifications/send                               │
│  GET  /notifications/:depotId                           │
│  POST /notifications/preferences                        │
│  GET  /notifications/preferences/:depotId               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Notification Service                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ In-App       │  │ Email        │  │ Webhook      │  │
│  │ (Console/Log)│  │ (Nodemailer) │  │ (HTTP POST)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│            In-Memory Store / JSON File Store            │
│  - Notification history                                 │
│  - Depot preferences                                    │
│  - Delivery status tracking                             │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Notification Types

| Type                  | Trigger                                    | Priority |
|-----------------------|--------------------------------------------|----------|
| `SCHEDULE_GENERATED`  | New optimal schedule computed for a depot   | LOW      |
| `HIGH_IMPACT_TASK`    | Task with impact ≥ 8 is scheduled          | HIGH     |
| `UPCOMING_MAINTENANCE`| Task due within 24 hours                   | MEDIUM   |
| `OVERDUE_TASK`        | Task past its maintenance window           | CRITICAL |
| `DEPOT_SUMMARY`       | Daily summary of all tasks for a depot     | LOW      |

---

## 5. Notification Channels

### 5.1 In-App (Console/Log)
- Default channel; always enabled.
- Logs structured notification to console with timestamp, depot, and priority.
- Stored in in-memory notification history.

### 5.2 Email (Nodemailer)
- Optional channel; configurable per depot.
- Uses SMTP transport (configurable via environment variables).
- Sends HTML-formatted emails with task details.

### 5.3 Webhook (HTTP POST)
- Optional channel; posts JSON payload to a configured URL.
- Supports retry with exponential backoff (max 3 retries).
- Useful for integrating with Slack, Teams, or custom dashboards.

---

## 6. API Endpoints

### `POST /notifications/send`
Triggers a notification for a specific depot and type.

**Request Body:**
```json
{
  "depotId": 1,
  "type": "HIGH_IMPACT_TASK",
  "channels": ["in-app", "webhook"],
  "payload": {
    "taskId": "f8b2115b-0d4b-4989-8022-64f000637da3",
    "duration": 2,
    "impact": 10,
    "message": "High-impact brake replacement scheduled"
  }
}
```

**Response:**
```json
{
  "success": true,
  "notificationId": "notif-uuid-123",
  "deliveryStatus": {
    "in-app": "delivered",
    "webhook": "delivered"
  }
}
```

### `GET /notifications/:depotId`
Retrieves notification history for a depot.

**Response:**
```json
{
  "depotId": 1,
  "notifications": [
    {
      "id": "notif-uuid-123",
      "type": "HIGH_IMPACT_TASK",
      "priority": "HIGH",
      "message": "High-impact brake replacement scheduled",
      "timestamp": "2026-05-16T12:00:00Z",
      "channels": ["in-app", "webhook"],
      "read": false
    }
  ]
}
```

### `POST /notifications/preferences`
Sets notification preferences for a depot.

**Request Body:**
```json
{
  "depotId": 1,
  "channels": {
    "in-app": true,
    "email": true,
    "webhook": false
  },
  "emailAddress": "depot1@fleet.com",
  "webhookUrl": "",
  "minPriority": "MEDIUM"
}
```

### `GET /notifications/preferences/:depotId`
Retrieves notification preferences for a depot.

---

## 7. Data Models

### Notification Object
```json
{
  "id": "string (UUID)",
  "depotId": "number",
  "type": "SCHEDULE_GENERATED | HIGH_IMPACT_TASK | UPCOMING_MAINTENANCE | OVERDUE_TASK | DEPOT_SUMMARY",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "message": "string",
  "payload": "object",
  "channels": ["in-app", "email", "webhook"],
  "deliveryStatus": {
    "in-app": "delivered | failed",
    "email": "delivered | failed | skipped",
    "webhook": "delivered | failed | skipped"
  },
  "read": "boolean",
  "createdAt": "ISO 8601 timestamp"
}
```

### Depot Preferences Object
```json
{
  "depotId": "number",
  "channels": {
    "in-app": "boolean",
    "email": "boolean",
    "webhook": "boolean"
  },
  "emailAddress": "string",
  "webhookUrl": "string",
  "minPriority": "LOW | MEDIUM | HIGH | CRITICAL"
}
```

---

## 8. Integration with Vehicle Maintenance Scheduler

The notification system integrates with the existing scheduler:

1. **After schedule generation** (`index.js`): Automatically triggers `SCHEDULE_GENERATED` and `HIGH_IMPACT_TASK` notifications.
2. **Periodic check** (cron-style): Scans scheduled tasks for upcoming/overdue deadlines.
3. **API-driven**: External systems can trigger notifications via REST endpoints.

```
Scheduler (index.js)
       │
       ├── Computes optimal schedule (knapsack)
       │
       ├── For each depot result:
       │     ├── Send SCHEDULE_GENERATED notification
       │     └── For each task with impact >= 8:
       │           └── Send HIGH_IMPACT_TASK notification
       │
       └── Log via Logging Middleware (logger.js)
```

---

## 9. Technology Stack

| Component         | Technology               |
|-------------------|--------------------------|
| Runtime           | Node.js                  |
| Framework         | Express.js               |
| HTTP Client       | Axios                    |
| Email             | Nodemailer               |
| UUID Generation   | crypto (built-in)        |
| Environment Config| dotenv                   |
| Data Store        | In-memory (JSON)         |

---

## 10. Error Handling & Resilience

- **Retry Logic**: Webhook delivery retries up to 3 times with exponential backoff (1s, 2s, 4s).
- **Graceful Degradation**: If one channel fails, others still deliver. Partial success is reported.
- **Logging**: All notification attempts are logged via the logging middleware.
- **Validation**: Input validation on all API endpoints with descriptive error messages.

---

## 11. Security Considerations

- API endpoints are protected with Bearer token authentication (same token as the evaluation service).
- Email credentials stored in environment variables, never hardcoded.
- Webhook URLs validated before delivery attempts.
- Sensitive data (tokens, passwords) excluded from notification payloads.

---

## 12. Future Enhancements

- **Database persistence** (MongoDB/PostgreSQL) for notification history.
- **WebSocket support** for real-time in-app push notifications.
- **Rate limiting** to prevent notification spam.
- **Notification templates** with customizable message formats.
- **Batch notifications** — aggregate multiple low-priority alerts into a single digest.
