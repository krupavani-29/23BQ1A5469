'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
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
} from '@mui/icons-material';
import axios from 'axios';
import { clientLog } from './utils/logger';

// Curated Sleek Dark Mode Theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo accent
    },
    secondary: {
      main: '#a855f7', // Purple
    },
    background: {
      default: '#0b0f19', // Deep space dark blue
      paper: '#111827',   // Slate gray paper
    },
    text: {
      primary: '#f3f4f6',
      secondary: '#9ca3af',
    },
  },
  typography: {
    fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111827',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: 'rgba(99, 102, 241, 0.4)',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
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
  
  // Filtering & Pagination State
  const [filterType, setFilterType] = useState<string>('All');
  const [filterRead, setFilterRead] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  
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

  // 1. Process all notifications (filter by read locally if read status is tracked locally)
  const processedNotifications = useMemo(() => {
    return notifications.map(n => ({
      ...n,
      isRead: readIds.has(n.ID),
      score: calculateScore(n.Type, n.Timestamp)
    }));
  }, [notifications, readIds]);

  // 2. Filter notifications for the "All Notifications" list
  const filteredNotifications = useMemo(() => {
    return processedNotifications.filter(n => {
      const typeMatch = filterType === 'All' || n.Type === filterType;
      const readMatch =
        filterRead === 'All' ||
        (filterRead === 'Read' && n.isRead) ||
        (filterRead === 'Unread' && !n.isRead);
      return typeMatch && readMatch;
    });
  }, [processedNotifications, filterType, filterRead]);

  // 3. Paginated notifications for display
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

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return processedNotifications.filter(n => !n.isRead).length;
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

  // Helper to get Notification Type Icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Placement':
        return <WorkIcon sx={{ color: '#ef4444' }} />;
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
        return 'success';
      case 'Event':
        return 'warning';
      default:
        return 'primary';
    }
  };

  // Real-time Event simulation
  const handleSimulateEvent = async () => {
    const types = ['Placement', 'Result', 'Event'];
    const selectedType = types[Math.floor(Math.random() * types.length)];
    const messages: Record<string, string[]> = {
      Placement: [
        'Amazon Web Services drives are opening tonight.',
        'Google recruitment drive scheduled for final-year students.',
        'Microsoft off-campus link is active.'
      ],
      Result: [
        'Semester-VI final exam results have been declared.',
        'Supplementary evaluation results published online.',
        'Coding Contest final leaderboard is out.'
      ],
      Event: [
        'Annual Tech Symposium guest lecture begins in 10 minutes.',
        'Workshop on Docker & Kubernetes starts tomorrow.',
        'Placement hackathon registration is open.'
      ]
    };

    const typeMsgList = messages[selectedType];
    const message = typeMsgList[Math.floor(Math.random() * typeMsgList.length)];
    
    // ISO format string matching DB format "2026-06-05 10:30:00"
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
    await clientLog('info', 'state', `Simulated new event pushed via SSE: ${selectedType}`);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ pb: { xs: 8, md: 0 }, minHeight: '100vh', backgroundColor: 'background.default' }}>
        {/* Navigation Bar */}
        <AppBar position="sticky" sx={{ background: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Container maxWidth="xl">
            <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SchoolIcon color="primary" />
                <Typography
                  variant="h6"
                  noWrap
                  component="div"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: '.1rem',
                    color: 'inherit',
                  }}
                >
                  STUDENT PORTAL
                </Typography>
              </Box>

              {/* Anonymous Candidate Info Banner */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
                  <Typography variant="body2" color="text.secondary">
                    Roll No: <strong>23BQ1A5469</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    GitHub: krupavani-29
                  </Typography>
                </Box>
                <IconButton onClick={fetchNotifications} size="medium">
                  <RefreshIcon />
                </IconButton>
                <Badge badgeContent={unreadCount} color="error">
                  <NotificationsIcon color="action" />
                </Badge>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>

        {/* Dashboard Content */}
        <Container maxWidth="xl" sx={{ mt: 4 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
              <CircularProgress size={60} thickness={4} />
            </Box>
          ) : (
            <Grid container spacing={3}>
              
              {/* Desktop Layout - Left Priority, Right All */}
              {/* Priority Inbox Column */}
              <Grid
                item
                xs={12}
                md={4}
                sx={{
                  display: { xs: mobileTab === 1 ? 'block' : 'none', md: 'block' }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TimerIcon color="primary" />
                    Priority Inbox (Top 10)
                  </Typography>
                  <Button variant="outlined" size="small" onClick={handleSimulateEvent}>
                    Simulate SSE
                  </Button>
                </Box>

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
                            borderTopLeftRadius: 12,
                            borderBottomLeftRadius: 12,
                          }}
                        />
                      )}
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getTypeIcon(n.Type)}
                            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                              #{idx + 1} Priority Score: {n.score}
                            </Typography>
                          </Box>
                          <Chip label={n.Type} size="small" color={getChipColor(n.Type)} />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: !n.isRead ? 'bold' : 'normal', mb: 1 }}>
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

              {/* All Notifications Column */}
              <Grid
                item
                xs={12}
                md={8}
                sx={{
                  display: { xs: mobileTab === 0 ? 'block' : 'none', md: 'block' }
                }}
              >
                {/* Filters Row */}
                <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#111827' }}>
                  <FilterIcon color="disabled" />
                  <Typography variant="body2" color="text.secondary">Filters:</Typography>
                  
                  {/* Type Filter */}
                  <Select
                    size="small"
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setPage(1);
                      clientLog('info', 'component', `Changed filter type to ${e.target.value}`);
                    }}
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value="All">All Types</MenuItem>
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
                      clientLog('info', 'component', `Changed read status filter to ${e.target.value}`);
                    }}
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value="All">Read & Unread</MenuItem>
                    <MenuItem value="Read">Read</MenuItem>
                    <MenuItem value="Unread">Unread</MenuItem>
                  </Select>

                  {/* Limit Filter */}
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>Limit:</Typography>
                  <Select
                    size="small"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <MenuItem value={5}>5 per page</MenuItem>
                    <MenuItem value={10}>10 per page</MenuItem>
                    <MenuItem value={25}>25 per page</MenuItem>
                  </Select>
                </Paper>

                {/* Notifications List */}
                <Box sx={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {paginatedNotifications.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}>
                      <Typography variant="body1" color="text.secondary">
                        No notifications match your filter criteria.
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
                          p: 1.5,
                          opacity: n.isRead ? 0.7 : 1,
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 46 }}>
                          {n.isRead ? <CheckCircleIcon sx={{ color: 'text.secondary' }} /> : <UnreadIcon color="primary" />}
                        </ListItemIcon>
                        <Box sx={{ flexGrow: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                            <Chip label={n.Type} size="small" color={getChipColor(n.Type)} variant="outlined" />
                            <Typography variant="caption" color="text.secondary">
                              {n.Timestamp}
                            </Typography>
                          </Box>
                          <Typography variant="body1" sx={{ fontWeight: !n.isRead ? 'bold' : 'normal' }}>
                            {n.Message}
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
          )}
        </Container>

        {/* Dialog / Details Modal */}
        <Dialog open={!!selectedNotification} onClose={handleCloseNotification} fullWidth maxWidth="sm">
          {selectedNotification && (
            <React.Fragment>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
                {getTypeIcon(selectedNotification.Type)}
                <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
                  {selectedNotification.Type} Notification Details
                </Typography>
              </DialogTitle>
              <Divider />
              <DialogContent sx={{ py: 3 }}>
                <Typography variant="body1" sx={{ mb: 2, fontSize: '1.1rem', lineHeight: 1.6 }}>
                  {selectedNotification.Message}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Received: {selectedNotification.Timestamp}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID: {selectedNotification.ID}
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

        {/* Mobile Navigation bar */}
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            display: { xs: 'block', md: 'none' },
            borderTop: '1px solid rgba(255,255,255,0.08)',
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
            sx={{ backgroundColor: '#111827' }}
          >
            <BottomNavigationAction label="All Inbox" icon={<NotificationsIcon />} />
            <BottomNavigationAction label="Priority (Top 10)" icon={<TimerIcon />} />
          </BottomNavigation>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
