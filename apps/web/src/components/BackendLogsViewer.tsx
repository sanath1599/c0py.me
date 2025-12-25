import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from './GlassCard';

interface LogFileInfo {
  filename: string;
  level: string;
  date: string;
  size: number;
  lastModified: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  [key: string]: any;
}

interface LogStreamResponse {
  success: boolean;
  filename: string;
  entries: LogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  filters: {
    level: string;
    search: string | null;
  };
  timestamp: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';

const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'exceptions', 'rejections'];

// Updated color scheme to match app theme
const LEVEL_COLORS: Record<string, string> = {
  error: '#DC2626',      // Red
  warn: '#D97706',        // Orange/amber
  info: '#2563EB',        // Blue
  debug: '#059669',       // Green
  exceptions: '#7C3AED',  // Purple
  rejections: '#DB2777',  // Pink
};

const LEVEL_BG_COLORS: Record<string, string> = {
  error: 'rgba(220, 38, 38, 0.1)',
  warn: 'rgba(217, 119, 6, 0.1)',
  info: 'rgba(37, 99, 235, 0.1)',
  debug: 'rgba(5, 150, 105, 0.1)',
  exceptions: 'rgba(124, 58, 237, 0.1)',
  rejections: 'rgba(219, 39, 119, 0.1)',
};

const LEVEL_BORDER_COLORS: Record<string, string> = {
  error: 'rgba(220, 38, 38, 0.3)',
  warn: 'rgba(217, 119, 6, 0.3)',
  info: 'rgba(37, 99, 235, 0.3)',
  debug: 'rgba(5, 150, 105, 0.3)',
  exceptions: 'rgba(124, 58, 237, 0.3)',
  rejections: 'rgba(219, 39, 119, 0.3)',
};

export const BackendLogsViewer: React.FC = () => {
  const navigate = useNavigate();
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('warn');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<LogStreamResponse['pagination'] | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [fileStats, setFileStats] = useState<{ totalLines: number; levelCounts: Record<string, number> } | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Computed: Get the selected filename based on level and week
  const selectedFile = selectedLevel && selectedWeek ? `${selectedLevel}-${selectedWeek}.log` : '';

  // Check authentication
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';
    if (!isAuthenticated) {
      navigate('/admin/login');
      return;
    }
  }, [navigate]);

  const isAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  // Fetch available log files and extract weeks
  const fetchLogFiles = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/backend-logs/files`);
      const data = await response.json();
      
      if (data.success) {
        setLogFiles(data.files);
        
        // Extract unique weeks from all log files
        const weeks = new Set<string>();
        data.files.forEach((file: LogFileInfo) => {
          // Extract week from date (format: YYYY-Www)
          if (file.date && file.date.match(/^\d{4}-W\d{2}$/)) {
            weeks.add(file.date);
          }
        });
        
        const sortedWeeks = Array.from(weeks).sort((a, b) => {
          // Sort by year and week (newest first)
          const [yearA, weekA] = a.split('-W').map(Number);
          const [yearB, weekB] = b.split('-W').map(Number);
          if (yearA !== yearB) return yearB - yearA;
          return weekB - weekA;
        });
        
        setAvailableWeeks(sortedWeeks);
        
        // Auto-select the most recent week if none selected
        if (!selectedWeek && sortedWeeks.length > 0) {
          setSelectedWeek(sortedWeeks[0]);
        }
      } else {
        setError('Failed to fetch log files');
      }
    } catch (err) {
      setError('Failed to fetch log files');
      console.error('Error fetching log files:', err);
    }
  };

  // Fetch file statistics
  const fetchFileStats = async (filename: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/backend-logs/stats/${filename}`);
      const data = await response.json();
      if (data.success) {
        setFileStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching file stats:', err);
    }
  };

  // Fetch logs from selected file
  const fetchLogs = async (resetOffset = false) => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        filename: selectedFile,
        limit: '1000',
        offset: resetOffset ? '0' : (pagination?.offset.toString() || '0'),
      });

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`${API_BASE_URL}/api/backend-logs/stream?${params}`);
      const data: LogStreamResponse = await response.json();

      if (data.success) {
        setLogEntries(data.entries);
        setPagination(data.pagination);
        
        // Auto-scroll to top when new logs are loaded
        if (resetOffset && logsContainerRef.current) {
          logsContainerRef.current.scrollTop = 0;
        }
      } else {
        setError('Failed to fetch logs');
      }
    } catch (err) {
      setError('Failed to fetch logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load log files on mount
  useEffect(() => {
    fetchLogFiles();
  }, []);

  // Fetch logs and stats when level or week changes (which determines the file)
  useEffect(() => {
    if (selectedLevel && selectedWeek) {
      const filename = `${selectedLevel}-${selectedWeek}.log`;
      fetchLogs(true);
      fetchFileStats(filename);
    }
  }, [selectedLevel, selectedWeek]);

  // Fetch logs when search changes
  useEffect(() => {
    if (selectedFile) {
      fetchLogs(true);
    }
  }, [searchQuery]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && selectedFile) {
      autoRefreshRef.current = setInterval(() => {
        fetchLogs(false);
      }, refreshInterval);

      return () => {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current);
        }
      };
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    }
  }, [autoRefresh, selectedFile, refreshInterval]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  // Highlight search query in text
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark 
          key={index} 
          style={{ 
            backgroundColor: 'rgba(246, 193, 72, 0.4)', 
            color: '#2C1B12',
            padding: '2px 4px',
            borderRadius: '3px'
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#2C1B12' }}>
              Backend Logs Viewer
            </h1>
            <p style={{ color: '#A6521B', opacity: 0.8 }}>
              View and filter server-side logs in real-time
            </p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
            style={{ 
              backgroundColor: 'rgba(166, 82, 27, 0.1)',
              color: '#A6521B',
              border: '1px solid rgba(166, 82, 27, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
            }}
          >
            ← Back to Dashboard
          </button>
        </motion.div>

        {/* Controls */}
        <GlassCard className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Log Level Selection */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C1B12' }}>
                Log Level
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderColor: 'rgba(166, 82, 27, 0.2)',
                  color: '#2C1B12',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(166, 82, 27, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(166, 82, 27, 0.2)'}
              >
                {LOG_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Week Selection */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C1B12' }}>
                Week
              </label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderColor: 'rgba(166, 82, 27, 0.2)',
                  color: '#2C1B12',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(166, 82, 27, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(166, 82, 27, 0.2)'}
              >
                <option value="">Select a week...</option>
                {availableWeeks.map((week) => {
                  // Find file info for this week and level to show size
                  const fileInfo = logFiles.find(
                    f => f.level === selectedLevel && f.date === week
                  );
                  const fileSize = fileInfo ? formatFileSize(fileInfo.size) : '';
                  // Format week display: "2025-W52" -> "Week 52, 2025"
                  const [year, weekNum] = week.split('-W');
                  const weekLabel = `Week ${weekNum}, ${year}`;
                  return (
                    <option key={week} value={week}>
                      {weekLabel} {fileSize && `(${fileSize})`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C1B12' }}>
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderColor: 'rgba(166, 82, 27, 0.2)',
                  color: '#2C1B12',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(166, 82, 27, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(166, 82, 27, 0.2)'}
              />
            </div>

            {/* Auto-refresh */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C1B12' }}>
                Auto-refresh
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-5 h-5 rounded cursor-pointer"
                  style={{
                    accentColor: '#A6521B',
                  }}
                />
                <span className="text-sm" style={{ color: '#A6521B' }}>Enabled</span>
                {autoRefresh && (
                  <input
                    type="number"
                    value={refreshInterval / 1000}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value) * 1000)}
                    min="1"
                    max="60"
                    className="w-16 px-2 py-1 rounded border text-sm focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      borderColor: 'rgba(166, 82, 27, 0.2)',
                      color: '#2C1B12',
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => fetchLogs(true)}
              disabled={loading || !selectedFile}
              className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#A6521B',
                color: '#FFFFFF',
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#8B4513';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#A6521B';
                }
              }}
            >
              {loading ? 'Loading...' : '🔄 Refresh'}
            </button>
            <button
              onClick={() => fetchLogFiles()}
              className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
              style={{
                backgroundColor: 'rgba(166, 82, 27, 0.1)',
                color: '#A6521B',
                border: '1px solid rgba(166, 82, 27, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
              }}
            >
              📁 Reload Files
            </button>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: 'rgba(166, 82, 27, 0.1)',
                  color: '#A6521B',
                  border: '1px solid rgba(166, 82, 27, 0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                }}
              >
                ✕ Clear Search
              </button>
            )}
          </div>
        </GlassCard>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl border"
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              borderColor: 'rgba(220, 38, 38, 0.3)',
              color: '#DC2626',
            }}
          >
            {error}
          </motion.div>
        )}

        {/* File Stats */}
        {selectedFile && fileStats && (
          <GlassCard className="p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="text-sm" style={{ color: '#2C1B12' }}>
                <span className="font-semibold">Total Lines:</span> {fileStats.totalLines.toLocaleString()}
              </div>
              {Object.entries(fileStats.levelCounts).map(([level, count]) => (
                <div key={level} className="text-sm flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: LEVEL_COLORS[level] || '#666' }}
                  />
                  <span style={{ color: '#2C1B12' }}>
                    <span className="font-semibold capitalize">{level}:</span> {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Logs Display */}
        {selectedFile && (
          <GlassCard className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-1" style={{ color: '#2C1B12' }}>
                  {selectedFile || `${selectedLevel}-${selectedWeek}.log`}
                </h2>
                {pagination && (
                  <p className="text-sm" style={{ color: '#A6521B', opacity: 0.8 }}>
                    {pagination.total.toLocaleString()} {pagination.total === 1 ? 'entry' : 'entries'}
                    {searchQuery && ` • Searching: "${searchQuery}"`}
                  </p>
                )}
              </div>
              {autoRefresh && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)' }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#059669' }} />
                  <span className="text-sm font-medium" style={{ color: '#059669' }}>
                    Auto-refreshing every {refreshInterval / 1000}s
                  </span>
                </div>
              )}
            </div>

            <div
              ref={logsContainerRef}
              className="space-y-3 max-h-[600px] overflow-y-auto pr-2"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(166, 82, 27, 0.3) transparent'
              }}
            >
              <AnimatePresence>
                {logEntries.map((entry, index) => {
                  const level = entry.level?.toLowerCase() || 'unknown';
                  const levelColor = LEVEL_COLORS[level] || '#666';
                  const levelBg = LEVEL_BG_COLORS[level] || 'rgba(0, 0, 0, 0.05)';
                  const levelBorder = LEVEL_BORDER_COLORS[level] || 'rgba(0, 0, 0, 0.1)';

                  return (
                    <motion.div
                      key={`${entry.timestamp}-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-4 rounded-lg border backdrop-blur-sm transition-all hover:shadow-md"
                      style={{
                        backgroundColor: levelBg,
                        borderColor: levelBorder,
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="px-2 py-1 rounded text-xs font-semibold uppercase"
                            style={{
                              backgroundColor: levelColor,
                              color: '#FFFFFF',
                            }}
                          >
                            {level}
                          </span>
                          {entry.service && (
                            <span
                              className="px-2 py-1 rounded text-xs"
                              style={{
                                backgroundColor: 'rgba(166, 82, 27, 0.1)',
                                color: '#A6521B',
                              }}
                            >
                              {entry.service}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono" style={{ color: '#A6521B', opacity: 0.8 }}>
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      <div
                        className="font-mono text-sm break-words leading-relaxed"
                        style={{ color: '#2C1B12' }}
                      >
                        {highlightText(entry.message || JSON.stringify(entry), searchQuery)}
                      </div>
                      {Object.keys(entry).filter(key => !['timestamp', 'level', 'message', 'service'].includes(key)).length > 0 && (
                        <details className="mt-3">
                          <summary
                            className="text-xs cursor-pointer font-medium hover:opacity-80 transition-opacity"
                            style={{ color: '#A6521B' }}
                          >
                            Show metadata ({Object.keys(entry).filter(key => !['timestamp', 'level', 'message', 'service'].includes(key)).length} fields)
                          </summary>
                          <pre
                            className="mt-2 p-3 rounded text-xs overflow-x-auto border"
                            style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.05)',
                              borderColor: 'rgba(166, 82, 27, 0.2)',
                              color: '#2C1B12',
                            }}
                          >
                            {JSON.stringify(
                              Object.fromEntries(
                                Object.entries(entry).filter(
                                  ([key]) => !['timestamp', 'level', 'message', 'service'].includes(key)
                                )
                              ),
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {logEntries.length === 0 && !loading && (
                <div className="text-center py-12">
                  <p className="text-lg mb-2" style={{ color: '#A6521B' }}>
                    No logs found
                  </p>
                  <p style={{ color: '#A6521B', opacity: 0.7 }}>
                    {searchQuery || selectedLevel !== 'all'
                      ? 'Try adjusting your filters'
                      : 'This log file appears to be empty'}
                  </p>
                </div>
              )}

              {loading && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-3">
                    <div
                      className="animate-spin rounded-full h-6 w-6 border-b-2"
                      style={{ borderColor: '#A6521B' }}
                    />
                    <span style={{ color: '#A6521B' }}>Loading logs...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Pagination */}
            {pagination && pagination.total > 0 && (
              <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row justify-between items-center gap-4" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
                <div className="text-sm" style={{ color: '#A6521B', opacity: 0.8 }}>
                  Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total).toLocaleString()} of {pagination.total.toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (pagination.offset > 0) {
                        setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) });
                        fetchLogs(false);
                      }
                    }}
                    disabled={pagination.offset === 0}
                    className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: pagination.offset === 0 ? 'rgba(166, 82, 27, 0.1)' : 'rgba(166, 82, 27, 0.1)',
                      color: '#A6521B',
                      border: '1px solid rgba(166, 82, 27, 0.2)',
                    }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                      }
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => {
                      if (pagination.hasMore) {
                        setPagination({ ...pagination, offset: pagination.offset + pagination.limit });
                        fetchLogs(false);
                      }
                    }}
                    disabled={!pagination.hasMore}
                    className="px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: 'rgba(166, 82, 27, 0.1)',
                      color: '#A6521B',
                      border: '1px solid rgba(166, 82, 27, 0.2)',
                    }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                      }
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        )}

        {!selectedFile && (
          <GlassCard className="p-12 text-center">
            <p className="text-lg" style={{ color: '#A6521B', opacity: 0.7 }}>
              Select a log file to view logs
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
};
