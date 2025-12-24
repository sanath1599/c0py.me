import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EventEntry } from '../types';
import { formatTimestamp } from '../utils/formatTimestamp';
// Upload functionality removed - logs are now automatically uploaded on key events
import { GlassCard } from './GlassCard';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  X, 
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  BarChart3,
  Users,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle,
  Globe,
  Lock,
  Wifi,
  Play,
  ArrowRight
} from 'lucide-react';

interface EventTableProps {
  events: EventEntry[];
  onClear?: () => void;
}

interface FilterState {
  search: string;
  eventTypes: Set<string>;
  categories: Set<string>;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  showExpanded: boolean;
}

export const EventTable: React.FC<EventTableProps> = ({ events, onClear }) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    eventTypes: new Set(),
    categories: new Set(),
    dateRange: { start: null, end: null },
    showExpanded: false
  });
  
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'timestamp' | 'type' | 'category'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Extract available filter options from events
  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const categories = new Set<string>();
    
    events.forEach(event => {
      types.add(event.type);
      if (event.details.category) {
        categories.add(event.details.category);
      }
    });
    
    return {
      eventTypes: Array.from(types).sort(),
      categories: Array.from(categories).sort()
    };
  }, [events]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          event.type.toLowerCase().includes(searchLower) ||
          JSON.stringify(event.details).toLowerCase().includes(searchLower) ||
          (event.details.action && event.details.action.toLowerCase().includes(searchLower)) ||
          (event.details.event && event.details.event.toLowerCase().includes(searchLower));
        
        if (!matchesSearch) return false;
      }
      
      // Event type filter
      if (filters.eventTypes.size > 0 && !filters.eventTypes.has(event.type)) {
        return false;
      }
      
      // Category filter
      if (filters.categories.size > 0 && event.details.category && !filters.categories.has(event.details.category)) {
        return false;
      }
      
      // Date range filter
      if (filters.dateRange.start || filters.dateRange.end) {
        const eventDate = new Date(event.timestamp);
        if (filters.dateRange.start && eventDate < filters.dateRange.start) {
          return false;
        }
        if (filters.dateRange.end && eventDate > filters.dateRange.end) {
          return false;
        }
      }
      
      return true;
    });
  }, [events, filters]);

  // Sort events
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'timestamp') {
        comparison = a.timestamp - b.timestamp;
      } else if (sortBy === 'type') {
        comparison = a.type.localeCompare(b.type);
      } else if (sortBy === 'category') {
        const catA = a.details.category || '';
        const catB = b.details.category || '';
        comparison = catA.localeCompare(catB);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredEvents, sortBy, sortOrder]);

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const toggleSort = (field: 'timestamp' | 'type' | 'category') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleEventType = (type: string) => {
    setFilters(prev => {
      const newTypes = new Set(prev.eventTypes);
      if (newTypes.has(type)) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
      return { ...prev, eventTypes: newTypes };
    });
  };

  const toggleCategory = (category: string) => {
    setFilters(prev => {
      const newCategories = new Set(prev.categories);
      if (newCategories.has(category)) {
        newCategories.delete(category);
      } else {
        newCategories.add(category);
      }
      return { ...prev, categories: newCategories };
    });
  };

  const clearAllFilters = () => {
    setFilters({
      search: '',
      eventTypes: new Set(),
      categories: new Set(),
      dateRange: { start: null, end: null },
      showExpanded: false
    });
  };

  // Upload functionality removed - logs are now automatically uploaded on key events



  const getEventTypeColor = (type: string, details: any) => {
    if (type === 'user_action') {
      const category = details.category;
      const action = details.action;
      
      // Special colors for process events
      if (action && action.startsWith('process_')) {
        const processColors: Record<string, string> = {
          process_started: 'bg-blue-100 text-blue-800 border-blue-200',
          process_step: 'bg-cyan-100 text-cyan-800 border-cyan-200',
          process_completed: 'bg-green-100 text-green-800 border-green-200',
          process_failed: 'bg-red-100 text-red-800 border-red-200',
        };
        return processColors[action] || 'bg-gray-100 text-gray-800 border-gray-200';
      }
      
      const colors: Record<string, string> = {
        navigation: 'bg-blue-100 text-blue-800 border-blue-200',
        interaction: 'bg-green-100 text-green-800 border-green-200',
        file_operation: 'bg-orange-100 text-orange-800 border-orange-200',
        profile: 'bg-purple-100 text-purple-800 border-purple-200',
      };
      return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
    }
    
    if (type === 'system_event') {
      const category = details.category;
      const event = details.event;
      
      // Special colors for system process events
      if (event && event.startsWith('system_process_')) {
        const processColors: Record<string, string> = {
          system_process_started: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          system_process_step: 'bg-blue-100 text-blue-800 border-blue-200',
          system_process_completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          system_process_failed: 'bg-red-100 text-red-800 border-red-200',
        };
        return processColors[event] || 'bg-gray-100 text-gray-800 border-gray-200';
      }
      
      const colors: Record<string, string> = {
        connection: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        webrtc: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        transfer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        api: 'bg-violet-100 text-violet-800 border-violet-200',
        error: 'bg-red-100 text-red-800 border-red-200',
      };
      return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
    }
    
    const colors: Record<string, string> = {
      click: 'bg-blue-100 text-blue-800 border-blue-200',
      navigation: 'bg-green-100 text-green-800 border-green-200',
      form_submit: 'bg-purple-100 text-purple-800 border-purple-200',
      file_action: 'bg-orange-100 text-orange-800 border-orange-200',
      peer_action: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      error: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      navigation: <Globe className="w-3 h-3" />,
      interaction: <Users className="w-3 h-3" />,
      file_operation: <FileText className="w-3 h-3" />,
      profile: <Users className="w-3 h-3" />,
      connection: <Wifi className="w-3 h-3" />,
      webrtc: <Activity className="w-3 h-3" />,
      transfer: <Download className="w-3 h-3" />,
      api: <BarChart3 className="w-3 h-3" />,
      error: <AlertTriangle className="w-3 h-3" />,
    };
    return icons[category] || <Activity className="w-3 h-3" />;
  };

  const getProcessIcon = (action: string) => {
    const processIcons: Record<string, React.ReactNode> = {
      process_started: <Play className="w-3 h-3" />,
      process_step: <ArrowRight className="w-3 h-3" />,
      process_completed: <CheckCircle className="w-3 h-3" />,
      process_failed: <X className="w-3 h-3" />,
      system_process_started: <Play className="w-3 h-3" />,
      system_process_step: <ArrowRight className="w-3 h-3" />,
      system_process_completed: <CheckCircle className="w-3 h-3" />,
      system_process_failed: <X className="w-3 h-3" />,
    };
    return processIcons[action] || <Activity className="w-3 h-3" />;
  };

  const getCategoryPillColor = (category: string) => {
    const colors: Record<string, string> = {
      navigation: 'bg-blue-100 text-blue-800 border-blue-200',
      interaction: 'bg-green-100 text-green-800 border-green-200',
      file_operation: 'bg-orange-100 text-orange-800 border-orange-200',
      profile: 'bg-purple-100 text-purple-800 border-purple-200',
      connection: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      webrtc: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      transfer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      api: 'bg-violet-100 text-violet-800 border-violet-200',
      error: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.eventTypes.size > 0) count++;
    if (filters.categories.size > 0) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    return count;
  };

  if (events.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center">
            <Calendar className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700">No Events Yet</h3>
          <p className="text-gray-500 max-w-md">
            Your event log is empty. Events will appear here as you interact with the app.
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Filter and Controls */}
      <GlassCard className="p-4">
        <div className="space-y-4">
          {/* Main Controls Row */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search events, actions, or details..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  showFilters 
                    ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filters</span>
                {getActiveFilterCount() > 0 && (
                  <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                    {getActiveFilterCount()}
                  </span>
                )}
              </button>
              
              {/* Stats */}
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center space-x-1">
                  <BarChart3 className="w-4 h-4" />
                  <span>{filteredEvents.length} of {events.length}</span>
                </span>
              </div>
              
              {/* Upload Actions removed - logs are now automatically uploaded on key events */}
              
              {/* Clear Actions */}
              <div className="flex items-center space-x-2">
                {getActiveFilterCount() > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear Filters</span>
                  </button>
                )}
                {onClear && (
                  <button
                    onClick={onClear}
                    className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center space-x-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-gray-200 pt-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Event Types Filter */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center space-x-2">
                      <Filter className="w-4 h-4" />
                      <span>Event Types</span>
                    </h4>
                    <div className="space-y-2">
                      {filterOptions.eventTypes.map(type => (
                        <label key={type} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.eventTypes.has(type)}
                            onChange={() => toggleEventType(type)}
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-600 capitalize">
                            {type.replace('_', ' ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Categories Filter */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4" />
                      <span>Categories</span>
                    </h4>
                    <div className="space-y-2">
                      {filterOptions.categories.map(category => (
                        <label key={category} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.categories.has(category)}
                            onChange={() => toggleCategory(category)}
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-600 capitalize">
                            {category.replace('_', ' ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Date Range Filter */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Date Range</span>
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">From</label>
                        <input
                          type="datetime-local"
                          value={filters.dateRange.start?.toISOString().slice(0, 16) || ''}
                          onChange={(e) => updateFilter('dateRange', {
                            ...filters.dateRange,
                            start: e.target.value ? new Date(e.target.value) : null
                          })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">To</label>
                        <input
                          type="datetime-local"
                          value={filters.dateRange.end?.toISOString().slice(0, 16) || ''}
                          onChange={(e) => updateFilter('dateRange', {
                            ...filters.dateRange,
                            end: e.target.value ? new Date(e.target.value) : null
                          })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>

      {/* Enhanced Events Table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('timestamp')}
                    className="flex items-center space-x-2 hover:text-gray-600 transition-colors font-medium"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Time</span>
                    {sortBy === 'timestamp' && (
                      <span className="text-xs">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('type')}
                    className="flex items-center space-x-2 hover:text-gray-600 transition-colors font-medium"
                  >
                    <Filter className="w-4 h-4" />
                    <span>Type</span>
                    {sortBy === 'type' && (
                      <span className="text-xs">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('category')}
                    className="flex items-center space-x-2 hover:text-gray-600 transition-colors font-medium"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Category</span>
                    {sortBy === 'category' && (
                      <span className="text-xs">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">Details</th>
                <th className="px-4 py-3 text-left">Session</th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((event) => (
                <React.Fragment key={event.id}>
                  <motion.tr
                    className="border-b border-gray-100 hover:bg-white/50 transition-colors"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatTimestamp(event.timestamp)}
                    </td>
                                      <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getEventTypeColor(event.type, event.details)}`}>
                      {event.type === 'user_action' ? event.details.action : 
                       event.type === 'system_event' ? event.details.event : 
                       event.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {event.details.category && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getCategoryPillColor(event.details.category)}`}>
                        {event.details.category.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                    
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleEventExpansion(event.id)}
                        className="flex items-center space-x-2 text-left hover:text-gray-600 transition-colors"
                      >
                        {expandedEvents.has(event.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span className="text-sm text-gray-700">
                          {expandedEvents.has(event.id) ? 'Hide' : 'View'} Details
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {event.sessionId.slice(0, 8)}...
                    </td>
                  </motion.tr>
                  
                  {/* Expanded Details Row */}
                  {expandedEvents.has(event.id) && (
                    <motion.tr
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-b border-gray-100"
                    >
                      <td colSpan={6} className="p-0">
                        <div className="p-6 bg-gradient-to-r from-gray-50/50 to-orange-50/30">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center space-x-2">
                                  <FileText className="w-4 h-4" />
                                  <span>Event Details</span>
                                </h4>
                                <pre className="text-xs bg-white/70 p-4 rounded-lg overflow-x-auto border border-gray-200 shadow-sm">
                                  {JSON.stringify(event.details, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center space-x-2">
                                  <Settings className="w-4 h-4" />
                                  <span>Event Metadata</span>
                                </h4>
                                <div className="space-y-2 text-xs bg-white/70 p-4 rounded-lg border border-gray-200 shadow-sm">
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-600">ID:</span>
                                    <span className="font-mono text-gray-800">{event.id}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-600">Session:</span>
                                    <span className="font-mono text-gray-800">{event.sessionId}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-600">Timestamp:</span>
                                    <span className="font-mono text-gray-800">{formatTimestamp(event.timestamp)}</span>
                                  </div>
                                  {event.userId && (
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-600">User:</span>
                                      <span className="font-mono text-gray-800">{event.userId}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-600">Type:</span>
                                    <span className="font-mono text-gray-800">{event.type}</span>
                                  </div>
                                  {event.details.category && (
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-600">Category:</span>
                                      <span className="font-mono text-gray-800">{event.details.category}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
      
      {/* Uploaded Logs Viewer removed - logs are automatically uploaded */}
    </div>
  );
}; 