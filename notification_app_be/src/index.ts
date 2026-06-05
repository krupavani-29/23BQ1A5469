import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { requestLoggerMiddleware, Log } from 'logging-middleware';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(requestLoggerMiddleware('backend'));

// ============== TYPES & INTERFACES ==============

type NotificationType = 'Event' | 'Result' | 'Placement';

interface Notification {
  ID: string;
  Type: NotificationType;
  Message: string;
  Timestamp: string;
}

interface StudentNotification extends Notification {
  isRead: boolean;
  readAt?: string;
}

interface Student {
  studentID: number;
  name: string;
  email: string;
  deviceToken?: string;
}

// ============== MOCK DATABASE ==============

const mockStudents: Map<number, Student> = new Map([
  [23001, { studentID: 23001, name: 'Rupa Vani', email: 'rupa@example.com' }],
  [23002, { studentID: 23002, name: 'John Doe', email: 'john@example.com' }],
  [23003, { studentID: 23003, name: 'Jane Smith', email: 'jane@example.com' }],
]);

const mockNotifications: Map<string, Notification> = new Map();
const mockStudentNotifications: Map<string, StudentNotification> = new Map();

// Initialize with mock notifications
const initializeMockData = () => {
  const sampleNotifications: Notification[] = [
    {
      ID: 'd146095a-0d86-4a34-9e69-3900a14576bc',
      Type: 'Result',
      Message: 'Mid-term examination grades are published.',
      Timestamp: '2026-04-22 17:51:30',
    },
    {
      ID: 'b283248f-ea5a-4b7c-93a9-1f2f240d64b0',
      Type: 'Placement',
      Message: 'CSX Corporation placement drive registration open.',
      Timestamp: '2026-04-22 17:51:18',
    },
    {
      ID: '81589ada-0ad3-4f77-9554-f52fb558e09d',
      Type: 'Event',
      Message: 'Annual tech symposium registrations now open.',
      Timestamp: '2026-04-22 17:51:06',
    },
    {
      ID: '9005513a-142d-4bbc-8678-eefec65e1ede',
      Type: 'Result',
      Message: 'Mid-semester project submissions reviewed.',
      Timestamp: '2026-04-22 17:50:54',
    },
    {
      ID: 'ea836726-c25e-4f21-a72f-544a6af8a37f',
      Type: 'Result',
      Message: 'Project review feedback available.',
      Timestamp: '2026-04-22 17:50:42',
    },
  ];

  sampleNotifications.forEach(notif => {
    mockNotifications.set(notif.ID, notif);
    mockStudents.forEach((student, studentID) => {
      const key = `${studentID}:${notif.ID}`;
      mockStudentNotifications.set(key, {
        ...notif,
        isRead: Math.random() > 0.6,
      });
    });
  });
};

initializeMockData();

// ============== MIDDLEWARE ENHANCEMENTS ==============

// Custom error handler middleware
interface CustomError extends Error {
  statusCode?: number;
}

app.use((err: CustomError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  Log('backend', statusCode >= 500 ? 'fatal' : 'error', 'handler', 
      `Error: ${err.message}`.slice(0, 48)).catch(() => {});
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Request validation middleware
const validateAuth = (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth) {
    Log('backend', 'warn', 'middleware', 'Missing authorization header').catch(() => {});
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

// ============== ROUTES: STAGE 1 - FETCH NOTIFICATIONS ==============

app.get('/evaluation-service/notifications', validateAuth, async (req: Request, res: Response) => {
  try {
    const { limit = 10, page = 1, notification_type, is_read } = req.query;
    const studentID = 23001; // Mock student ID

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Filter notifications
    let notifications: StudentNotification[] = Array.from(
      mockStudentNotifications.values()
    ).filter(n => {
      const key = `${studentID}`;
      const matches = mockStudentNotifications.get(`${studentID}:${n.ID}`);
      return matches !== undefined;
    });

    if (notification_type) {
      notifications = notifications.filter(n => n.Type === notification_type);
    }

    if (is_read !== undefined) {
      const isReadBool = is_read === 'true';
      notifications = notifications.filter(n => n.isRead === isReadBool);
    }

    // Pagination
    const totalItems = notifications.length;
    const totalPages = Math.ceil(totalItems / limitNum);
    const paginatedNotifications = notifications
      .sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime())
      .slice(skip, skip + limitNum);

    await Log('backend', 'info', 'handler', 'Fetched notifications successfully');

    res.json({
      success: true,
      data: {
        notifications: paginatedNotifications,
        pagination: {
          totalItems,
          limit: limitNum,
          currentPage: pageNum,
          totalPages,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ROUTES: STAGE 1 - MARK AS READ ==============

app.patch('/evaluation-service/notifications/read', validateAuth, async (req: Request, res: Response) => {
  try {
    const { notificationIDs } = req.body;
    const studentID = 23001;

    if (!Array.isArray(notificationIDs)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const updatedIDs: string[] = [];

    notificationIDs.forEach((notifID: string) => {
      const key = `${studentID}:${notifID}`;
      const notif = mockStudentNotifications.get(key);
      if (notif) {
        mockStudentNotifications.set(key, {
          ...notif,
          isRead: true,
          readAt: new Date().toISOString(),
        });
        updatedIDs.push(notifID);
      }
    });

    await Log('backend', 'info', 'handler', `Marked ${updatedIDs.length} as read`);

    res.json({
      success: true,
      message: `${updatedIDs.length} notification(s) marked as read`,
      updatedIDs,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ROUTES: STAGE 1 - UNREAD COUNT ==============

app.get('/evaluation-service/notifications/unread-count', validateAuth, async (req: Request, res: Response) => {
  try {
    const studentID = 23001;
    const unreadCount = Array.from(mockStudentNotifications.values()).filter(
      n => !n.isRead && mockStudentNotifications.has(`${studentID}:${n.ID}`)
    ).length;

    await Log('backend', 'info', 'service', `Unread count: ${unreadCount}`);

    res.json({
      success: true,
      unreadCount,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ROUTES: STAGE 1 - DISPATCH NOTIFICATION ==============

app.post('/evaluation-service/notifications/dispatch', validateAuth, async (req: Request, res: Response) => {
  try {
    const { recipientIDs, notificationType, message } = req.body;

    if (!Array.isArray(recipientIDs) || !notificationType || !message) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const notificationID = uuidv4();
    const timestamp = new Date().toISOString();

    const newNotification: Notification = {
      ID: notificationID,
      Type: notificationType as NotificationType,
      Message: message,
      Timestamp: timestamp,
    };

    mockNotifications.set(notificationID, newNotification);

    recipientIDs.forEach((studentID: number) => {
      const key = `${studentID}:${notificationID}`;
      mockStudentNotifications.set(key, {
        ...newNotification,
        isRead: false,
      });
    });

    const batchID = uuidv4();
    await Log('backend', 'info', 'service', `Dispatched to ${recipientIDs.length}`);

    res.status(201).json({
      success: true,
      message: `Notification dispatched to ${recipientIDs.length} recipients`,
      batchID,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ROUTES: STAGE 4 - CACHING SUPPORT ==============

app.get('/evaluation-service/notifications/cached', validateAuth, async (req: Request, res: Response) => {
  try {
    const studentID = 23001;
    const eTag = req.get('If-None-Match');
    const currentETag = `"${Buffer.from(JSON.stringify(mockStudentNotifications)).toString('base64').slice(0, 20)}"`;

    if (eTag === currentETag) {
      return res.status(304).send();
    }

    const notifications = Array.from(mockStudentNotifications.values()).filter(
      n => mockStudentNotifications.has(`${studentID}:${n.ID}`)
    );

    res.set('ETag', currentETag);
    res.set('Cache-Control', 'max-age=3600');

    res.json({
      success: true,
      data: { notifications },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ROUTES: HEALTH CHECK ==============

app.get('/health', async (req: Request, res: Response) => {
  await Log('backend', 'info', 'handler', 'Health check ok').catch(() => {});
  res.json({
    success: true,
    message: 'Backend service is healthy',
    timestamp: new Date().toISOString(),
  });
});

// ============== ROUTES: LOGS PROXY ==============

app.post('/api/logs', express.json(), async (req: Request, res: Response) => {
  try {
    const { level, package: pkg, message } = req.body;
    const stack = 'frontend';

    await Log(stack, level || 'info', pkg || 'api', message || 'No message');

    res.json({ success: true, message: 'Log received' });
  } catch (error: any) {
    console.error('Log proxy error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ROUTES: SSE STREAM (Real-time notifications) ==============

const activeConnections = new Set<Response>();

app.get('/evaluation-service/notifications/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  Log('backend', 'info', 'handler', 'SSE stream connected').catch(() => {});

  res.write(`data: ${JSON.stringify({ type: 'connection', message: 'Connected to notification stream' })}\n\n`);

  activeConnections.add(res);

  req.on('close', () => {
    activeConnections.delete(res);
    Log('backend', 'info', 'handler', 'SSE stream disconnected').catch(() => {});
  });
});

// Helper function to broadcast notifications to all connected clients
export function broadcastNotification(notification: Notification) {
  activeConnections.forEach(res => {
    res.write(`data: ${JSON.stringify({ type: 'notification', notification })}\n\n`);
  });
}

// ============== SERVER STARTUP ==============

app.listen(PORT, () => {
  console.log(`🚀 Notification Backend running on http://localhost:${PORT}`);
  Log('backend', 'info', 'service', `Server started on port ${PORT}`).catch(() => {});
});

export { app, mockStudents, mockNotifications, mockStudentNotifications };
