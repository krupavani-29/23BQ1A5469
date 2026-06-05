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

// Premium Futuristic Dark Theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo Neon
    },
    secondary: {
      main: '#10b981', // Emerald Neon
    },
    warning: {
      main: '#f59e0b', // Amber Glow
    },
    error: {
      main: '#f43f5e', // Cyber Pink
    },
    background: {
      default: '#030712', // Deep Space Black
      paper: 'rgba(17, 24, 39, 0.7)', // Translucent Glass
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
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#4b5563 #1f2937',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#090d16',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(180deg, #6366f1 0%, #a855f7 100%)',
            borderRadius: '4px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
          backdropFilter: 'blur(16px)',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
            pointerEvents: 'none',
            zIndex: 1,
          },
          '&:hover': {
            borderColor: 'rgba(99, 102, 241, 0.4)',
            boxShadow: '0 20px 40px -15px rgba(99, 102, 241, 0.3)',
            transform: 'translateY(-4px)',
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

  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  
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
    setMounted(true);
    fetchNotifications();
  }, []);

  // Connect to real SSE stream if backend is available
  useEffect(() => {
    const eventSource = new EventSource('http://localhost:3001/evaluation-service/notifications/stream');
    
    eventSource.onopen = () => {
      setSseConnected(true);
    };

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
      setSseConnected(false);
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
        return <WorkIcon sx={{ color: '#f43f5e', filter: 'drop-shadow(0 0 8px rgba(244, 63, 94, 0.4))' }} />;
      case 'Result':
        return <AssessmentIcon sx={{ color: '#10b981', filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))' }} />;
      case 'Event':
        return <EventIcon sx={{ color: '#f59e0b', filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.4))' }} />;
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
            <mark key={i} style={{ backgroundColor: 'rgba(99, 102, 241, 0.5)', color: '#fff', borderRadius: 4, padding: '2px 4px', fontWeight: 'bold' }}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  if (!mounted) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'background.default' }}>
          <CircularProgress size={60} thickness={4} />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ pb: { xs: 8, md: 4 }, minHeight: '100vh', backgroundColor: 'background.default' }}>
        
        {/* Sleek App Header Bar */}
        <AppBar position="sticky" sx={{ background: 'rgba(3, 7, 18, 0.75)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', zIndex: 1100 }}>
          <Container maxWidth="xl">
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: '70px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <SchoolIcon color="primary" sx={{ fontSize: 36, filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))' }} />
                  <span className="live-glow" style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: sseConnected ? '#10b981' : '#ef4444' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '.18rem', color: '#f8fafc', lineHeight: 1.2, background: 'linear-gradient(90deg, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    ALUMNI-STUDENT NEXUS
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 'bold' }}>
                    <SensorsIcon sx={{ fontSize: 14 }} /> SSE {sseConnected ? 'Connected' : 'Offline'}
                  </Typography>
                </Box>
              </Box>

              {/* Student Details Banner */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                    Roll No: 23BQ1A5469
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                    GitHub: krupavani-29
                  </Typography>
                </Box>
                <IconButton onClick={fetchNotifications} size="medium" sx={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', '&:hover': { background: 'rgba(255,255,255,0.08)', transform: 'rotate(180deg)', transition: 'all 0.5s ease' } }}>
                  <RefreshIcon />
                </IconButton>
                <Badge badgeContent={stats.unread} color="error" overlap="circular" sx={{ '& .MuiBadge-badge': { animation: stats.unread > 0 ? 'pulse 2s infinite' : 'none' } }}>
                  <Box sx={{ p: 1.2, borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)' }}>
                    <NotificationsIcon color="primary" />
                  </Box>
                </Badge>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
              <CircularProgress size={60} thickness={4} />
            </Box>
          ) : (
            <React.Fragment>

              {/* Dashboard Statistics Overview Section */}
              <Grid container spacing={3} sx={{ mb: 5 }}>
                <Grid xs={12} sm={6} md={3}>
                  <Card sx={{ borderLeft: '4px solid #6366f1' }}>
                    <CardContent sx={{ py: 2.5, '&:last-child': { pb: 2.5 } }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', letterSpacing: '0.05em' }}>TOTAL UNREAD BADGES</Typography>
                      <Typography variant="h3" sx={{ fontWeight: 900, color: '#6366f1', my: 0.5, textShadow: '0 0 10px rgba(99, 102, 241, 0.2)' }}>{stats.unread}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Out of {stats.total} total notifications</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid xs={12} sm={6} md={3}>
                  <Card sx={{ borderLeft: '4px solid #f43f5e' }}>
                    <CardContent sx={{ py: 2.5, '&:last-child': { pb: 2.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', letterSpacing: '0.05em' }}>CAREER & PLACEMENTS</Typography>
                        <Chip label={`${stats.placement} items`} size="small" color="error" variant="outlined" sx={{ borderRadius: '6px', fontWeight: 'bold' }} />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#f43f5e' }}>{stats.placementPct}% share</Typography>
                      <LinearProgress variant="determinate" value={stats.placementPct} color="error" sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(244, 63, 94, 0.1)' }} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid xs={12} sm={6} md={3}>
                  <Card sx={{ borderLeft: '4px solid #10b981' }}>
                    <CardContent sx={{ py: 2.5, '&:last-child': { pb: 2.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', letterSpacing: '0.05em' }}>ACADEMIC RESULTS</Typography>
                        <Chip label={`${stats.result} items`} size="small" color="secondary" variant="outlined" sx={{ borderRadius: '6px', fontWeight: 'bold' }} />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#10b981' }}>{stats.resultPct}% share</Typography>
                      <LinearProgress variant="determinate" value={stats.resultPct} color="secondary" sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(16, 185, 129, 0.1)' }} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid xs={12} sm={6} md={3}>
                  <Card sx={{ borderLeft: '4px solid #f59e0b' }}>
                    <CardContent sx={{ py: 2.5, '&:last-child': { pb: 2.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', letterSpacing: '0.05em' }}>CAMPUS EVENTS</Typography>
                        <Chip label={`${stats.event} items`} size="small" color="warning" variant="outlined" sx={{ borderRadius: '6px', fontWeight: 'bold' }} />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: '#f59e0b' }}>{stats.eventPct}% share</Typography>
                      <LinearProgress variant="determinate" value={stats.eventPct} color="warning" sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(245, 158, 11, 0.1)' }} />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Main Dashboard Columns */}
              <Grid container spacing={4}>
                
                {/* Left Column: Priority Inbox (Top 10) */}
                <Grid
                  xs={12}
                  md={4}
                  sx={{ display: { xs: mobileTab === 1 ? 'block' : 'none', md: 'block' } }}
                >
                  <Paper sx={{ p: 3, mb: 3, display: 'flex', flexDirection: 'column', gap: 2, background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.05) 100%)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 5, boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.2, letterSpacing: '0.02em', color: '#f8fafc' }}>
                        <TimerIcon sx={{ color: 'primary.main' }} />
                        Priority Inbox (Top 10)
                      </Typography>
                      <Tooltip title="Formula: (Weight * 86400) + UnixTimestamp. Urgency weight: Placement=3, Result=2, Event=1. Lower weight notifications will only override higher weights after 24+ hours.">
                        <IconButton size="small" sx={{ color: 'text.secondary' }}><InfoIcon sx={{ fontSize: 20 }} /></IconButton>
                      </Tooltip>
                    </Box>
                    
                    {/* Live stream triggers */}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="medium"
                            checked={autoStream}
                            onChange={(e) => setAutoStream(e.target.checked)}
                            color="primary"
                          />
                        }
                        label={<Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Auto-Stream SSE</Typography>}
                      />
                      <Button variant="contained" size="small" onClick={() => handleSimulateEvent(false)} sx={{ borderRadius: '8px', fontWeight: 'bold', textTransform: 'none', background: 'linear-gradient(90deg, #6366f1, #a855f7)', boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)' }}>
                        Simulate Push
                      </Button>
                    </Box>
                  </Paper>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', pr: 1 }}>
                    {priorityInbox.map((n, idx) => (
                      <Card
                        key={n.ID}
                        onClick={() => handleOpenNotification(n)}
                        sx={{
                          cursor: 'pointer',
                          opacity: n.isRead ? 0.7 : 1,
                          position: 'relative',
                          borderLeft: !n.isRead ? `5px solid ${n.Type === 'Placement' ? '#f43f5e' : n.Type === 'Result' ? '#10b981' : '#f59e0b'}` : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                              {getTypeIcon(n.Type)}
                              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', fontFamily: 'monospace' }}>
                                #{idx + 1} | Score: {n.score}
                              </Typography>
                            </Box>
                            <Chip label={n.Type} size="small" color={getChipColor(n.Type)} sx={{ borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', height: '22px' }} />
                          </Box>
                          <Typography variant="body1" sx={{ fontWeight: !n.isRead ? 800 : 500, mb: 1.5, color: '#f8fafc', lineHeight: 1.4 }}>
                            {n.Message}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TimerIcon sx={{ fontSize: 12 }} /> {n.Timestamp}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Grid>

                {/* Right Column: All Inbox (Filters, Search, Pagination) */}
                <Grid
                  xs={12}
                  md={8}
                  sx={{ display: { xs: mobileTab === 0 ? 'block' : 'none', md: 'block' } }}
                >
                  
                  {/* Toolbar Card containing search & filters */}
                  <Paper sx={{ p: 3, mb: 3, display: 'flex', flexDirection: 'column', gap: 2.5, backgroundColor: 'rgba(17, 24, 39, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 5, boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <TextField
                        size="medium"
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPage(1);
                        }}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon color="disabled" />
                              </InputAdornment>
                            ),
                          },
                        }}
                        sx={{
                          flexGrow: 1,
                          minWidth: { xs: '100%', sm: 250 },
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            backgroundColor: 'rgba(3, 7, 18, 0.4)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              borderColor: 'rgba(99, 102, 241, 0.4)',
                            },
                            '&.Mui-focused': {
                              boxShadow: '0 0 15px rgba(99, 102, 241, 0.2)',
                            }
                          }
                        }}
                      />

                      <Button
                        variant="outlined"
                        startIcon={<MarkReadIcon />}
                        onClick={handleMarkPageAsRead}
                        disabled={paginatedNotifications.length === 0}
                        sx={{ borderRadius: '12px', height: '48px', textTransform: 'none', fontWeight: 'bold' }}
                      >
                        Mark Page Read
                      </Button>
                    </Box>

                    <Divider sx={{ opacity: 0.1 }} />

                    <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FilterIcon color="disabled" />
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Filters:</Typography>
                      </Box>
                      
                      {/* Type Filter */}
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <Select
                          value={filterType}
                          onChange={(e) => {
                            setFilterType(e.target.value);
                            setPage(1);
                            clientLog('info', 'component', `Changed filter type to ${e.target.value}`).catch(() => {});
                          }}
                          sx={{ borderRadius: '10px', backgroundColor: 'rgba(3, 7, 18, 0.4)' }}
                        >
                          <MenuItem value="All">All Categories</MenuItem>
                          <MenuItem value="Placement">Placement</MenuItem>
                          <MenuItem value="Result">Result</MenuItem>
                          <MenuItem value="Event">Event</MenuItem>
                        </Select>
                      </FormControl>

                      {/* Read Filter */}
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <Select
                          value={filterRead}
                          onChange={(e) => {
                            setFilterRead(e.target.value);
                            setPage(1);
                            clientLog('info', 'component', `Changed status filter to ${e.target.value}`).catch(() => {});
                          }}
                          sx={{ borderRadius: '10px', backgroundColor: 'rgba(3, 7, 18, 0.4)' }}
                        >
                          <MenuItem value="All">Read & Unread</MenuItem>
                          <MenuItem value="Read">Read</MenuItem>
                          <MenuItem value="Unread">Unread</MenuItem>
                        </Select>
                      </FormControl>

                      {/* Limit Filter */}
                      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Display:</Typography>
                        <FormControl size="small">
                          <Select
                            value={limit}
                            onChange={(e) => {
                              setLimit(Number(e.target.value));
                              setPage(1);
                            }}
                            sx={{ borderRadius: '8px', backgroundColor: 'rgba(3, 7, 18, 0.4)' }}
                          >
                            <MenuItem value={5}>5 items</MenuItem>
                            <MenuItem value={10}>10 items</MenuItem>
                            <MenuItem value={25}>25 items</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    </Box>
                  </Paper>

                  {/* Main List */}
                  <Box sx={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', gap: 2.5, maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', pr: 1 }}>
                    {paginatedNotifications.length === 0 ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                        <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
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
                            p: 2.5,
                            opacity: n.isRead ? 0.7 : 1,
                            borderLeft: n.isRead ? '4px solid transparent' : '4px solid #6366f1',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2.5 }}>
                            {n.isRead ? <CheckCircleIcon sx={{ color: 'secondary.main', filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.3))' }} /> : <UnreadIcon color="primary" sx={{ filter: 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.3))' }} />}
                          </Box>
                          <Box sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                              <Chip label={n.Type} size="small" color={getChipColor(n.Type)} variant="outlined" sx={{ borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', height: '22px' }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <TimerIcon sx={{ fontSize: 12 }} /> {n.Timestamp}
                              </Typography>
                            </Box>
                            <Typography variant="body1" sx={{ fontWeight: !n.isRead ? 800 : 500, color: '#f8fafc', lineHeight: 1.4 }}>
                              {highlightQuery(n.Message, searchQuery)}
                            </Typography>
                          </Box>
                          <IconButton size="small" sx={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', ml: 2 }}>
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
                        sx={{
                          '& .MuiPaginationItem-root': {
                            borderRadius: '8px',
                            '&.Mui-selected': {
                              background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                              color: '#fff',
                              boxShadow: '0 0 10px rgba(99,102,241,0.4)'
                            }
                          }
                        }}
                      />
                    </Box>
                  )}
                </Grid>

              </Grid>
            </React.Fragment>
          )}
        </Container>

        {/* Dialog / Details Modal */}
        <Dialog open={!!selectedNotification} onClose={handleCloseNotification} fullWidth maxWidth="sm" sx={{ '& .MuiPaper-root': { background: 'linear-gradient(135deg, #090d16 0%, #1e293b 100%)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 6, backdropFilter: 'blur(20px)' } }}>
          {selectedNotification && (
            <React.Fragment>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 2, pt: 3 }}>
                {getTypeIcon(selectedNotification.Type)}
                <Typography variant="h6" component="span" sx={{ fontWeight: 900, letterSpacing: '0.02em', color: '#f8fafc' }}>
                  {selectedNotification.Type} Notification Details
                </Typography>
              </DialogTitle>
              <Divider sx={{ opacity: 0.1 }} />
              <DialogContent sx={{ py: 3.5 }}>
                <Typography variant="body1" sx={{ mb: 4, fontSize: '1.25rem', lineHeight: 1.6, color: '#f8fafc', fontWeight: 500 }}>
                  {selectedNotification.Message}
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 2.5, mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5, backgroundColor: 'rgba(0, 0, 0, 0.25)', borderColor: 'rgba(99, 102, 241, 0.2)', borderRadius: 4 }}>
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                    PRIORITY INBOX RANKING ALGORITHM
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    • <strong>Priority Score</strong>: <span style={{ color: '#6366f1', fontWeight: 'bold' }}>{calculateScore(selectedNotification.Type, selectedNotification.Timestamp)}</span>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    • <strong>Category Weight</strong>: {WEIGHTS[selectedNotification.Type] || 0}
                  </Typography>
                  <LinearProgress variant="determinate" value={((WEIGHTS[selectedNotification.Type] || 0) / 3) * 100} color={getChipColor(selectedNotification.Type)} sx={{ height: 6, borderRadius: 3, mt: 0.5 }} />
                </Paper>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, opacity: 0.7 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Received: {selectedNotification.Timestamp}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                    UUID: {selectedNotification.ID}
                  </Typography>
                </Box>
              </DialogContent>
              <Divider sx={{ opacity: 0.1 }} />
              <DialogActions sx={{ p: 2.5 }}>
                <Button onClick={handleCloseNotification} variant="contained" sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', background: 'linear-gradient(90deg, #6366f1, #a855f7)', px: 4 }}>
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
          <Alert onClose={() => setToastMessage(null)} severity="info" sx={{ width: '100%', borderRadius: 4, fontWeight: 'bold', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(99, 102, 241, 0.3)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
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

      {/* Premium Keyframes and Animations Injected */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(244, 63, 94, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(244, 63, 94, 0);
          }
        }
        .live-glow {
          box-shadow: 0 0 8px currentColor;
          animation: blink 1.5s infinite ease-in-out;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </ThemeProvider>
  );
}
