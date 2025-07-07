import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { EventEntry } from '../types';
import { GlassCard } from './GlassCard';
import { ChevronDown, ChevronRight, Search, Filter, Calendar, Clock } from 'lucide-react';

interface EventTableProps {
  events: EventEntry[];
  onClear?: () => void;
}

export const EventTable: React.FC<EventTableProps> = ({ events, onClear }) => {
  const [filter, setFilter] = useState('');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'timestamp' | 'type'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter events
  const filteredEvents = events.filter(event =>
    event.type.toLowerCase().includes(filter.toLowerCase()) ||
    JSON.stringify(event.details).toLowerCase().includes(filter.toLowerCase())
  );

  // Sort events
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'timestamp') {
      comparison = a.timestamp - b.timestamp;
    } else if (sortBy === 'type') {
      comparison = a.type.localeCompare(b.type);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

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

  const toggleSort = (field: 'timestamp' | 'type') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      click: 'bg-blue-100 text-blue-800',
      navigation: 'bg-green-100 text-green-800',
      form_submit: 'bg-purple-100 text-purple-800',
      file_action: 'bg-orange-100 text-orange-800',
      peer_action: 'bg-indigo-100 text-indigo-800',
      error: 'bg-red-100 text-red-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (events.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <Calendar className="w-8 h-8 text-gray-400" />
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
      {/* Filter and Controls */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter events..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {filteredEvents.length} of {events.length} events
            </span>
            {onClear && (
              <button
                onClick={onClear}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Events Table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('timestamp')}
                    className="flex items-center space-x-1 hover:text-gray-600 transition-colors"
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
                    className="flex items-center space-x-1 hover:text-gray-600 transition-colors"
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
                <th className="px-4 py-3 text-left">Details</th>
                <th className="px-4 py-3 text-left">Session</th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((event) => (
                <motion.tr
                  key={event.id}
                  className="border-b border-gray-100 hover:bg-white/50 transition-colors"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatTimestamp(event.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.type)}`}>
                      {event.type}
                    </span>
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
              ))}
            </tbody>
          </table>
        </div>

        {/* Expanded Details */}
        {sortedEvents.map((event) => (
          <motion.div
            key={`details-${event.id}`}
            initial={false}
            animate={{
              height: expandedEvents.has(event.id) ? 'auto' : 0,
              opacity: expandedEvents.has(event.id) ? 1 : 0,
            }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {expandedEvents.has(event.id) && (
              <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Event Details</h4>
                      <pre className="text-xs bg-white/50 p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Event Metadata</h4>
                      <div className="space-y-1 text-xs">
                        <div><span className="font-medium">ID:</span> {event.id}</div>
                        <div><span className="font-medium">Session:</span> {event.sessionId}</div>
                        <div><span className="font-medium">Timestamp:</span> {event.timestamp}</div>
                        {event.userId && (
                          <div><span className="font-medium">User:</span> {event.userId}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </GlassCard>
    </div>
  );
}; 