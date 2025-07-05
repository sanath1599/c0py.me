import React, { useState, useEffect, useCallback } from 'react';
import './ConnectionStatus.css';

const ConnectionStatus = ({ isConnected }) => {
  const [connectionInfo, setConnectionInfo] = useState({
    status: 'disconnected',
    latency: null,
    serverUrl: process.env.REACT_APP_SERVER_URL || 'http://localhost:5000'
  });

  const measureLatency = useCallback(async () => {
    try {
      const start = Date.now();
      await fetch(`${connectionInfo.serverUrl}/api/health`);
      const end = Date.now();
      const latency = end - start;
      setConnectionInfo(prev => ({ ...prev, latency }));
    } catch (error) {
      // handle error
    }
  }, [connectionInfo.serverUrl]);

  useEffect(() => {
    if (isConnected) {
      setConnectionInfo(prev => ({ ...prev, status: 'connected' }));
      measureLatency();
    } else {
      setConnectionInfo(prev => ({ ...prev, status: 'disconnected' }));
    }
  }, [isConnected, measureLatency]);

  const getStatusColor = () => {
    switch (connectionInfo.status) {
      case 'connected':
        return '#4CAF50';
      case 'disconnected':
        return '#f44336';
      default:
        return '#ff9800';
    }
  };

  const getStatusText = () => {
    switch (connectionInfo.status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Connecting...';
    }
  };

  return (
    <div className="connection-status">
      <div className="status-indicator">
        <div 
          className="status-dot" 
          style={{ backgroundColor: getStatusColor() }}
        ></div>
        <span className="status-text">{getStatusText()}</span>
      </div>
      
      {isConnected && connectionInfo.latency && (
        <div className="connection-info">
          <span className="latency">Latency: {connectionInfo.latency}ms</span>
          <span className="server">Server: {connectionInfo.serverUrl}</span>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus; 