import React, { useState, useEffect } from 'react';
import { getUploadedLogs, deleteUploadedLogs } from '../utils/eventLogger';
import { formatTimestamp } from '../utils/formatTimestamp';

interface UploadedLog {
  id: string;
  sessionId: string;
  deviceInfo: any;
  logs: any[];
  metadata: any;
  uploadedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

interface UploadedLogsViewerProps {
  onClose: () => void;
}

export const UploadedLogsViewer: React.FC<UploadedLogsViewerProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<UploadedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<UploadedLog | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadUploadedLogs();
  }, []);

  const loadUploadedLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getUploadedLogs();
      
      if (result.success && result.logs) {
        setLogs(result.logs);
      } else {
        setError(result.error || 'Failed to load logs');
      }
    } catch (err) {
      setError('Failed to load uploaded logs');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading uploaded logs...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Uploaded Logs</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadUploadedLogs}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg mx-6 mt-4">
            {error}
          </div>
        )}

        <div className="flex h-[calc(90vh-120px)]">
          {/* Logs List */}
          <div className="w-1/3 border-r overflow-y-auto">
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-4">Uploaded Sessions</h3>
              {logs.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No uploaded logs found
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedLog?.id === log.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getDeviceTypeIcon(log.deviceInfo?.device?.type || 'desktop')}
                          <span className="font-medium text-sm">
                            {log.deviceInfo?.device?.type || 'Unknown'} Device
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLog(log.id);
                          }}
                          disabled={deleting === log.id}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          {deleting === log.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                      
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>📊 {log.logs.length} events</div>
                        <div>🕒 {formatTimestamp(new Date(log.uploadedAt).getTime())}</div>
                        {log.ipAddress && <div>🌍 {log.ipAddress}</div>}
                        <div className="truncate">
                          {getBrowserIcon(log.userAgent || '')} {log.userAgent?.substring(0, 50)}...
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Log Details */}
          <div className="flex-1 overflow-y-auto">
            {selectedLog ? (
              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-4">Session Details</h3>
                  
                  {/* Device Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Device Information</h4>
                      <div className="space-y-2 text-sm">
                        <div><strong>Type:</strong> {selectedLog.deviceInfo?.device?.type || 'Unknown'}</div>
                        <div><strong>Screen:</strong> {selectedLog.deviceInfo?.screen?.width} x {selectedLog.deviceInfo?.screen?.height}</div>
                        <div><strong>Window:</strong> {selectedLog.deviceInfo?.window?.width} x {selectedLog.deviceInfo?.window?.height}</div>
                        <div><strong>Pixel Ratio:</strong> {selectedLog.deviceInfo?.window?.devicePixelRatio}</div>
                        <div><strong>Touch Support:</strong> {selectedLog.deviceInfo?.device?.touchSupport ? 'Yes' : 'No'}</div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Network & Browser</h4>
                      <div className="space-y-2 text-sm">
                        <div><strong>Connection:</strong> {selectedLog.deviceInfo?.network?.connectionType || 'Unknown'}</div>
                        <div><strong>Downlink:</strong> {selectedLog.deviceInfo?.network?.downlink || 'Unknown'} Mbps</div>
                        <div><strong>RTT:</strong> {selectedLog.deviceInfo?.network?.rtt || 'Unknown'} ms</div>
                        <div><strong>Language:</strong> {selectedLog.deviceInfo?.browser?.language || 'Unknown'}</div>
                        <div><strong>Platform:</strong> {selectedLog.deviceInfo?.browser?.platform || 'Unknown'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Session Metadata */}
                  <div className="bg-blue-50 p-4 rounded-lg mb-6">
                    <h4 className="font-semibold mb-3">Session Metadata</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><strong>Session ID:</strong> {selectedLog.sessionId}</div>
                      <div><strong>Uploaded:</strong> {formatTimestamp(new Date(selectedLog.uploadedAt).getTime())}</div>
                      <div><strong>IP Address:</strong> {selectedLog.ipAddress || 'Unknown'}</div>
                      <div><strong>Total Events:</strong> {selectedLog.logs.length}</div>
                    </div>
                  </div>

                  {/* Events List */}
                  <div>
                    <h4 className="font-semibold mb-3">Events ({selectedLog.logs.length})</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {selectedLog.logs.map((event, index) => (
                        <div key={event.id || index} className="bg-gray-50 p-3 rounded-lg text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{event.type}</span>
                              <span className="text-gray-500">•</span>
                              <span className="text-gray-600">{formatTimestamp(event.timestamp)}</span>
                            </div>
                          </div>
                          <div className="text-gray-700">
                            <pre className="whitespace-pre-wrap text-xs">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a log to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 