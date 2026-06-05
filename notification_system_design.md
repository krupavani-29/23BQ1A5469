# Stage 1

This section outlines the REST API design, contract, and architectural structure for the Notification Platform, including the real-time notification mechanism.

---

## 1. Core Platform Actions

The notification platform supports the following primary actions:
1. **Fetch Notifications**: Retrieve a paginated list of notifications for the logged-in student, supporting filtering by type and read/unread status.
2. **Mark Notifications as Read**: Update the status of one or more notifications to read.
3. **Retrieve Unread Count**: Fetch a quick summary of the number of unread notifications for badge counts.
4. **Create Notification (Administrative/System)**: Post a new notification to a student or a group of students.

---

## 2. API Contract & Endpoint Structures

All endpoints use standard HTTP methods, return JSON payloads, and utilize predictable path structures.

### Authentication & Global Headers

All protected endpoints require the following headers:

| Header Name | Type | Value / Format | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | `Bearer <access_token>` | JWT access token |
| `Content-Type` | `string` | `application/json` | Request payload format |

---

### Action A: Fetch Notifications (GET)

Retrieves a paginated list of notifications for the authenticated user.

* **Endpoint**: `/evaluation-service/notifications`
* **Method**: `GET`
* **Query Parameters**:
  * `limit` (optional, default: `10`): Number of logs/notifications to fetch per page.
  * `page` (optional, default: `1`): Page number.
  * `notification_type` (optional): Filter by type (`"Event"`, `"Result"`, `"Placement"`).
  * `is_read` (optional): Filter by read status (`true`/`false`).

#### Request Header:
```http
GET /evaluation-service/notifications?limit=10&page=1 HTTP/1.1
Host: api.platform.local
Authorization: Bearer <access_token>
Accept: application/json
```

#### Response (Status Code: 200 OK):
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "ID": "d146095a-0d86-4a34-9e69-3900a14576bc",
        "Type": "Result",
        "Message": "Mid-term examination grades are published.",
        "Timestamp": "2026-04-22 17:51:30",
        "isRead": false
      },
      {
        "ID": "b283248f-ea5a-4b7c-93a9-1f2f240d64b0",
        "Type": "Placement",
        "Message": "CSX Corporation placement drive registration open.",
        "Timestamp": "2026-04-22 17:51:18",
        "isRead": true
      }
    ],
    "pagination": {
      "totalItems": 152,
      "limit": 10,
      "currentPage": 1,
      "totalPages": 16
    }
  }
}
```

---

### Action B: Mark Notifications as Read (PATCH)

Updates the read status of notifications. Supports marking a single notification or multiple notifications in bulk.

* **Endpoint**: `/evaluation-service/notifications/read`
* **Method**: `PATCH`

#### Request Body:
```json
{
  "notificationIDs": [
    "d146095a-0d86-4a34-9e69-3900a14576bc"
  ]
}
```

#### Response (Status Code: 200 OK):
```json
{
  "success": true,
  "message": "1 notification(s) successfully marked as read",
  "updatedIDs": [
    "d146095a-0d86-4a34-9e69-3900a14576bc"
  ]
}
```

---

### Action C: Retrieve Unread Count (GET)

Fetches the current count of unread notifications for UI badging.

* **Endpoint**: `/evaluation-service/notifications/unread-count`
* **Method**: `GET`

#### Response (Status Code: 200 OK):
```json
{
  "success": true,
  "unreadCount": 5
}
```

---

### Action D: Dispatch Notification (POST)

Admin-only endpoint to send a notification to a set of target student IDs.

* **Endpoint**: `/evaluation-service/notifications/dispatch`
* **Method**: `POST`

#### Request Body:
```json
{
  "recipientIDs": [1042, 1043],
  "notificationType": "Placement",
  "message": "New placement opportunity listed for Senior Full-Stack Engineer."
}
```

#### Response (Status Code: 201 Created):
```json
{
  "success": true,
  "message": "Notification dispatched to 2 recipients",
  "batchID": "a4aad02e-19d0-4153-86d9-58bf55d7c402"
}
```

---

## 3. Real-Time Notification Mechanism

To deliver notifications instantly without forcing clients to repeatedly poll the database, the platform implements **Server-Sent Events (SSE)**.

### Why Server-Sent Events (SSE)?
* **Unidirectional Protocol**: Real-time notifications are strictly server-to-client. SSE is designed specifically for this, whereas WebSockets is bidirectional (which introduces unnecessary protocol complexity and higher resource utilization on the server).
* **HTTP/2 Native**: SSE operates over standard HTTP/2, facilitating connection multiplexing out-of-the-box.
* **Auto-Reconnection**: Standard browser `EventSource` clients automatically handle connection dropouts and retries.
* **Low Battery/Network Overhead**: SSE is highly efficient for mobile web browsers.

### Real-Time Flow Design
1. **Connection**: The client establishes a persistent connection to `/evaluation-service/notifications/stream`.
2. **Subscription**: The server parses the connection's JWT token, maps the connection socket to the `studentID`, and subscribes to a Redis Pub/Sub channel matching `student:studentID`.
3. **Dispatch**: When a notification is saved to the database, the server publishes the payload to the student's Redis channel.
4. **Push**: The stream connection receives the event and writes it to the client connection as text/event-stream.
