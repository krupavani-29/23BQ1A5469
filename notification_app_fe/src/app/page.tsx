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
  FormControlLabel,
  Switch,
  List,
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
  Search as SearchIcon,
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
  isRead?: boolean;
  score?: number;
}

const WEIGHTS: Record<string, number> = {
  Placement: 3,
  Result: 2,
  Event: 1
};

export default function NotificationCenter() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

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
      const notificationsData = response.data.notifications || response.data.data?.notifications || [];
      setNotifications(notificationsData);
      
      // Sync local read state
      const initialReadIds = new Set<string>();
      notificationsData.forEach((n: any) => {
        if (n.isRead) {
          initialReadIds.add(n.ID);
        }
      });
      setReadIds(initialReadIds);

      await clientLog('info', 'state', `Loaded ${notificationsData.length} notifications`);
    } catch (err: any) {
      await clientLog('error', 'api', `Failed to load notifications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Connect to real SSE stream if backend is available
  useEffect(() => {
    const eventSource = new EventSource('http://localhost:3001/evaluation-service/notifications/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification' && data.notification) {
          const newNotif = data.notification;
          setNotifications(prev => {
            if (prev.some(n => n.ID === newNotif.ID)) return prev;
            const updated = [newNotif, ...prev];
            setToastMessage(`🔔 New real-time event: ${newNotif.Type}`);
            clientLog('info', 'state', `Real-time SSE event received: ${newNotif.Type}`).catch(() => {});
            return updated;
          });
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Priority Score Function
  const calculateScore = (type: string, timestampStr: string): number => {
    const weight = WEIGHTS[type] || 0;
    const isoStr = timestampStr.replace(' ', 'T');
    const epochSeconds = Math.floor(new Date(isoStr).getTime() / 1000);
    return (weight * 86400) + epochSeconds;
  };

  // Process all notifications with local state tracking
  const processedNotifications = useMemo(() => {
    return notifications.map(n => ({
      ...n,
      isRead: n.isRead || readIds.has(n.ID),
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

  // Filter notifications
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

  // Paginated notifications
  const paginatedNotifications = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredNotifications.slice(startIndex, startIndex + limit);
  }, [filteredNotifications, page, limit]);

  // Calculate Top 10 Priority Inbox
  const priorityInbox = useMemo(() => {
    return [...processedNotifications]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
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

    // Update read state on server
    try {
      await axios.patch('/api/notifications/read', { notificationIDs: [notification.ID] });
    } catch (err) {
      console.error('Failed to mark read on server:', err);
    }
  };

  const handleCloseNotification = () => {
    setSelectedNotification(null);
  };

  // Bulk action: Mark current visible page as read
  const handleMarkPageAsRead = async () => {
    const newReadIds = new Set(readIds);
    const idsToMark: string[] = [];
    paginatedNotifications.forEach(n => {
      if (!n.isRead) {
        newReadIds.add(n.ID);
        idsToMark.push(n.ID);
      }
    });
    setReadIds(newReadIds);
    await clientLog('info', 'component', 'Marked current page notifications as read');
    setToastMessage('Marked current page notifications as read');

    if (idsToMark.length > 0) {
      try {
        await axios.patch('/api/notifications/read', { notificationIDs: idsToMark });
      } catch (err) {
        console.error('Failed to mark page as read on server:', err);
      }
    }
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
      clientLog('info', 'component', 'Auto streaming simulation started').catch(() => {});
      autoStreamInterval.current = setInterval(() => {
        handleSimulateEvent(true);
      }, 8000);
    } else {
      if (autoStreamInterval.current) {
        clearInterval(autoStreamInterval.current);
        clientLog('info', 'component', 'Auto streaming simulation stopped').catch(() => {});
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
        <AppBar position="sticky" sx={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(99, 102, 241, 0.15)', zIndex: 1100 }}>
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
                <Badge badgeContent={stats.unread} color="error" overlap="circular">
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
                          clientLog('info', 'component', `Changed filter type to ${e.target.value}`).catch(() => {});
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
                          clientLog('info', 'component', `Changed status filter to ${e.target.value}`).catch(() => {});
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
                          clientLog('info', 'component', `Navigated to page ${value}`).catch(() => {});
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
              clientLog('info', 'component', `Switched mobile tab to ${newValue === 0 ? 'All' : 'Priority'}`).catch(() => {});
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
