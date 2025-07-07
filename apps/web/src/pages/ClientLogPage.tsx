import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Upload, Trash2, RefreshCw, FileText } from 'lucide-react';
import { EventTable } from '../components/EventTable';
import { GlassCard } from '../components/GlassCard';
import { flushEvents, clearEvents } from '../utils/eventLogger';
import { EventEntry } from '../types';

interface ClientLogPageProps {
  onBack: () => void;
}

export const ClientLogPage: React.FC<ClientLogPageProps> = ({ onBack }) => {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedEvents, setUploadedEvents] = useState<EventEntry[]>([]);
  const [showUploaded, setShowUploaded] = useState(false);

  const loadEvents = () => {
    try {
      const storedEvents = flushEvents();
      setEvents(storedEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const handleClearEvents = () => {
    if (window.confirm('Are you sure you want to clear all events? This action cannot be undone.')) {
      try {
        clearEvents();
        setEvents([]);
      } catch (error) {
        console.error('Failed to clear events:', error);
      }
    }
  };

  const handleExportEvents = () => {
    try {
      const dataStr = JSON.stringify(events, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `event-log-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export events:', error);
    }
  };

  const handleImportEvents = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedEvents = JSON.parse(content) as EventEntry[];
        
        // Validate the imported data
        if (Array.isArray(importedEvents) && importedEvents.every(event => 
          event.id && event.type && event.details && event.timestamp && event.sessionId
        )) {
          setUploadedEvents(importedEvents);
          setShowUploaded(true);
        } else {
          alert('Invalid event log file format.');
        }
      } catch (error) {
        console.error('Failed to parse imported file:', error);
        alert('Failed to parse the uploaded file. Please ensure it\'s a valid JSON event log.');
      }
    };
    reader.readAsText(file);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      loadEvents();
      setIsLoading(false);
    }, 500);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const currentEvents = showUploaded ? uploadedEvents : events;
  const eventCount = currentEvents.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-4"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Client Event Log</h1>
                <p className="text-gray-600">
                  {showUploaded ? 'Viewing uploaded events' : 'View and manage your local event log'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {eventCount} event{eventCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Controls */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleExportEvents}
                disabled={eventCount === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>

              <label className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>Import</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportEvents}
                  className="hidden"
                />
              </label>

              {showUploaded && (
                <button
                  onClick={() => setShowUploaded(false)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Back to Local</span>
                </button>
              )}
            </div>

            <div className="flex gap-3">
              {!showUploaded && (
                <button
                  onClick={handleClearEvents}
                  disabled={eventCount === 0}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Event Table */}
        <EventTable 
          events={currentEvents} 
          onClear={!showUploaded ? handleClearEvents : undefined}
        />

        {/* Info Panel */}
        <GlassCard className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">About Event Logging</h3>
              <p className="text-gray-600">
                Events are captured automatically as you interact with the app. 
                They're stored locally in your browser and never sent to our servers.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Event Types</h3>
              <div className="space-y-1 text-gray-600">
                <div>• <span className="bg-blue-100 text-blue-800 px-1 rounded text-xs">user_action</span> - User interactions and decisions</div>
                <div>• <span className="bg-indigo-100 text-indigo-800 px-1 rounded text-xs">system_event</span> - System operations and API calls</div>
                <div>• <span className="bg-cyan-100 text-cyan-800 px-1 rounded text-xs">webrtc</span> - WebRTC connection events</div>
                <div>• <span className="bg-emerald-100 text-emerald-800 px-1 rounded text-xs">transfer</span> - File transfer progress</div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Privacy</h3>
              <p className="text-gray-600">
                All events are stored locally in your browser's localStorage. 
                You can export them for backup or analysis, or clear them at any time.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}; 