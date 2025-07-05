import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, X, Activity } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface AnalyticsEvent {
  timestamp: number;
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export const AnalyticsDebug: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      // Override gtag to capture events
      const originalGtag = window.gtag;
      window.gtag = (...args: any[]) => {
        // Call original gtag
        originalGtag(...args);
        
        // Capture event data
        if (args[0] === 'event') {
          const [_, action, params] = args;
          setEvents(prev => [...prev, {
            timestamp: Date.now(),
            action,
            category: params.event_category || 'unknown',
            label: params.event_label,
            value: params.value
          }]);
        }
      };
    }
  }, []);

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <>
      {/* Debug Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-3 rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <BarChart3 size={20} />
      </motion.button>

      {/* Debug Modal */}
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <motion.div
            className="w-full max-w-2xl max-h-[80vh] overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Analytics Debug
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Events: {events.length}</span>
                  <button
                    onClick={() => setEvents([])}
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  >
                    Clear
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {events.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No events tracked yet</p>
                  ) : (
                    events.slice().reverse().map((event, index) => (
                      <div
                        key={index}
                        className="p-3 bg-white/20 rounded-lg border border-white/30"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-sm">{event.action}</div>
                            <div className="text-xs text-gray-600">
                              Category: {event.category}
                              {event.label && ` • Label: ${event.label}`}
                              {event.value && ` • Value: ${event.value}`}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}; 