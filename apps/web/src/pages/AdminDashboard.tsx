import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getUploadedLogs, deleteUploadedLogs } from '../utils/eventLogger';
import { formatTimestamp } from '../utils/formatTimestamp';
import { GlassCard } from '../components/GlassCard';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface UploadedLog {
  id: string;
  sessionId: string;
  deviceInfo: any;
  logs: any[];
  metadata: any;
  uploadedAt: string;
  lastUpdatedAt?: string;
  userAgent?: string;
}

interface DailyData {
  date: string;
  logs: number;
  events: number;
  sessions: number;
}

interface LogStats {
  totalLogs: number;
  totalEvents: number;
  totalSessions: number;
  deviceTypes: Record<string, number>;
  browsers: Record<string, number>;
  averageEventsPerLog: number;
  averageEventsPerSession: number;
  // Weekly stats
  weeklyLogs: number;
  weeklyEvents: number;
  weeklySessions: number;
  // Daily averages
  avgLogsPerDay: number;
  avgEventsPerDay: number;
  avgSessionsPerDay: number;
  // Time series data for charts
  dailyData: DailyData[];
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<UploadedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<UploadedLog | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [filterSessionId, setFilterSessionId] = useState('');
  const [filterDeviceType, setFilterDeviceType] = useState('');
  const [filterBrowser, setFilterBrowser] = useState('');
  const [sortBy, setSortBy] = useState<'uploadedAt' | 'eventCount' | 'sessionId'>('uploadedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  // Event filters for selected log
  const [eventSearch, setEventSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [eventSortBy, setEventSortBy] = useState<'timestamp' | 'type'>('timestamp');
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadUploadedLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getUploadedLogs();
      
      if (result.success && result.logs) {
        setLogs(result.logs);
        calculateStats(result.logs);
      } else {
        setError(result.error || 'Failed to load logs');
      }
    } catch (err) {
      setError('Failed to load uploaded logs');
    } finally {
      setLoading(false);
    }
  };

  // Check authentication and load logs
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';
    if (!isAuthenticated) {
      navigate('/admin/login');
      return;
    }
    loadUploadedLogs();
  }, [navigate]);
  
  const isAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';
  
  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  const calculateStats = (logData: UploadedLog[]) => {
    const deviceTypes = new Map<string, number>();
    const browsers = new Map<string, number>();
    const sessions = new Set<string>();
    const weeklySessions = new Set<string>();
    let totalEvents = 0;
    let weeklyEvents = 0;
    let weeklyLogs = 0;

    // Calculate date boundaries
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oldestDate = logData.length > 0 
      ? new Date(Math.min(...logData.map(log => new Date(log.uploadedAt).getTime())))
      : now;
    const daysDiff = Math.max(1, Math.ceil((now.getTime() - oldestDate.getTime()) / (24 * 60 * 60 * 1000)));

    // Daily data map
    const dailyDataMap = new Map<string, { logs: number; events: number; sessions: Set<string> }>();

    logData.forEach(log => {
      const logDate = new Date(log.uploadedAt);
      const dateKey = logDate.toISOString().split('T')[0];
      const eventCount = log.logs.length;

      totalEvents += eventCount;
      sessions.add(log.sessionId);

      // Weekly stats
      if (logDate >= oneWeekAgo) {
        weeklyEvents += eventCount;
        weeklyLogs++;
        weeklySessions.add(log.sessionId);
      }

      // Daily aggregation
      if (!dailyDataMap.has(dateKey)) {
        dailyDataMap.set(dateKey, { logs: 0, events: 0, sessions: new Set() });
      }
      const dayData = dailyDataMap.get(dateKey)!;
      dayData.logs++;
      dayData.events += eventCount;
      dayData.sessions.add(log.sessionId);

      // Count device types
      if (log.deviceInfo?.device?.type) {
        const deviceType = log.deviceInfo.device.type;
        deviceTypes.set(deviceType, (deviceTypes.get(deviceType) || 0) + 1);
      }

      // Count browsers
      if (log.userAgent) {
        const userAgent = log.userAgent.toLowerCase();
        let browser = 'Unknown';
        
        if (userAgent.includes('chrome')) browser = 'Chrome';
        else if (userAgent.includes('firefox')) browser = 'Firefox';
        else if (userAgent.includes('safari')) browser = 'Safari';
        else if (userAgent.includes('edge')) browser = 'Edge';
        
        browsers.set(browser, (browsers.get(browser) || 0) + 1);
      }
    });

    // Convert daily data map to array and fill missing days
    const dailyData: DailyData[] = [];
    const startDate = new Date(oneWeekAgo);
    const endDate = new Date(now);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      const dayData = dailyDataMap.get(dateKey) || { logs: 0, events: 0, sessions: new Set<string>() };
      dailyData.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        logs: dayData.logs,
        events: dayData.events,
        sessions: dayData.sessions.size,
      });
    }

    setStats({
      totalLogs: logData.length,
      totalEvents,
      totalSessions: sessions.size,
      deviceTypes: Object.fromEntries(deviceTypes),
      browsers: Object.fromEntries(browsers),
      averageEventsPerLog: logData.length > 0 ? Math.round(totalEvents / logData.length) : 0,
      averageEventsPerSession: sessions.size > 0 ? Math.round(totalEvents / sessions.size) : 0,
      weeklyLogs,
      weeklyEvents,
      weeklySessions: weeklySessions.size,
      avgLogsPerDay: daysDiff > 0 ? Math.round((logData.length / daysDiff) * 10) / 10 : 0,
      avgEventsPerDay: daysDiff > 0 ? Math.round((totalEvents / daysDiff) * 10) / 10 : 0,
      avgSessionsPerDay: daysDiff > 0 ? Math.round((sessions.size / daysDiff) * 10) / 10 : 0,
      dailyData,
    });
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this log? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(logId);
      const result = await deleteUploadedLogs(logId);
      
      if (result.success) {
        setLogs(logs.filter(log => log.id !== logId));
        if (selectedLog?.id === logId) {
          setSelectedLog(null);
        }
        // Recalculate stats
        calculateStats(logs.filter(log => log.id !== logId));
      } else {
        alert(`Failed to delete log: ${result.error}`);
      }
    } catch (err) {
      alert('Failed to delete log');
    } finally {
      setDeleting(null);
    }
  };

  const getDeviceTypeIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return '📱';
      case 'tablet': return '📱';
      case 'desktop': return '💻';
      default: return '🖥️';
    }
  };

  const getBrowserIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return '🌐';
    if (ua.includes('firefox')) return '🦊';
    if (ua.includes('safari')) return '🍎';
    if (ua.includes('edge')) return '🌊';
    return '🌐';
  };

  const getFilteredAndSortedLogs = () => {
    let filtered = logs.filter(log => {
      if (filterSessionId && !log.sessionId.includes(filterSessionId)) return false;
      if (filterDeviceType && log.deviceInfo?.device?.type !== filterDeviceType) return false;
      if (filterBrowser) {
        const userAgent = log.userAgent?.toLowerCase() || '';
        const browser = filterBrowser.toLowerCase();
        if (!userAgent.includes(browser)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'uploadedAt':
          aValue = new Date(a.uploadedAt).getTime();
          bValue = new Date(b.uploadedAt).getTime();
          break;
        case 'eventCount':
          aValue = a.logs.length;
          bValue = b.logs.length;
          break;
        case 'sessionId':
          aValue = a.sessionId;
          bValue = b.sessionId;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sharedrop-logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearAllLogs = async () => {
    if (!confirm('Are you sure you want to delete ALL logs? This action cannot be undone.')) {
      return;
    }

    try {
      const deletePromises = logs.map(log => deleteUploadedLogs(log.id));
      await Promise.all(deletePromises);
      setLogs([]);
      setSelectedLog(null);
      setStats(null);
    } catch (err) {
      alert('Failed to clear all logs');
    }
  };

  const filteredLogs = getFilteredAndSortedLogs();

  // Get filtered and sorted events for selected log
  const getFilteredAndSortedEvents = () => {
    if (!selectedLog) return [];
    
    let filtered = selectedLog.logs.filter(event => {
      // Search filter
      if (eventSearch) {
        const searchLower = eventSearch.toLowerCase();
        const eventType = (event.type || '').toLowerCase();
        const eventDetails = JSON.stringify(event.details || {}).toLowerCase();
        if (!eventType.includes(searchLower) && !eventDetails.includes(searchLower)) {
          return false;
        }
      }
      
      // Type filter
      if (eventTypeFilter && event.type !== eventTypeFilter) {
        return false;
      }
      
      return true;
    });
    
    // Sort events
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (eventSortBy) {
        case 'timestamp':
          aValue = a.timestamp || 0;
          bValue = b.timestamp || 0;
          break;
        case 'type':
          aValue = (a.type || '').toLowerCase();
          bValue = (b.type || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (eventSortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  };

  const filteredEvents = getFilteredAndSortedEvents();
  
  // Get unique event types for filter dropdown
  const getUniqueEventTypes = () => {
    if (!selectedLog) return [];
    const types = new Set(selectedLog.logs.map(event => event.type).filter(Boolean));
    return Array.from(types).sort();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <GlassCard className="p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#A6521B' }}></div>
            <span className="text-lg" style={{ color: '#2C1B12' }}>Loading admin dashboard...</span>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <motion.header
        className="p-4 md:p-6 border-b relative"
        style={{ borderColor: 'rgba(166, 82, 27, 0.1)' }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <motion.img
              src="/logo.png"
              alt="c0py.me Lion Logo"
              className="w-12 h-12 md:w-16 md:h-16"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#2C1B12' }}>
                Admin Dashboard
              </h1>
              <p className="text-sm md:text-base" style={{ color: '#A6521B', opacity: 0.8 }}>
                Incoming Feedback Viewer & Analytics
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={loadUploadedLogs}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
            >
              <span className="text-orange-700">🔄</span>
              <span className="text-xs md:text-sm font-medium hidden sm:inline" style={{ color: '#A6521B' }}>
                Refresh
              </span>
            </button>

            <button
              onClick={exportLogs}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
            >
              <span className="text-orange-700">📥</span>
              <span className="text-xs md:text-sm font-medium hidden sm:inline" style={{ color: '#A6521B' }}>
                Export
              </span>
            </button>

            <button
              onClick={clearAllLogs}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
            >
              <span className="text-orange-700">🗑️</span>
              <span className="text-xs md:text-sm font-medium hidden sm:inline" style={{ color: '#A6521B' }}>
                Clear All
              </span>
            </button>

            <button
              onClick={() => navigate('/app')}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
            >
              <span className="text-orange-700">←</span>
              <span className="text-xs md:text-sm font-medium hidden sm:inline" style={{ color: '#A6521B' }}>
                Back
              </span>
            </button>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <motion.div 
            className="mb-6 p-4 rounded-xl border"
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#DC2626'
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.div>
        )}

        {/* Statistics Cards with Graphs */}
        {stats && (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Total Logs Card */}
            <GlassCard className="p-6" hover>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}>
                      <span className="text-xl">📊</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium" style={{ color: '#A6521B', opacity: 0.8 }}>Total Logs</p>
                      <p className="text-2xl font-bold" style={{ color: '#2C1B12' }}>{stats.totalLogs}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <p style={{ color: '#A6521B', opacity: 0.6 }}>This Week</p>
                    <p className="font-semibold" style={{ color: '#2C1B12' }}>{stats.weeklyLogs}</p>
                  </div>
                  <div>
                    <p style={{ color: '#A6521B', opacity: 0.6 }}>AVG/Day</p>
                    <p className="font-semibold" style={{ color: '#2C1B12' }}>{stats.avgLogsPerDay}</p>
                  </div>
                </div>
              </div>
              <div style={{ height: '120px', width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart data={stats.dailyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <Line 
                      type="monotone" 
                      dataKey="logs" 
                      stroke="#A6521B" 
                      strokeWidth={2}
                      dot={{ fill: '#A6521B', r: 3 }}
                    />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 9, fill: '#A6521B', opacity: 0.7 }}
                      axisLine={{ stroke: '#A6521B', opacity: 0.3 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(166, 82, 27, 0.2)',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Total Events Card */}
            <GlassCard className="p-6" hover>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}>
                      <span className="text-xl">📈</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium" style={{ color: '#A6521B', opacity: 0.8 }}>Total Events</p>
                      <p className="text-2xl font-bold" style={{ color: '#2C1B12' }}>{stats.totalEvents}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <p style={{ color: '#A6521B', opacity: 0.6 }}>This Week</p>
                    <p className="font-semibold" style={{ color: '#2C1B12' }}>{stats.weeklyEvents}</p>
                  </div>
                  <div>
                    <p style={{ color: '#A6521B', opacity: 0.6 }}>AVG/Day</p>
                    <p className="font-semibold" style={{ color: '#2C1B12' }}>{stats.avgEventsPerDay}</p>
                  </div>
                </div>
              </div>
              <div style={{ height: '120px', width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={stats.dailyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <Bar 
                      dataKey="events" 
                      fill="#A6521B"
                      radius={[4, 4, 0, 0]}
                    />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 9, fill: '#A6521B', opacity: 0.7 }}
                      axisLine={{ stroke: '#A6521B', opacity: 0.3 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(166, 82, 27, 0.2)',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Unique Sessions Card */}
            <GlassCard className="p-6" hover>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}>
                      <span className="text-xl">👥</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium" style={{ color: '#A6521B', opacity: 0.8 }}>Unique Sessions</p>
                      <p className="text-2xl font-bold" style={{ color: '#2C1B12' }}>{stats.totalSessions}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <p style={{ color: '#A6521B', opacity: 0.6 }}>This Week</p>
                    <p className="font-semibold" style={{ color: '#2C1B12' }}>{stats.weeklySessions}</p>
                  </div>
                  <div>
                    <p style={{ color: '#A6521B', opacity: 0.6 }}>AVG/Day</p>
                    <p className="font-semibold" style={{ color: '#2C1B12' }}>{stats.avgSessionsPerDay}</p>
                  </div>
                </div>
              </div>
              <div style={{ height: '120px', width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart data={stats.dailyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <Line 
                      type="monotone" 
                      dataKey="sessions" 
                      stroke="#F6C148" 
                      strokeWidth={2}
                      dot={{ fill: '#F6C148', r: 3 }}
                    />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 9, fill: '#A6521B', opacity: 0.7 }}
                      axisLine={{ stroke: '#A6521B', opacity: 0.3 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(166, 82, 27, 0.2)',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Filters */}
        <GlassCard className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: '#2C1B12' }}>Filters & Sorting</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#A6521B' }}>Session ID</label>
              <input
                type="text"
                value={filterSessionId}
                onChange={(e) => setFilterSessionId(e.target.value)}
                placeholder="Filter by session ID..."
                className="w-full px-3 py-2 rounded-xl border bg-white/60 shadow focus:outline-none focus:ring-2 focus:ring-orange-300 text-lg"
                style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#A6521B' }}>Device Type</label>
              <select
                value={filterDeviceType}
                onChange={(e) => setFilterDeviceType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-white/60 shadow focus:outline-none focus:ring-2 focus:ring-orange-300 text-lg"
                style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}
              >
                <option value="">All Devices</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#A6521B' }}>Browser</label>
              <select
                value={filterBrowser}
                onChange={(e) => setFilterBrowser(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border bg-white/60 shadow focus:outline-none focus:ring-2 focus:ring-orange-300 text-lg"
                style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}
              >
                <option value="">All Browsers</option>
                <option value="chrome">Chrome</option>
                <option value="firefox">Firefox</option>
                <option value="safari">Safari</option>
                <option value="edge">Edge</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#A6521B' }}>Sort By</label>
              <div className="flex space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="flex-1 px-3 py-2 rounded-xl border bg-white/60 shadow focus:outline-none focus:ring-2 focus:ring-orange-300 text-lg"
                  style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}
                >
                  <option value="uploadedAt">Upload Date</option>
                  <option value="eventCount">Event Count</option>
                  <option value="sessionId">Session ID</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 rounded-xl border transition-all hover:scale-105"
                  style={{ 
                    borderColor: 'rgba(166, 82, 27, 0.2)', 
                    backgroundColor: 'rgba(166, 82, 27, 0.1)',
                    color: '#A6521B'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        </GlassCard>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Logs List */}
            <div className="lg:col-span-1">
              <GlassCard>
                <div className="p-6 border-b" style={{ borderColor: 'rgba(166, 82, 27, 0.1)' }}>
                  <h3 className="text-lg font-semibold" style={{ color: '#2C1B12' }}>Uploaded Sessions ({filteredLogs.length})</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {filteredLogs.length === 0 ? (
                    <div className="p-6 text-center" style={{ color: '#A6521B', opacity: 0.6 }}>
                      No logs found matching filters
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {filteredLogs.map((log) => (
                        <motion.div
                          key={log.id}
                          className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-105 ${
                            selectedLog?.id === log.id
                              ? 'border-orange-500'
                              : 'border-orange-200'
                          }`}
                          style={{ 
                            backgroundColor: selectedLog?.id === log.id 
                              ? 'rgba(166, 82, 27, 0.1)' 
                              : 'rgba(255, 255, 255, 0.6)',
                            borderColor: selectedLog?.id === log.id 
                              ? 'rgba(166, 82, 27, 0.4)' 
                              : 'rgba(166, 82, 27, 0.2)'
                          }}
                          onClick={() => {
                            setSelectedLog(log);
                            // Reset event filters when selecting a new log
                            setEventSearch('');
                            setEventTypeFilter('');
                            setEventSortBy('timestamp');
                            setEventSortOrder('desc');
                          }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {getDeviceTypeIcon(log.deviceInfo?.device?.type || 'desktop')}
                              <span className="font-medium text-sm" style={{ color: '#2C1B12' }}>
                                {log.deviceInfo?.device?.type || 'Unknown'} Device
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLog(log.id);
                              }}
                              disabled={deleting === log.id}
                              className="text-red-600 hover:text-red-800 text-sm transition-colors"
                            >
                              {deleting === log.id ? 'Deleting...' : '🗑️'}
                            </button>
                          </div>
                          
                          <div className="text-xs space-y-1" style={{ color: '#A6521B', opacity: 0.8 }}>
                            <div>📊 {log.logs.length} events</div>
                            <div>🕒 {formatTimestamp(new Date(log.uploadedAt).getTime())}</div>
                            <div>🆔 {log.sessionId.substring(0, 8)}...</div>
                            {log.lastUpdatedAt && log.lastUpdatedAt !== log.uploadedAt && (
                              <div>🔄 Updated: {formatTimestamp(new Date(log.lastUpdatedAt).getTime())}</div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>

          {/* Log Details */}
          <div className="lg:col-span-2">
            <GlassCard>
              {selectedLog ? (
                <div className="p-6">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-4" style={{ color: '#2C1B12' }}>Session Details</h3>
                    
                    {/* Device Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(166, 82, 27, 0.05)' }}>
                        <h4 className="font-semibold mb-3" style={{ color: '#2C1B12' }}>Device Information</h4>
                        <div className="space-y-2 text-sm" style={{ color: '#A6521B' }}>
                          <div><strong>Type:</strong> {selectedLog.deviceInfo?.device?.type || 'Unknown'}</div>
                          <div><strong>Screen:</strong> {selectedLog.deviceInfo?.screen?.width} x {selectedLog.deviceInfo?.screen?.height}</div>
                          <div><strong>Window:</strong> {selectedLog.deviceInfo?.window?.width} x {selectedLog.deviceInfo?.window?.height}</div>
                          <div><strong>Pixel Ratio:</strong> {selectedLog.deviceInfo?.window?.devicePixelRatio}</div>
                          <div><strong>Touch Support:</strong> {selectedLog.deviceInfo?.device?.touchSupport ? 'Yes' : 'No'}</div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(166, 82, 27, 0.05)' }}>
                        <h4 className="font-semibold mb-3" style={{ color: '#2C1B12' }}>Network & Browser</h4>
                        <div className="space-y-2 text-sm" style={{ color: '#A6521B' }}>
                          <div><strong>Downlink:</strong> {selectedLog.deviceInfo?.network?.downlink || 'Unknown'} Mbps</div>
                          <div><strong>RTT:</strong> {selectedLog.deviceInfo?.network?.rtt || 'Unknown'} ms</div>
                          <div><strong>Language:</strong> {selectedLog.deviceInfo?.browser?.language || 'Unknown'}</div>
                          <div><strong>Platform:</strong> {selectedLog.deviceInfo?.browser?.platform || 'Unknown'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Session Metadata */}
                    <div className="p-4 rounded-xl mb-6" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}>
                      <h4 className="font-semibold mb-3" style={{ color: '#2C1B12' }}>Session Metadata</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm" style={{ color: '#A6521B' }}>
                        <div><strong>Session ID:</strong> {selectedLog.sessionId}</div>
                        <div><strong>Uploaded:</strong> {formatTimestamp(new Date(selectedLog.uploadedAt).getTime())}</div>
                        {selectedLog.lastUpdatedAt && selectedLog.lastUpdatedAt !== selectedLog.uploadedAt && (
                          <div><strong>Last Updated:</strong> {formatTimestamp(new Date(selectedLog.lastUpdatedAt).getTime())}</div>
                        )}
                        <div><strong>Total Events:</strong> {selectedLog.logs.length}</div>
                      </div>
                    </div>

                    {/* Event Filters */}
                    <GlassCard className="p-4 mb-6">
                      <h4 className="font-semibold mb-4" style={{ color: '#2C1B12' }}>Event Filters & Search</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: '#A6521B' }}>Search Events</label>
                          <input
                            type="text"
                            value={eventSearch}
                            onChange={(e) => setEventSearch(e.target.value)}
                            placeholder="Search by type or details..."
                            className="w-full px-3 py-2 rounded-xl border bg-white/60 shadow focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                            style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: '#A6521B' }}>Event Type</label>
                          <select
                            value={eventTypeFilter}
                            onChange={(e) => setEventTypeFilter(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border bg-white/60 shadow focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                            style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}
                          >
                            <option value="">All Types</option>
                            {getUniqueEventTypes().map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: '#A6521B' }}>Sort By</label>
                          <select
                            value={eventSortBy}
                            onChange={(e) => setEventSortBy(e.target.value as 'timestamp' | 'type')}
                            className="w-full px-3 py-2 rounded-xl border bg-white/60 shadow focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                            style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}
                          >
                            <option value="timestamp">Timestamp</option>
                            <option value="type">Event Type</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: '#A6521B' }}>Order</label>
                          <button
                            onClick={() => setEventSortOrder(eventSortOrder === 'asc' ? 'desc' : 'asc')}
                            className="w-full px-3 py-2 rounded-xl border transition-all hover:scale-105 text-sm"
                            style={{ 
                              borderColor: 'rgba(166, 82, 27, 0.2)', 
                              backgroundColor: 'rgba(166, 82, 27, 0.1)',
                              color: '#A6521B'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
                          >
                            {eventSortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 text-sm" style={{ color: '#A6521B', opacity: 0.7 }}>
                        Showing {filteredEvents.length} of {selectedLog.logs.length} events
                      </div>
                    </GlassCard>

                    {/* Events List */}
                    <div>
                      <h4 className="font-semibold mb-3" style={{ color: '#2C1B12' }}>Events ({filteredEvents.length} of {selectedLog.logs.length})</h4>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredEvents.length === 0 ? (
                          <div className="p-6 text-center" style={{ color: '#A6521B', opacity: 0.6 }}>
                            No events found matching filters
                          </div>
                        ) : (
                          filteredEvents.map((event, index) => (
                          <motion.div 
                            key={event.id || index} 
                            className="p-3 rounded-xl text-sm border"
                            style={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.6)',
                              borderColor: 'rgba(166, 82, 27, 0.2)'
                            }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium" style={{ color: '#2C1B12' }}>{event.type}</span>
                                <span style={{ color: '#A6521B', opacity: 0.5 }}>•</span>
                                <span style={{ color: '#A6521B', opacity: 0.8 }}>{formatTimestamp(event.timestamp)}</span>
                              </div>
                            </div>
                            <div style={{ color: '#A6521B' }}>
                              <pre className="whitespace-pre-wrap text-xs">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                            </div>
                          </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64" style={{ color: '#A6521B', opacity: 0.6 }}>
                  Select a log to view details
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}; 