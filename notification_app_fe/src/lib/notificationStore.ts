export type NotificationType = 'Placement' | 'Result' | 'Event';

export interface Notification {
  ID: string;
  Type: NotificationType;
  Message: string;
  Timestamp: string;
  isRead: boolean;
}

const RAW_NOTIFICATIONS: Notification[] = [
  {
    ID: 'd146095a-0d86-4a34-9e69-3900a14576bc',
    Type: 'Result',
    Message: 'Mid-term examination grades are published.',
    Timestamp: '2026-04-22 17:51:30',
    isRead: false,
  },
  {
    ID: 'b283248f-ea5a-4f7c-93a9-1f2f240d64b0',
    Type: 'Placement',
    Message: 'CSX Corporation placement drive registration open.',
    Timestamp: '2026-04-22 17:51:18',
    isRead: false,
  },
  {
    ID: '81589ada-0ad3-4f77-9554-f52fb558e09d',
    Type: 'Event',
    Message: 'Annual tech symposium registrations now open.',
    Timestamp: '2026-04-22 17:51:06',
    isRead: true,
  },
  {
    ID: '9005513a-142d-4bbc-8678-eefec65e1ede',
    Type: 'Result',
    Message: 'Mid-semester project submissions reviewed.',
    Timestamp: '2026-04-22 17:50:54',
    isRead: false,
  },
  {
    ID: 'ea836726-c25e-4f21-a72f-544a6af8a37f',
    Type: 'Result',
    Message: 'Project review feedback available.',
    Timestamp: '2026-04-22 17:50:42',
    isRead: true,
  },
  {
    ID: '903cb427-8fc6-47f7-bb00-be228f6bed2c',
    Type: 'Result',
    Message: 'External certification details shared.',
    Timestamp: '2026-04-22 17:50:30',
    isRead: false,
  },
  {
    ID: 'e5c4ff20-31bf-4d40-8f02-72fda59e8918',
    Type: 'Result',
    Message: 'Project review scheduled for final year students.',
    Timestamp: '2026-04-22 17:50:18',
    isRead: false,
  },
  {
    ID: '1cfce5ee-ad37-4894-8946-d707627176a5',
    Type: 'Event',
    Message: 'Tech fest weekend bootcamp announced.',
    Timestamp: '2026-04-22 17:50:06',
    isRead: true,
  },
  {
    ID: 'cf2885a6-45ac-4ba0-b548-6e9e9d4c52c8',
    Type: 'Result',
    Message: 'Project review notes have been published.',
    Timestamp: '2026-04-22 17:49:54',
    isRead: false,
  },
  {
    ID: '8a7412bd-6065-4d09-8501-a37f11cc848b',
    Type: 'Placement',
    Message: 'Advanced Micro Devices Inc. hiring announced.',
    Timestamp: '2026-04-22 17:49:42',
    isRead: true,
  },
];

const notifications: Notification[] = [...RAW_NOTIFICATIONS];

export interface NotificationQuery {
  limit?: number;
  page?: number;
  notification_type?: NotificationType | 'all';
  is_read?: boolean | 'all';
}

export function getNotifications(query: NotificationQuery) {
  const limit = query.limit ?? 10;
  const page = Math.max(1, query.page ?? 1);

  let filtered = [...notifications];

  if (query.notification_type && query.notification_type !== 'all') {
    filtered = filtered.filter((item) => item.Type === query.notification_type);
  }

  if (query.is_read !== undefined && query.is_read !== 'all') {
    filtered = filtered.filter((item) => item.isRead === query.is_read);
  }

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const currentPage = Math.min(page, totalPages);

  filtered.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());

  const start = (currentPage - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  return {
    notifications: paginated,
    pagination: {
      totalItems,
      limit,
      currentPage,
      totalPages,
    },
  };
}

export function getUnreadCount() {
  return notifications.filter((item) => !item.isRead).length;
}

export function markAsRead(notificationIDs: string[]) {
  const updatedIDs: string[] = [];
  notificationIDs.forEach((id) => {
    const existing = notifications.find((item) => item.ID === id);
    if (existing && !existing.isRead) {
      existing.isRead = true;
      updatedIDs.push(id);
    }
  });
  return updatedIDs;
}

export function addNotification(notification: Notification) {
  notifications.unshift(notification);
}
