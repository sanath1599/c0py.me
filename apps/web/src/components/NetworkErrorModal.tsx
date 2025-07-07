import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  WifiOff, 
  Server, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  X,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Zap,
  Globe,
  Shield
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { NetworkError, NetworkStatus } from '../hooks/useNetworkDetection';
import networkErrorImg from '/network_error.png';

import { RetryState } from '../hooks/useConnectionRetry';

interface NetworkErrorModalProps {
  isOpen: boolean;
  networkStatus: NetworkStatus;
  onRetry: () => void;
  onClose?: () => void;
  restored?: boolean;
  restoredSpeed?: number | null;
  restoredRtt?: number | null;
  onClearRestored?: () => void;
  retryState?: RetryState;
}

export const NetworkErrorModal: React.FC<NetworkErrorModalProps> = ({
  isOpen,
  networkStatus,
  onRetry,
  onClose,
  restored = false,
  restoredSpeed = null,
  restoredRtt = null,
  onClearRestored,
  retryState,
}) => {
  const { lastError, retryCount, isRetrying, retryCountdown, connectionType, effectiveType, downlink, rtt } = networkStatus;
  
  // Use retry state if available, otherwise fall back to network status
  const currentRetryCount = retryState?.retryCount ?? retryCount;
  const currentIsRetrying = retryState?.isRetrying ?? isRetrying;
  const currentTimeUntilNextRetry = retryState?.timeUntilNextRetry ?? 0;
  const currentLastError = retryState?.lastError ?? lastError;

  // Get error icon and color
  const getErrorIcon = (errorType: NetworkError['type']) => {
    switch (errorType) {
      case 'offline':
        return <WifiOff size={48} className="text-red-500" />;
      case 'server_unreachable':
        return <Server size={48} className="text-orange-500" />;
      case 'timeout':
        return <Clock size={48} className="text-yellow-500" />;
      case 'connection_lost':
        return <AlertTriangle size={48} className="text-red-500" />;
      case 'slow_connection':
        return <SignalLow size={48} className="text-yellow-500" />;
      default:
        return <AlertTriangle size={48} className="text-gray-500" />;
    }
  };

  // Get connection type icon
  const getConnectionIcon = (type: string) => {
    switch (type) {
      case 'wifi':
        return <Wifi size={20} className="text-green-500" />;
      case 'cellular':
        return <Signal size={20} className="text-blue-500" />;
      case 'ethernet':
        return <Globe size={20} className="text-purple-500" />;
      default:
        return <Signal size={20} className="text-gray-500" />;
    }
  };

  // Get signal strength icon
  const getSignalIcon = (type: string) => {
    switch (type) {
      case '4g':
        return <SignalHigh size={16} className="text-green-500" />;
      case '3g':
        return <SignalMedium size={16} className="text-yellow-500" />;
      case '2g':
      case 'slow-2g':
        return <SignalLow size={16} className="text-red-500" />;
      default:
        return <Signal size={16} className="text-gray-500" />;
    }
  };

  // Format network speed
  const formatSpeed = (speed: number) => {
    if (speed >= 1000) {
      return `${(speed / 1000).toFixed(1)} Gbps`;
    }
    return `${speed.toFixed(1)} Mbps`;
  };

  // Format latency
  const formatLatency = (latency: number) => {
    if (latency < 100) return `${latency}ms (Excellent)`;
    if (latency < 200) return `${latency}ms (Good)`;
    if (latency < 500) return `${latency}ms (Fair)`;
    return `${latency}ms (Poor)`;
  };

  // If restored, show restored UI regardless of other conditions
  if (restored) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <motion.div
            className="w-full max-w-lg z-10"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <GlassCard className="p-8 relative overflow-hidden">
              <button
                onClick={onClearRestored}
                className="absolute top-4 right-4 p-2 rounded-full transition-colors"
                style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22C55E' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.1)'; }}
              >
                <X size={16} />
              </button>
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/40 bg-white/30 backdrop-blur-[12px] relative overflow-hidden">
                  <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'linear-gradient(120deg,rgba(34,197,94,0.25) 0%,rgba(34,197,94,0.05) 100%)', zIndex: 1 }} />
                  <div className="z-10">
                    <Wifi size={48} className="text-green-500" />
                  </div>
                </div>
              </div>
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold mb-2 text-green-700">Connection Restored</h2>
                <p className="text-sm text-green-700 opacity-80">You are back online! Here are your current network stats:</p>
              </div>
              <div className="mb-6 p-4 rounded-lg border border-green-100/60 bg-white/40 backdrop-blur-[6px]">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-700">
                  <Shield size={16} />
                  Network Status
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    {getConnectionIcon(networkStatus.connectionType)}
                    <span className="text-green-700">{networkStatus.connectionType.charAt(0).toUpperCase() + networkStatus.connectionType.slice(1)}</span>
                  </div>
                  {restoredSpeed !== null && (
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-yellow-500" />
                      <span className="text-green-700">{formatSpeed(restoredSpeed)}</span>
                    </div>
                  )}
                  {restoredRtt !== null && (
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-500" />
                      <span className="text-green-700">{formatLatency(restoredRtt)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClearRestored}
                  className="flex-1 py-3 px-4 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#22C55E' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#16A34A'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#22C55E'; }}
                >
                  <X size={18} />
                  Close Now
                </button>
              </div>
              <div className="mt-4 text-center">
                <p className="text-xs text-green-700 opacity-60">This will close automatically in a few seconds.</p>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // For error modal, check if it should be shown
  if (!isOpen || (!currentLastError && !networkStatus.lastError)) return null;

  // Use current error or fall back to network status error
  const error = currentLastError ? { message: currentLastError, details: 'Connection attempt failed', timestamp: Date.now(), type: 'connection_lost' as const } : networkStatus.lastError!;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        
        {/* Modal */}
        <motion.div
          className="w-full max-w-lg z-10"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <GlassCard className="p-8 relative overflow-hidden">
            {/* Close button (optional) */}
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full transition-colors"
                style={{ 
                  backgroundColor: 'rgba(166, 82, 27, 0.1)',
                  color: '#A6521B'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                }}
              >
                <X size={16} />
              </button>
            )}

            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <img
                src={networkErrorImg}
                alt="Network error lion"
                className="w-32 h-32 object-contain mx-auto"
                style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.10))' }}
              />
            </div>

            {/* Error Title */}
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#2C1B12' }}>
                {typeof error.message === 'string' ? error.message : 'Connection Error'}
              </h2>
              <p className="text-sm" style={{ color: '#A6521B', opacity: 0.8 }}>
                {typeof error.details === 'string' ? error.details : 'Unable to establish connection'}
              </p>
            </div>

            {/* Network Status */}
            <div className="mb-6 p-4 rounded-lg border border-orange-100/60 bg-white/40 backdrop-blur-[6px]">
              <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#2C1B12' }}>
                <Shield size={16} />
                Network Status
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {!networkStatus.isOnline ? (
                  <>
                    <div className="flex items-center gap-2">
                      <WifiOff size={16} className="text-red-500" />
                      <span style={{ color: '#A6521B' }}>
                        Disconnected
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-red-500" />
                      <span style={{ color: '#A6521B' }}>
                        No Internet
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {getConnectionIcon(connectionType)}
                      <span style={{ color: '#A6521B' }}>
                        {connectionType.charAt(0).toUpperCase() + connectionType.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getSignalIcon(effectiveType)}
                      <span style={{ color: '#A6521B' }}>
                        {effectiveType.toUpperCase()}
                      </span>
                    </div>
                    {downlink > 0 && (
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-yellow-500" />
                        <span style={{ color: '#A6521B' }}>
                          {formatSpeed(downlink)}
                        </span>
                      </div>
                    )}
                    {rtt > 0 && (
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-blue-500" />
                        <span style={{ color: '#A6521B' }}>
                          {formatLatency(rtt)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onRetry}
                disabled={currentIsRetrying}
                className="flex-1 py-3 px-4 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: currentIsRetrying ? '#ccc' : '#F6C148'
                }}
                onMouseEnter={(e) => {
                  if (!currentIsRetrying) {
                    e.currentTarget.style.backgroundColor = '#A6521B';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!currentIsRetrying) {
                    e.currentTarget.style.backgroundColor = '#F6C148';
                  }
                }}
              >
                <RefreshCw size={18} className={currentIsRetrying ? 'animate-spin' : ''} />
                {currentIsRetrying ? `Retrying... (${currentRetryCount})` : 'Retry Connection'}
              </button>
              
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-lg font-medium transition-colors border"
                  style={{
                    backgroundColor: 'rgba(166, 82, 27, 0.1)',
                    borderColor: 'rgba(166, 82, 27, 0.2)',
                    color: '#A6521B'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                  }}
                >
                  Dismiss
                </button>
              )}
            </div>

            {/* Error Timestamp */}
            <div className="mt-4 text-center">
              <p className="text-xs" style={{ color: '#A6521B', opacity: 0.6 }}>
                Error occurred at {new Date(error.timestamp).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true
                })}
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}; 