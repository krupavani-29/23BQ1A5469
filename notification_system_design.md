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

---

# Stage 2

This section describes the persistent database storage choice, the relational schema model, scalability challenges, and the SQL queries required to support Stage 1 operations.

---

## 1. Database Selection: PostgreSQL

We recommend **PostgreSQL** as the persistent storage engine for the notification platform.

### Rationale:
* **Strong Data Integrity (ACID)**: Notification histories must remain consistent. Relational constraints prevent orphaned dispatch entries and ensure students are only mapped to valid notifications.
* **Transactional Operations**: Dispatching a notification and logging its creation (along with queue management) requires transactional atomic guarantees to ensure notifications are never lost or double-dispatched.
* **JSONB Support**: Allows semi-structured payloads (such as deep link routing data or custom parameters) to be stored in notification entities while maintaining the performance of indexable binary JSON.
* **Partitioning & Sharding Support**: Supports native table partitioning by timestamp (highly beneficial for time-series data like notifications) and integrates cleanly with sharding extensions (such as Citus) for horizontal scale.

---

## 2. Relational Database Schema (DDL)

```sql
-- Students Table (Entity)
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    mobile_no VARCHAR(15) NOT NULL,
    github_username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification Types Enum
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

-- Notifications Table (Core Metadata)
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type notification_type NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Student-Notification Dispatch (Junction Entity / Mapping)
-- Separates metadata from delivery status to optimize multi-recipient (Notify All) scenarios.
CREATE TABLE student_notifications (
    id BIGSERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notifications(notification_id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_notification UNIQUE (student_id, notification_id)
);

-- Indexing Strategy
CREATE INDEX idx_student_notifications_student_unread 
ON student_notifications(student_id) 
WHERE is_read = FALSE;

CREATE INDEX idx_student_notifications_created 
ON student_notifications(created_at DESC);
```

---

## 3. Scalability Challenges & Solutions

As the volume of students and notifications grows to tens of millions, the following challenges arise:

| Scalability Challenge | Architectural Impact | Solution |
| :--- | :--- | :--- |
| **Index Bloat & RAM Exhaustion** | B-Tree indexes on `student_notifications` exceed RAM size, causing queries to swap to disk and slow down. | **Table Partitioning**: Partition `student_notifications` by range on `created_at` (e.g., monthly partitions). Drop or archive old partitions to keep active indexes in memory. |
| **High Write Contention** | Sending bulk notifications (e.g. "Notify All" to 50k students) locks the write path, causing read delays. | **Write-Ahead Buffering**: Queue notification dispatches via Redis/RabbitMQ and write to DB in batched, micro-chunked transactions. |
| **Slow Pagination Scans** | `OFFSET` pagination causes the database to read and discard millions of rows on deep pages. | **Keyset Pagination**: Avoid `OFFSET`. Paginate using cursor-based keysets (e.g., `WHERE created_at < last_seen_timestamp LIMIT 10`). |

---

## 4. API-Matching Database Queries

Below are the SQL queries mapped to the REST endpoints designed in Stage 1:

### Query A: Fetch Notifications (GET `/evaluation-service/notifications`)
```sql
SELECT n.notification_id, n.type, n.message, sn.is_read, sn.created_at
FROM student_notifications sn
JOIN notifications n ON sn.notification_id = n.notification_id
WHERE sn.student_id = 1042 -- Parameterized student_id
  AND (n.type = 'Result' OR 'Result' IS NULL) -- Filter parameter
ORDER BY sn.created_at DESC
LIMIT 10 OFFSET 0;
```

### Query B: Mark as Read (PATCH `/evaluation-service/notifications/read`)
```sql
UPDATE student_notifications
SET is_read = TRUE, read_at = NOW()
WHERE student_id = 1042 -- Scope to authenticated student for security
  AND notification_id IN ('d146095a-0d86-4a34-9e69-3900a14576bc');
```

### Query C: Fetch Unread Count (GET `/evaluation-service/notifications/unread-count`)
```sql
SELECT COUNT(*) AS unread_count
FROM student_notifications
WHERE student_id = 1042 AND is_read = FALSE;
```

### Query D: Dispatch Notification (POST `/evaluation-service/notifications/dispatch`)
```sql
-- Step 1: Insert Core Notification Metadata
INSERT INTO notifications (notification_id, type, message)
VALUES ('d146095a-0d86-4a34-9e69-3900a14576bc', 'Placement', 'AMD is hiring!')
RETURNING notification_id;

-- Step 2: Bulk Insert Dispatches (Example for recipients 1042 and 1043)
INSERT INTO student_notifications (student_id, notification_id)
VALUES 
  (1042, 'd146095a-0d86-4a34-9e69-3900a14576bc'),
  (1043, 'd146095a-0d86-4a34-9e69-3900a14576bc');
```

---

# Stage 3

This section analyzes the slow-running relational database query and presents optimized indexing strategies.

---

## 1. Query Analysis

Target Query:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

*(Note: Based on the DDL schema, we map `studentID` to `student_id`, `isRead` to `is_read`, and `createdAt` to `created_at` inside the `student_notifications` table.)*

### Question A: Is this query accurate?
**Yes**, the query is syntactically valid and accurately represents the logical filter of getting unread notifications for a single student. 

**However**, from a production design perspective:
* **Over-fetching (`SELECT *`)**: Using `*` fetches all columns, including potentially large fields (e.g., notification content/messages). This wastes network bandwidth and memory.
* **Scope**: In our highly optimized schema, the filter columns (`student_id` and `is_read`) live in the mapping table (`student_notifications`), whereas the actual metadata lives in `notifications`. The query must join the tables to get the fields cleanly.

---

### Question B: Why is this query slow?
1. **Full Table Scan**: Without an index, the query planner must read all 5,000,000 records of `student_notifications` sequentially from disk to check the filter condition.
2. **Sort Overhead (FileSort)**: Sorting the matching records by `created_at ASC` requires the database to allocate memory (`work_mem` in PostgreSQL) or write temp files to disk if the matching dataset exceeds memory buffers.

---

### Question C: Proposed Indexing & Computation Cost

We should add a **Composite (Multi-column) Index** targeting the exact query path:

```sql
CREATE INDEX idx_student_notifications_unread_created 
ON student_notifications(student_id, is_read, created_at ASC);
```

#### Why this works:
* **Equality First**: The index structure groups records by `student_id` first, and then by `is_read` inside that group. The query planner traverses the B-Tree in $O(\log N)$ time, instantly pointing to only the unread notifications for that student.
* **Pre-sorted Index**: The final column in the composite index is `created_at ASC`. Because the B-Tree is pre-sorted, the database reads rows in the correct order directly from the index, eliminating the $O(M \log M)$ sorting phase.

#### Computation and Storage Cost:
* **Read Complexity**: Reduced from $O(N)$ sequential scan to $O(\log N)$ tree traversal. Query response time decreases from ~500ms+ to <1ms.
* **Write Overhead**: Slightly increases write latency during inserts and updates on the `student_notifications` table ($O(\log N)$ overhead to update B-Tree index nodes).
* **Storage**: Consumes additional disk space (~45-60MB for 5,000,000 entries), which is a negligible tradeoff for the performance boost.

---

## 2. Critique of Indexing Every Column

> Advice: "Add indexes on every column to be safe."

**This advice is highly ineffective and is a common database anti-pattern.**

### Why:
1. **Write Amplification**: Every insert, update, or delete must write to every single index. This severely degrades write throughput.
2. **Index Space Bloat**: Indexes consume RAM. If the total size of all indexes exceeds the database server's cache (`shared_buffers`), the database must swap index blocks in and out of disk, causing a severe drop in performance.
3. **Relational Limits**: Databases cannot merge multiple single-column indexes effectively for queries with multiple filter/sort columns. A single composite index is far more efficient than multiple independent single-column indexes.

---

## 3. Placement Query (Last 7 Days)

Query to find all students who received a placement notification in the last 7 days:

### PostgreSQL Version:
```sql
SELECT DISTINCT s.student_id, s.name, s.email
FROM students s
JOIN student_notifications sn ON s.student_id = sn.student_id
JOIN notifications n ON sn.notification_id = n.notification_id
WHERE n.type = 'Placement'
  AND sn.created_at >= NOW() - INTERVAL '7 days';
```

### MySQL Version:
```sql
SELECT DISTINCT s.student_id, s.name, s.email
FROM students s
JOIN student_notifications sn ON s.student_id = sn.student_id
JOIN notifications n ON sn.notification_id = n.notification_id
WHERE n.type = 'Placement'
  AND sn.created_at >= NOW() - INTERVAL 7 DAY;
```

---

# Stage 4

This section addresses the database load issues caused by fetching notifications on every page load and details performance optimization strategies and tradeoffs.

---

## 1. Mitigation Strategies

To prevent the persistent database from getting overwhelmed by page-load traffic, we suggest three architectural improvements:

### Strategy A: Caching Layer with Redis
Introduce an in-memory cache (Redis) to store the active unread notification list and unread count for each student.
* **Mechanism**:
  * On API fetch, check Redis using key `student:student_id:notifications`. If present, return immediately.
  * If a cache miss occurs, query the database, write the results to Redis with a TTL (Time-To-Live) of 1 hour, and return.
  * **Cache Invalidation**: On dispatching a new notification or marking a notification as read, invalidate or update the specific Redis key.

### Strategy B: Client-Side Local Storage & Conditional GET (ETags)
Utilize HTTP caching headers (`ETag` or `Last-Modified`) to avoid transferring data over the network if nothing has changed.
* **Mechanism**:
  * The server returns an `ETag` (a hash of the student's notification states) in the response header.
  * The client stores the data and, on subsequent page loads, sends the `If-None-Match: <ETag>` header.
  * The server performs a cheap check (e.g., checking a fast Redis timestamp key). If unchanged, it returns `304 Not Modified` without querying the database or sending a JSON body.

### Strategy C: Real-Time Stream (Push instead of Pull)
Instead of polling the server on each page load, the frontend relies on the established **SSE stream** to update its local state. The initial load gets cached data, and all subsequent additions are pushed dynamically.

---

## 2. Tradeoff Analysis

| Strategy | Advantages (Pros) | Disadvantages (Cons) / Tradeoffs |
| :--- | :--- | :--- |
| **Redis Caching** | * Drastically reduces DB reads (down to near-zero on cache hit).<br>* Sub-millisecond response latency. | * **Cache Invalidation Overhead**: Requires writing strict event triggers on updates. Failure to invalidate cache leads to stale read-status views.<br>* High memory consumption in Redis. |
| **Conditional HTTP Caching (ETags)** | * Extremely low network bandwidth consumption.<br>* Follows standard HTTP/2 web specifications. | * Still requires a roundtrip request to the backend server to validate the ETag, meaning the backend server still receives the request (even if the DB query is saved). |
| **SSE Push Architecture** | * Zero HTTP polling requests after connection initialization.<br>* Instant real-time user experience. | * **State Synchronization**: If a user logs in on a new tab, state must be loaded from cache. Managing open connections consumes server sockets and file descriptors. |

---

# Stage 5

This section analyzes the shortcomings of the synchronous bulk notification dispatch pattern, answers operational failure scenarios, and presents a reliable event-driven redesign.

---

## 1. Shortcomings of the Proposed Code

The provided pseudocode:
```text
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)
        save_to_db(student_id, message)
        push_to_app(student_id, message)
```

### Critical Flaws:
1. **Blocking Synchronous Execution**: The loop processes students sequentially. If sending an email and push notification takes 1.5 seconds per user, processing 50,000 students will require **20.8 hours**. The HR's request will trigger a gateway timeout within 30 seconds, leaving the task partially complete.
2. **Cascading Failure Risk**: If any single API or DB operation throws an uncaught error, the entire loop terminates, halting dispatches to all subsequent students.
3. **No Retry Mechanism**: If the email service fails for 200 students, there is no system to log the failures, track where the loop stopped, or retry sending only to those who failed.
4. **Poor Database Performance**: Performing 50,000 individual insert operations sequentially creates massive connection pool overhead and locking delays.

---

## 2. Recovery Plan for the 200 Failed Emails

### What to do now:
Because the original code does not track execution states:
1. We must query the logs to extract the student IDs of the 200 failed operations.
2. If logs are unavailable, we must run a delta query comparing the `students` list against the `student_notifications` (or dispatch audit logs) to find who did not receive the dispatch.
3. Once identified, run a dedicated patch script targeting *only* those 200 student IDs. **Do not re-run the entire script**, as that will spam the other 49,800 students.

---

## 3. Redesign for Speed & Reliability

To process 50,000 users concurrently under 10 seconds:
* **Decoupled Job Dispatching (Message Queue)**: Use a task queue (e.g. RabbitMQ, BullMQ with Redis).
* **Database Chunking**: Bulk insert all 50,000 DB records in batches of 1,000 to minimize database connection overhead.
* **Separation of Concerns**: Saving to the database (local and fast) must be separated from sending emails (remote and slow).
  * **Why**: External network operations (email gateways) are highly prone to network fluctuation, rate limits, or downtime. Keeping them in the same transaction loop blocks database connections.
  * **Solution**: Save records to the database first, then queue job messages for independent workers to dispatch emails.

---

## 4. Revised Pseudocode

### 1. Producer: Trigger Bulk Dispatch
Called when HR triggers the "Notify All" action.
```text
function handle_notify_all_request(student_ids: array, type: string, message: string):
    // Step 1: Save core notification metadata once
    notification_id = db.insert_notification_metadata(type, message)

    // Step 2: Chunk student IDs and perform bulk inserts in batches of 1000
    for chunk in chunk_array(student_ids, 1000):
        db.bulk_insert_dispatches(notification_id, chunk)

    // Step 3: Push a single high-level job to the message queue
    task_queue.push("bulk_notification_job", {
        notification_id: notification_id,
        student_ids: student_ids,
        message: message
    })

    // Return immediate success to HR UI (response in under 100ms)
    return response(202, { message: "Notification dispatch successfully queued." })
```

### 2. Queue Consumer: Distribute Tasks
Triggered by background worker nodes.
```text
function consume_bulk_notification_job(job):
    // Explode the large job into 50,000 individual, light-weight delivery sub-jobs
    for student_id in job.student_ids:
        task_queue.push("send_delivery_job", {
            student_id: student_id,
            notification_id: job.notification_id,
            message: job.message
        }, {
            attempts: 3,               // Automatically retry up to 3 times on failure
            backoff: "exponential"     // Wait longer between retries (e.g., 5s, 25s, 125s)
        })
```

### 3. Worker: Process Individual Delivery
Processes tasks concurrently across multiple worker instances.
```text
function consume_send_delivery_job(sub_job):
    student = db.get_student_contact(sub_job.student_id)

    // Parallel execution of IO operations using Promise.all / thread-pools
    try:
        parallel:
            send_email_gateway(student.email, sub_job.message)
            push_to_app_gateway(student.device_token, sub_job.message)
            
        // Mark dispatch status as successful
        db.update_dispatch_status(sub_job.notification_id, sub_job.student_id, "sent")
    catch error:
        // Log error and throw to let the queue runner handle automated retries
        log_error("Failed to deliver notification to " + student.student_id + ": " + error.message)
        throw error
```

---

# Stage 6

This section details the implementation of the Priority Inbox CLI client, the mathematical definition of the ranking algorithm, the architectural plan for heap-based scaling, and the CLI execution output.

---

## 1. Priority Score Ranking Algorithm

To surface the most relevant notifications first, we use a hybrid ranking function that combines category urgency (weight) with temporal recency.

### Weight Mapping:
* **Placement** notifications (critical for careers): Weight = `3`
* **Result** notifications (highly important updates): Weight = `2`
* **Event** notifications (standard announcements): Weight = `1`
* **Other / Default**: Weight = `0`

### Mathematical Formulation:
$$\text{Score} = (W_c \times 86400) + T_e$$

Where:
* $W_c$ is the Category Weight (Placement = 3, Result = 2, Event = 1).
* $86400$ is the number of seconds in a single day. This constant multiplier ensures that a higher-priority category (e.g., Placement) will always rank above a lower-priority category (e.g., Result) unless the lower-priority notification is **at least 24 hours more recent**.
* $T_e$ is the UNIX epoch timestamp of the notification (in seconds).

---

## 2. Heap-Based Scaling Strategy

When scaling to retrieve the top $K$ ($K = 10$) notifications out of millions of items ($N \gg 10^7$):
* **Naive Approach (Sorting)**: Loading all notifications into memory and sorting them takes $O(N \log N)$ time complexity and $O(N)$ memory. This causes out-of-memory crashes at scale.
* **Optimized Approach (Min-Heap)**: We can use a **Min-Heap** data structure of fixed capacity $K$.
  1. Iterate through the stream of notifications one-by-one.
  2. Push each notification into the Min-Heap.
  3. If the size of the heap exceeds $K$, pop the root (which holds the lowest score in the heap).
  4. After scanning all items, the heap contains the top $K$ highest-priority items.
  5. The time complexity is reduced to $O(N \log K)$ and auxiliary memory is reduced to a constant $O(K)$ space.

---

## 3. CLI Execution Output

The functional Priority Inbox CLI script (`priorityInbox.ts`) retrieves raw data from the remote evaluation service, ranks each item, and displays the top 10 elements:

```text
================== PRIORITY INBOX (TOP 10) ==================

[1] Score: 1780859416 | Type: Placement | Time: 2026-06-05 00:40:16
    Msg: Alphabet Inc. Class A hiring
    ID : 54af6c51-b5ae-410b-a9e2-479ae0cfeabf

[2] Score: 1780855891 | Type: Placement | Time: 2026-06-04 23:41:31
    Msg: Visa Inc. hiring
    ID : 36c4fcea-aa3d-4ef5-a680-ab725c4afe5f

[3] Score: 1780854166 | Type: Placement | Time: 2026-06-04 23:12:46
    Msg: Apple Inc. hiring
    ID : cd5b7f80-02e1-4ac3-b386-453dd4bbeda3

[4] Score: 1780843336 | Type: Placement | Time: 2026-06-04 20:12:16
    Msg: Alphabet Inc. Class C hiring
    ID : e1784e49-bbf6-422b-88b0-5a31d96f4189

[5] Score: 1780803556 | Type: Placement | Time: 2026-06-04 09:09:16
    Msg: Meta Platforms Inc. hiring
    ID : 34adc7ee-c107-4f62-ac50-775f85dceeae

[6] Score: 1780794706 | Type: Placement | Time: 2026-06-04 06:41:46
    Msg: Broadcom Inc. hiring
    ID : 0f0f271f-71dd-40f7-b27b-29bb826033e1

[7] Score: 1780773001 | Type: Result | Time: 2026-06-05 00:40:01
    Msg: project-review
    ID : 2bb134a9-90f8-4345-b3ce-6cd6dcd1d94e

[8] Score: 1780771411 | Type: Result | Time: 2026-06-05 00:13:31
    Msg: mid-sem
    ID : 3b59bde4-19ca-41da-a7dd-3c2c28897967

[9] Score: 1780769596 | Type: Result | Time: 2026-06-04 23:43:16
    Msg: project-review
    ID : 86b44415-5442-4b56-9cc9-30f8933e8afc

[10] Score: 1780742551 | Type: Result | Time: 2026-06-04 16:12:31
    Msg: mid-sem
    ID : d6b13873-f98f-4038-a818-0c3fcfe7fe71

=============================================================
```
