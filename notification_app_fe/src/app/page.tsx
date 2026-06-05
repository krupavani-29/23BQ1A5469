'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Badge,
  IconButton,
  Select,
  MenuItem,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Toolbar,
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  CircularProgress,
  TextField,
  InputAdornment,
  Tooltip,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Stack,
  LinearProgress,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Work as WorkIcon,
  Assessment as AssessmentIcon,
  Event as EventIcon,
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UnreadIcon,
  School as SchoolIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Timer as TimerIcon,
  Info as InfoIcon,
  PlaylistAddCheck as MarkReadIcon,
  Sensors as SensorsIcon,
  Close as CloseIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { clientLog } from './utils/logger';

// Premium Dark Theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
    },
    secondary: {
      main: '#10b981',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#f43f5e',
    },
    background: {
      default: '#080c14',
      paper: '#0f172a',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#0f172a',
          borderRadius: 16,
          border: '1px solid rgba(99, 102, 241, 0.1)',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            borderColor: 'rgba(99, 102, 241, 0.3)',
            boxShadow: '0 8px 32px -4px rgba(99, 102, 241, 0.2)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
  },
});

// Types
interface Notification {
  ID: string;
  Type: 'Placement' | 'Result' | 'Event';
  Message: string;
  Timestamp: string;
  isRead?: boolean;
  priorityScore?: number;
}

interface PaginationState {
  totalItems: number;
  limit: number;
  currentPage: number;
  totalPages: number;
}

// Main Component
export default function NotificationCenter() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // State Management
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [priorityNotifications, setPriorityNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter States
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationState>({
    totalItems: 0,
    limit: 10,
    currentPage: 1,
    totalPages: 1,
  });

  // UI States
  const [activeView, setActiveView] = useState<'all' | 'priority'>('all');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const API_BASE = 'http://localhost:3001';
  const AUTH_TOKEN = 'Bearer student_token_23bq1a5469';

  // ============== UTILITY FUNCTIONS ==============

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Placement':
        return <WorkIcon sx={{ color: '#10b981' }} />;
      case 'Result':
        return <AssessmentIcon sx={{ color: '#f59e0b' }} />;
      case 'Event':
        return <EventIcon sx={{ color: '#6366f1' }} />;
      default:
        return <NotificationsIcon />;
    }
  };

  const calculatePriorityScore = (notification: Notification): number => {
    const weights: Record<string, number> = {
      Placement: 3,
      Result: 2,
      Event: 1,
    };

    const weight = weights[notification.Type] || 0;
    const isoStr = notification.Timestamp.replace(' ', 'T');
    const epochSeconds = Math.floor(new Date(isoStr).getTime() / 1000);
    return weight * 86400 + epochSeconds;
  };

  const formatTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp.replace(' ', 'T'));
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  };

  // ============== API CALLS ==============

  const fetchNotifications = async (page = 1) => {
    try {
      setLoading(true);
      await clientLog('info', 'component', `Fetching page ${page}`);

      const response = await axios.get(`${API_BASE}/evaluation-service/notifications`, {
        params: {
          limit: pagination.limit,
          page,
          notification_type: filterType !== 'all' ? filterType : undefined,
          is_read: filterStatus !== 'all' ? (filterStatus === 'unread') : undefined,
        },
        headers: { Authorization: AUTH_TOKEN },
      });

      if (response.data.success) {
        const notifs = response.data.data.notifications;
        setAllNotifications(notifs);
        setFilteredNotifications(notifs);
        setPagination(response.data.data.pagination);
        setCurrentPage(page);
        setLastUpdated(new Date());
        await clientLog('info', 'handler', `Loaded notifications ok`);
      }
    } catch (error) {
      await clientLog('error', 'api', `Error loading notifications`);
      setSnackbar({ open: true, message: 'Failed to load notifications' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API_BASE}/evaluation-service/notifications/unread-count`, {
        headers: { Authorization: AUTH_TOKEN },
      });

      if (response.data.success) {
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markNotificationAsRead = async (notificationID: string) => {
    try {
      await clientLog('info', 'handler', `Marking notification read`);

      await axios.patch(
        `${API_BASE}/evaluation-service/notifications/read`,
        { notificationIDs: [notificationID] },
        { headers: { Authorization: AUTH_TOKEN } }
      );

      setAllNotifications(prev =>
        prev.map(n => (n.ID === notificationID ? { ...n, isRead: true } : n))
      );

      setFilteredNotifications(prev =>
        prev.map(n => (n.ID === notificationID ? { ...n, isRead: true } : n))
      );

      await fetchUnreadCount();
      setSnackbar({ open: true, message: 'Notification marked as read' });
    } catch (error) {
      await clientLog('error', 'api', `Error marking as read`);
    }
  };

  const simulateNewNotification = async () => {
    await clientLog('info', 'component', 'Simulating new notification');

    const mockNotifications: Notification[] = [
      {
        ID: `sim-${Date.now()}`,
        Type: 'Placement',
        Message: 'Google hiring for Software Engineers',
        Timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        isRead: false,
      },
      {
        ID: `sim-${Date.now() + 1}`,
        Type: 'Result',
        Message: 'Final exams results announced',
        Timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        isRead: false,
      },
      {
        ID: `sim-${Date.now() + 2}`,
        Type: 'Event',
        Message: 'Internship fair registrations open',
        Timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        isRead: false,
      },
    ];

    const newNotif = mockNotifications[Math.floor(Math.random() * mockNotifications.length)];
    setAllNotifications(prev => [newNotif, ...prev]);
    setUnreadCount(prev => prev + 1);
    setSnackbar({ open: true, message: '🔔 New notification received!' });

    // Recalculate priority inbox
    updatePriorityInbox([newNotif, ...allNotifications]);
  };

  const updatePriorityInbox = (notifs: Notification[]) => {
    const sorted = [...notifs]
      .map(n => ({ ...n, priorityScore: calculatePriorityScore(n) }))
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, 10);

    setPriorityNotifications(sorted);
  };

  // ============== EFFECTS ==============

  useEffect(() => {
    fetchNotifications(1);
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    updatePriorityInbox(allNotifications);
  }, [allNotifications]);

  useEffect(() => {
    // Simulate real-time updates every 30 seconds
    const interval = setInterval(simulateNewNotification, 30000);
    return () => clearInterval(interval);
  }, [allNotifications]);

  // ============== RENDER NOTIFICATION CARD ==============

  const NotificationCard = ({ notif, isPriority = false }: { notif: Notification; isPriority?: boolean }) => (
    <Card
      sx={{
        cursor: 'pointer',
        opacity: notif.isRead ? 0.7 : 1,
        border: !notif.isRead ? '2px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(99, 102, 241, 0.1)',
      }}
      onClick={() => {
        setSelectedNotification(notif);
        setDialogOpen(true);
        if (!notif.isRead) {
          markNotificationAsRead(notif.ID);
        }
      }}
    >
      <CardContent sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ mt: 1 }}>{getTypeIcon(notif.Type)}</Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Chip
                label={notif.Type}
                size="small"
                sx={{
                  backgroundColor:
                    notif.Type === 'Placement'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : notif.Type === 'Result'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(99, 102, 241, 0.15)',
                  color:
                    notif.Type === 'Placement'
                      ? '#10b981'
                      : notif.Type === 'Result'
                        ? '#f59e0b'
                        : '#6366f1',
                }}
              />

              {!notif.isRead && <Badge variant="dot" color="warning" />}
              {isPriority && <StarIcon sx={{ color: '#f59e0b', fontSize: 16 }} />}
            </Box>

            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {notif.Message}
            </Typography>

            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              <TimerIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
              {formatTime(notif.Timestamp)}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  // ============== MAIN RENDER ==============

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#080c14' }}>
        {/* Header AppBar */}
        <AppBar
          position="static"
          sx={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1a1f3a 100%)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SchoolIcon sx={{ fontSize: 32, color: '#6366f1' }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                  Notification Center
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Student ID: 23BQ1A5469
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Refresh">
                <IconButton onClick={() => fetchNotifications(1)} size="small" disabled={loading}>
                  <RefreshIcon sx={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                </IconButton>
              </Tooltip>

              <Tooltip title={`${unreadCount} unread`}>
                <Badge badgeContent={unreadCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </Tooltip>

              {lastUpdated && (
                <Typography variant="caption" sx={{ color: '#94a3b8', ml: 1 }}>
                  {formatTime(lastUpdated.toISOString())}
                </Typography>
              )}
            </Box>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
          {isMobile ? (
            // Mobile Bottom Nav View
            <Container maxWidth="sm">
              {activeView === 'priority' && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                    ⭐ Priority Inbox
                  </Typography>
                  <Stack spacing={2}>
                    {priorityNotifications.map((notif, idx) => (
                      <Box key={notif.ID}>
                        <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 600 }}>
                            #{idx + 1}
                          </Typography>
                          {notif.priorityScore && (
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              Score: {notif.priorityScore}
                            </Typography>
                          )}
                        </Box>
                        <NotificationCard notif={notif} isPriority />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {activeView === 'all' && (
                <Box>
                  <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={filterType}
                        onChange={(e) => {
                          setFilterType(e.target.value);
                          setCurrentPage(1);
                        }}
                        label="Type"
                      >
                        <MenuItem value="all">All Types</MenuItem>
                        <MenuItem value="Placement">Placement</MenuItem>
                        <MenuItem value="Result">Result</MenuItem>
                        <MenuItem value="Event">Event</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={filterStatus}
                        onChange={(e) => {
                          setFilterStatus(e.target.value);
                          setCurrentPage(1);
                        }}
                        label="Status"
                      >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="unread">Unread</MenuItem>
                        <MenuItem value="read">Read</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {loading && <LinearProgress sx={{ mb: 2 }} />}

                  <Stack spacing={2}>
                    {filteredNotifications.map(notif => (
                      <NotificationCard key={notif.ID} notif={notif} />
                    ))}
                  </Stack>

                  {filteredNotifications.length === 0 && !loading && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <NotificationsIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 2 }} />
                      <Typography sx={{ color: '#94a3b8' }}>No notifications found</Typography>
                    </Box>
                  )}

                  {pagination.totalPages > 1 && (
                    <Pagination
                      count={pagination.totalPages}
                      page={currentPage}
                      onChange={(e, page) => fetchNotifications(page)}
                      sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}
                    />
                  )}
                </Box>
              )}
            </Container>
          ) : (
            // Desktop Grid View
            <Grid container spacing={3}>
              {/* Priority Inbox - Left Column */}
              <Grid item xs={12} md={4}>
                <Paper
                  sx={{
                    p: 3,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(16,185,129,0.05) 100%)',
                    borderRadius: 2,
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StarIcon sx={{ color: '#f59e0b' }} />
                    Priority Inbox
                  </Typography>

                  <Stack spacing={1.5} sx={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                    {priorityNotifications.map((notif, idx) => (
                      <Card
                        key={notif.ID}
                        sx={{
                          backgroundColor: '#0f172a',
                          borderLeft: '4px solid #6366f1',
                          p: 1.5,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setSelectedNotification(notif);
                          setDialogOpen(true);
                        }}
                      >
                        <Typography variant="overline" sx={{ color: '#6366f1', fontSize: 10 }}>
                          #{idx + 1} • Score: {notif.priorityScore?.toFixed(0)}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5, mb: 0.5 }}>
                          {notif.Message}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip label={notif.Type} size="small" />
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            {formatTime(notif.Timestamp)}
                          </Typography>
                        </Box>
                      </Card>
                    ))}
                  </Stack>
                </Paper>
              </Grid>

              {/* All Notifications - Right Column */}
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
                    All Notifications
                  </Typography>

                  <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={filterType}
                        onChange={(e) => {
                          setFilterType(e.target.value);
                          setCurrentPage(1);
                        }}
                        label="Type"
                      >
                        <MenuItem value="all">All Types</MenuItem>
                        <MenuItem value="Placement">Placement</MenuItem>
                        <MenuItem value="Result">Result</MenuItem>
                        <MenuItem value="Event">Event</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={filterStatus}
                        onChange={(e) => {
                          setFilterStatus(e.target.value);
                          setCurrentPage(1);
                        }}
                        label="Status"
                      >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="unread">Unread</MenuItem>
                        <MenuItem value="read">Read</MenuItem>
                      </Select>
                    </FormControl>

                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SensorsIcon />}
                      onClick={simulateNewNotification}
                    >
                      Simulate SSE
                    </Button>
                  </Box>

                  {loading && <LinearProgress sx={{ mb: 2 }} />}

                  <Stack spacing={2} sx={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                    {filteredNotifications.map(notif => (
                      <NotificationCard key={notif.ID} notif={notif} />
                    ))}
                  </Stack>

                  {filteredNotifications.length === 0 && !loading && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <NotificationsIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 2 }} />
                      <Typography sx={{ color: '#94a3b8' }}>No notifications found</Typography>
                    </Box>
                  )}

                  {pagination.totalPages > 1 && (
                    <Pagination
                      count={pagination.totalPages}
                      page={currentPage}
                      onChange={(e, page) => fetchNotifications(page)}
                      sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}
                    />
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}
        </Box>

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <BottomNavigation
            value={activeView}
            onChange={(e, newValue) => setActiveView(newValue)}
            sx={{ borderTop: '1px solid rgba(99, 102, 241, 0.2)' }}
          >
            <BottomNavigationAction label="All" value="all" icon={<NotificationsIcon />} />
            <BottomNavigationAction label="Priority" value="priority" icon={<StarIcon />} />
          </BottomNavigation>
        )}

        {/* Notification Detail Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          {selectedNotification && (
            <>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {getTypeIcon(selectedNotification.Type)}
                  <Typography variant="h6">{selectedNotification.Type}</Typography>
                </Box>
                <IconButton onClick={() => setDialogOpen(false)} size="small">
                  <CloseIcon />
                </IconButton>
              </DialogTitle>

              <DialogContent>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                    {selectedNotification.Message}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Time
                      </Typography>
                      <Typography variant="body2">{selectedNotification.Timestamp}</Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Status
                      </Typography>
                      <Typography variant="body2">{selectedNotification.isRead ? '✓ Read' : '● Unread'}</Typography>
                    </Box>
                  </Box>

                  {selectedNotification.priorityScore && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          Priority Score
                        </Typography>
                        <Typography variant="body2">{selectedNotification.priorityScore.toFixed(0)}</Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </DialogContent>

              <DialogActions>
                {!selectedNotification.isRead && (
                  <Button
                    onClick={() => {
                      markNotificationAsRead(selectedNotification.ID);
                      setDialogOpen(false);
                    }}
                    variant="contained"
                    startIcon={<MarkReadIcon />}
                  >
                    Mark as Read
                  </Button>
                )}
                <Button onClick={() => setDialogOpen(false)}>Close</Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity="info" onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </ThemeProvider>
  );
}

            transform: 'translateY(-3px)',
            borderColor: 'rgba(99, 102, 241, 0.4)',
            boxShadow: '0 12px 30px -4px rgba(99, 102, 241, 0.15)',
          },
        },
      },
    },
  },
});

interface Notification {
  ID: string;
  Type: 'Placement' | 'Result' | 'Event' | string;
  Message: string;
  Timestamp: string;
}

const WEIGHTS: Record<string, number> = {
  Placement: 3,
  Result: 2,
  Event: 1
};

export default function Home() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  
  // Filtering, Search & Pagination State
  const [filterType, setFilterType] = useState<string>('All');
  const [filterRead, setFilterRead] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  
  // Auto-SSE Streaming State
  const [autoStream, setAutoStream] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const autoStreamInterval = useRef<NodeJS.Timeout | null>(null);

  // Mobile Tab (0: All, 1: Priority)
  const [mobileTab, setMobileTab] = useState(0);

  // Fetch Notifications
  const fetchNotifications = async () => {
    setLoading(true);
    await clientLog('info', 'page', 'Loading notifications page');
    try {
      const response = await axios.get('/api/notifications');
      if (response.data && response.data.notifications) {
        setNotifications(response.data.notifications);
        await clientLog('info', 'state', `Loaded ${response.data.notifications.length} notifications`);
      }
    } catch (err: any) {
      await clientLog('error', 'api', `Failed to load notifications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Priority Score Function
  const calculateScore = (type: string, timestampStr: string): number => {
    const weight = WEIGHTS[type] || 0;
    const isoStr = timestampStr.replace(' ', 'T');
    const epochSeconds = Math.floor(new Date(isoStr).getTime() / 1000);
    return (weight * 86400) + epochSeconds;
  };

  // 1. Process all notifications with local state tracking
  const processedNotifications = useMemo(() => {
    return notifications.map(n => ({
      ...n,
      isRead: readIds.has(n.ID),
      score: calculateScore(n.Type, n.Timestamp)
    }));
  }, [notifications, readIds]);

  // Statistics calculation for dynamic dashboard metrics
  const stats = useMemo(() => {
    const total = processedNotifications.length;
    const unread = processedNotifications.filter(n => !n.isRead).length;
    const placement = processedNotifications.filter(n => n.Type === 'Placement').length;
    const result = processedNotifications.filter(n => n.Type === 'Result').length;
    const event = processedNotifications.filter(n => n.Type === 'Event').length;

    const placementPct = total > 0 ? Math.round((placement / total) * 100) : 0;
    const resultPct = total > 0 ? Math.round((result / total) * 100) : 0;
    const eventPct = total > 0 ? Math.round((event / total) * 100) : 0;

    return { total, unread, placement, result, event, placementPct, resultPct, eventPct };
  }, [processedNotifications]);

  // 2. Filter notifications
  const filteredNotifications = useMemo(() => {
    return processedNotifications.filter(n => {
      const typeMatch = filterType === 'All' || n.Type === filterType;
      const readMatch =
        filterRead === 'All' ||
        (filterRead === 'Read' && n.isRead) ||
        (filterRead === 'Unread' && !n.isRead);
      const searchMatch =
        searchQuery === '' ||
        n.Message.toLowerCase().includes(searchQuery.toLowerCase());
      return typeMatch && readMatch && searchMatch;
    });
  }, [processedNotifications, filterType, filterRead, searchQuery]);

  // 3. Paginated notifications
  const paginatedNotifications = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredNotifications.slice(startIndex, startIndex + limit);
  }, [filteredNotifications, page, limit]);

  // 4. Calculate Top 10 Priority Inbox
  const priorityInbox = useMemo(() => {
    return [...processedNotifications]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [processedNotifications]);

  const totalPages = Math.ceil(filteredNotifications.length / limit);

  // Handle Notification Click
  const handleOpenNotification = async (notification: Notification) => {
    setSelectedNotification(notification);
    const newReadIds = new Set(readIds);
    newReadIds.add(notification.ID);
    setReadIds(newReadIds);
    await clientLog('info', 'component', `Opened notification ID ${notification.ID}`);
  };

  const handleCloseNotification = () => {
    setSelectedNotification(null);
  };

  // Bulk action: Mark current visible page as read
  const handleMarkPageAsRead = async () => {
    const newReadIds = new Set(readIds);
    paginatedNotifications.forEach(n => newReadIds.add(n.ID));
    setReadIds(newReadIds);
    await clientLog('info', 'component', 'Marked current page notifications as read');
    setToastMessage('Marked current page notifications as read');
  };

  // Helper to get Notification Type Icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Placement':
        return <WorkIcon sx={{ color: '#f43f5e' }} />;
      case 'Result':
        return <AssessmentIcon sx={{ color: '#10b981' }} />;
      case 'Event':
        return <EventIcon sx={{ color: '#f59e0b' }} />;
      default:
        return <NotificationsIcon sx={{ color: '#6366f1' }} />;
    }
  };

  // Helper to get Notification Chip Color
  const getChipColor = (type: string) => {
    switch (type) {
      case 'Placement':
        return 'error';
      case 'Result':
        return 'secondary';
      case 'Event':
        return 'warning';
      default:
        return 'primary';
    }
  };

  // Real-time Event simulation trigger
  const handleSimulateEvent = async (silent = false) => {
    const types = ['Placement', 'Result', 'Event'];
    const selectedType = types[Math.floor(Math.random() * types.length)];
    const messages: Record<string, string[]> = {
      Placement: [
        'Amazon Web Services drives are opening tonight.',
        'Google recruitment drive scheduled for final-year students.',
        'Microsoft off-campus link is active.',
        'AMD is recruiting Senior Full Stack engineers.'
      ],
      Result: [
        'Semester-VI final exam results have been declared.',
        'Supplementary evaluation results published online.',
        'Coding Contest final leaderboard is out.',
        'Mid-term assessment scorecards are now open.'
      ],
      Event: [
        'Annual Tech Symposium guest lecture begins in 10 minutes.',
        'Workshop on Docker & Kubernetes starts tomorrow.',
        'Placement hackathon registration is open.',
        'Special orientation on cloud microservices.'
      ]
    };

    const typeMsgList = messages[selectedType];
    const message = typeMsgList[Math.floor(Math.random() * typeMsgList.length)];
    
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const newNotification: Notification = {
      ID: Math.random().toString(36).substr(2, 9),
      Type: selectedType,
      Message: message,
      Timestamp: timestampStr
    };

    setNotifications(prev => [newNotification, ...prev]);
    if (!silent) {
      setToastMessage(`Simulated live stream push: ${selectedType}`);
      await clientLog('info', 'state', `Simulated new event pushed: ${selectedType}`);
    }
  };

  // Auto-streaming trigger setup
  useEffect(() => {
    if (autoStream) {
      clientLog('info', 'component', 'Auto streaming simulation started');
      autoStreamInterval.current = setInterval(() => {
        handleSimulateEvent(false);
      }, 8000);
    } else {
      if (autoStreamInterval.current) {
        clearInterval(autoStreamInterval.current);
        clientLog('info', 'component', 'Auto streaming simulation stopped');
      }
    }
    return () => {
      if (autoStreamInterval.current) clearInterval(autoStreamInterval.current);
    };
  }, [autoStream]);

  // Search keyword highlight helper
  const highlightQuery = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} style={{ backgroundColor: 'rgba(99, 102, 241, 0.4)', color: '#fff', borderRadius: 4, padding: '2px 4px' }}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ pb: { xs: 8, md: 4 }, minHeight: '100vh', backgroundColor: 'background.default' }}>
        
        {/* Sleek App Header Bar */}
        <AppBar position="sticky" sx={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(99, 102, 241, 0.15)' }}>
          <Container maxWidth="xl">
            <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <SchoolIcon color="primary" sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '.15rem', color: 'inherit', lineHeight: 1.2 }}>
                    ALUMNI-STUDENT NEXUS
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SensorsIcon sx={{ fontSize: 14 }} /> Evaluation Sandbox
                  </Typography>
                </Box>
              </Box>

              {/* Student Details Banner */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    Roll No: 23BQ1A5469
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    GitHub: krupavani-29
                  </Typography>
                </Box>
                <IconButton onClick={fetchNotifications} size="medium" sx={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <RefreshIcon />
                </IconButton>
                <Badge badgeContent={unreadCount} color="error" overlap="circular">
                  <Box sx={{ p: 1, borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    <NotificationsIcon color="primary" />
                  </Box>
                </Badge>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
              <CircularProgress size={60} thickness={4} />
            </Box>
          ) : (
            <React.Fragment>

              {/* Dashboard Statistics Overview Section */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ borderLeft: '4px solid #6366f1' }}>
                    <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="caption" color="text.secondary">TOTAL UNREAD BADGES</Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: 'primary.main', my: 0.5 }}>{stats.unread}</Typography>
                      <Typography variant="caption" color="text.secondary">Out of {stats.total} total notifications</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ borderLeft: '4px solid #f43f5e' }}>
                    <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">CAREER & PLACEMENTS</Typography>
                        <Chip label={`${stats.placement} items`} size="small" color="error" variant="outlined" />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{stats.placementPct}% share</Typography>
                      <LinearProgress variant="determinate" value={stats.placementPct} color="error" sx={{ height: 6, borderRadius: 3 }} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ borderLeft: '4px solid #10b981' }}>
                    <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">ACADEMIC RESULTS</Typography>
                        <Chip label={`${stats.result} items`} size="small" color="secondary" variant="outlined" />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{stats.resultPct}% share</Typography>
                      <LinearProgress variant="determinate" value={stats.resultPct} color="secondary" sx={{ height: 6, borderRadius: 3 }} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ borderLeft: '4px solid #f59e0b' }}>
                    <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">CAMPUS EVENTS</Typography>
                        <Chip label={`${stats.event} items`} size="small" color="warning" variant="outlined" />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{stats.eventPct}% share</Typography>
                      <LinearProgress variant="determinate" value={stats.eventPct} color="warning" sx={{ height: 6, borderRadius: 3 }} />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Main Dashboard Columns */}
              <Grid container spacing={3}>
                
                {/* Left Column: Priority Inbox (Top 10) */}
                <Grid
                  item
                  xs={12}
                  md={4}
                  sx={{ display: { xs: mobileTab === 1 ? 'block' : 'none', md: 'block' } }}
                >
                  <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5, backgroundColor: 'rgba(99, 102, 241, 0.04)', border: '1px dashed rgba(99, 102, 241, 0.3)', borderRadius: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TimerIcon color="primary" />
                        Priority Inbox (Top 10)
                      </Typography>
                      <Tooltip title="Calculate: (Weight * 86400) + UnixTimestamp. Surfaces Placements first, keeping results and events chronological unless placements occur.">
                        <IconButton size="small"><InfoIcon sx={{ fontSize: 18 }} /></IconButton>
                      </Tooltip>
                    </Box>
                    
                    {/* Live stream triggers */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={autoStream}
                            onChange={(e) => setAutoStream(e.target.checked)}
                            color="primary"
                          />
                        }
                        label={<Typography variant="caption">Auto-Stream SSE</Typography>}
                      />
                      <Button variant="contained" size="small" onClick={() => handleSimulateEvent(false)}>
                        Simulate Push
                      </Button>
                    </Box>
                  </Paper>

                  <List sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {priorityInbox.map((n, idx) => (
                      <Card
                        key={n.ID}
                        onClick={() => handleOpenNotification(n)}
                        sx={{
                          cursor: 'pointer',
                          opacity: n.isRead ? 0.75 : 1,
                          position: 'relative',
                          overflow: 'visible',
                        }}
                      >
                        {!n.isRead && (
                          <Box
                            sx={{
                              width: 6,
                              height: '100%',
                              backgroundColor: 'primary.main',
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              borderTopLeftRadius: 16,
                              borderBottomLeftRadius: 16,
                            }}
                          />
                        )}
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {getTypeIcon(n.Type)}
                              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                                #{idx + 1} | Score: {n.score}
                              </Typography>
                            </Box>
                            <Chip label={n.Type} size="small" color={getChipColor(n.Type)} />
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: !n.isRead ? 800 : 400, mb: 1, color: 'text.primary' }}>
                            {n.Message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {n.Timestamp}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </List>
                </Grid>

                {/* Right Column: All Inbox (Filters, Search, Pagination) */}
                <Grid
                  item
                  xs={12}
                  md={8}
                  sx={{ display: { xs: mobileTab === 0 ? 'block' : 'none', md: 'block' } }}
                >
                  
                  {/* Toolbar Card containing search & filters */}
                  <Paper sx={{ p: 2, mb: 3, display: 'flex', flexDirection: 'column', gap: 2, backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <TextField
                        size="small"
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPage(1);
                        }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon color="disabled" />
                            </InputAdornment>
                          ),
                        }}
                        sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 250 } }}
                      />

                      <Button
                        variant="outlined"
                        startIcon={<MarkReadIcon />}
                        onClick={handleMarkPageAsRead}
                        disabled={paginatedNotifications.length === 0}
                      >
                        Mark Page Read
                      </Button>
                    </Box>

                    <Divider sx={{ opacity: 0.5 }} />

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FilterIcon color="disabled" />
                        <Typography variant="body2" color="text.secondary">Filters:</Typography>
                      </Box>
                      
                      {/* Type Filter */}
                      <Select
                        size="small"
                        value={filterType}
                        onChange={(e) => {
                          setFilterType(e.target.value);
                          setPage(1);
                          clientLog('info', 'component', `Changed filter type to ${e.target.value}`);
                        }}
                        sx={{ minWidth: 140 }}
                      >
                        <MenuItem value="All">All Categories</MenuItem>
                        <MenuItem value="Placement">Placement</MenuItem>
                        <MenuItem value="Result">Result</MenuItem>
                        <MenuItem value="Event">Event</MenuItem>
                      </Select>

                      {/* Read Filter */}
                      <Select
                        size="small"
                        value={filterRead}
                        onChange={(e) => {
                          setFilterRead(e.target.value);
                          setPage(1);
                          clientLog('info', 'component', `Changed status filter to ${e.target.value}`);
                        }}
                        sx={{ minWidth: 140 }}
                      >
                        <MenuItem value="All">Read & Unread</MenuItem>
                        <MenuItem value="Read">Read</MenuItem>
                        <MenuItem value="Unread">Unread</MenuItem>
                      </Select>

                      {/* Limit Filter */}
                      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">Display:</Typography>
                        <Select
                          size="small"
                          value={limit}
                          onChange={(e) => {
                            setLimit(Number(e.target.value));
                            setPage(1);
                          }}
                        >
                          <MenuItem value={5}>5 items</MenuItem>
                          <MenuItem value={10}>10 items</MenuItem>
                          <MenuItem value={25}>25 items</MenuItem>
                        </Select>
                      </Box>
                    </Box>
                  </Paper>

                  {/* Main List */}
                  <Box sx={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {paginatedNotifications.length === 0 ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                          No notifications found matching these filters.
                        </Typography>
                      </Box>
                    ) : (
                      paginatedNotifications.map((n) => (
                        <Card
                          key={n.ID}
                          onClick={() => handleOpenNotification(n)}
                          sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            p: 2,
                            opacity: n.isRead ? 0.65 : 1,
                            borderLeft: n.isRead ? '4px solid transparent' : '4px solid #6366f1',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                            {n.isRead ? <CheckCircleIcon sx={{ color: 'text.secondary' }} /> : <UnreadIcon color="primary" />}
                          </Box>
                          <Box sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                              <Chip label={n.Type} size="small" color={getChipColor(n.Type)} variant="outlined" />
                              <Typography variant="caption" color="text.secondary">
                                {n.Timestamp}
                              </Typography>
                            </Box>
                            <Typography variant="body1" sx={{ fontWeight: !n.isRead ? 800 : 400, color: 'text.primary' }}>
                              {highlightQuery(n.Message, searchQuery)}
                            </Typography>
                          </Box>
                          <IconButton size="small" color="inherit">
                            {getTypeIcon(n.Type)}
                          </IconButton>
                        </Card>
                      ))
                    )}
                  </Box>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
                      <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_, value) => {
                          setPage(value);
                          clientLog('info', 'component', `Navigated to page ${value}`);
                        }}
                        color="primary"
                      />
                    </Box>
                  )}
                </Grid>

              </Grid>
            </React.Fragment>
          )}
        </Container>

        {/* Dialog / Details Modal */}
        <Dialog open={!!selectedNotification} onClose={handleCloseNotification} fullWidth maxWidth="sm">
          {selectedNotification && (
            <React.Fragment>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1.5 }}>
                {getTypeIcon(selectedNotification.Type)}
                <Typography variant="h6" component="span" sx={{ fontWeight: 800 }}>
                  {selectedNotification.Type} Notification Details
                </Typography>
              </DialogTitle>
              <Divider />
              <DialogContent sx={{ py: 3 }}>
                <Typography variant="body1" sx={{ mb: 3, fontSize: '1.2rem', lineHeight: 1.6, color: 'text.primary' }}>
                  {selectedNotification.Message}
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 1, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                    ALGORITHM SCORES & METRICS:
                  </Typography>
                  <Typography variant="body2" color="text.primary">
                    • <strong>Priority Score</strong>: {calculateScore(selectedNotification.Type, selectedNotification.Timestamp)}
                  </Typography>
                  <Typography variant="body2" color="text.primary">
                    • <strong>Category Weight</strong>: {WEIGHTS[selectedNotification.Type] || 0} (Multiplier: { (WEIGHTS[selectedNotification.Type] || 0) * 86400 } seconds)
                  </Typography>
                </Paper>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Received: {selectedNotification.Timestamp}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    UUID: {selectedNotification.ID}
                  </Typography>
                </Box>
              </DialogContent>
              <Divider />
              <DialogActions sx={{ p: 2 }}>
                <Button onClick={handleCloseNotification} variant="contained" color="primary">
                  Close
                </Button>
              </DialogActions>
            </React.Fragment>
          )}
        </Dialog>

        {/* Floating Snackbars for Toast Alerts */}
        <Snackbar
          open={!!toastMessage}
          autoHideDuration={4000}
          onClose={() => setToastMessage(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setToastMessage(null)} severity="info" sx={{ width: '100%', borderRadius: 3 }}>
            {toastMessage}
          </Alert>
        </Snackbar>

        {/* Mobile Navigation Bottom bar */}
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            display: { xs: 'block', md: 'none' },
            borderTop: '1px solid rgba(99, 102, 241, 0.15)',
            zIndex: 1000
          }}
          elevation={3}
        >
          <BottomNavigation
            value={mobileTab}
            onChange={(_, newValue) => {
              setMobileTab(newValue);
              clientLog('info', 'component', `Switched mobile tab to ${newValue === 0 ? 'All' : 'Priority'}`);
            }}
            showLabels
            sx={{ backgroundColor: '#0f172a' }}
          >
            <BottomNavigationAction label="All Notifications" icon={<NotificationsIcon />} />
            <BottomNavigationAction label="Priority Inbox" icon={<TimerIcon />} />
          </BottomNavigation>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
