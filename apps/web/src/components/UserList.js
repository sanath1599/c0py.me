import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './UserList.css';

const UserList = ({ userId, username }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    // Connect to socket server
    const socket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000');
    socket.emit('join', userId);

    // Fetch initial users
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_SERVER_URL || 'http://localhost:5000'}/api/users`);
        const data = await response.json();
        setUsers(data.users.filter(user => user !== userId));
      } catch (error) {
        // Error fetching users
      }
    };
    fetchUsers();

    // Listen for real-time user events
    socket.on('userJoined', (data) => {
      if (data.userId !== userId) {
        setUsers(prev => Array.from(new Set([...prev, data.userId])));
      }
    });
    socket.on('userLeft', (data) => {
      setUsers(prev => prev.filter(user => user !== data.userId));
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
  };

  const sendFileToUser = (targetUserId) => {
    if (window.sendFileToUser) {
      window.sendFileToUser(targetUserId);
    }
  };

  return (
    <div className="user-list">
      <h3>Connected Users</h3>
      <div className="current-user">
        <p>You: {username}</p>
      </div>
      {users.length === 0 ? (
        <div className="no-users">
          <p>No other users connected</p>
          <p>Share this link with others to start file sharing!</p>
        </div>
      ) : (
        <div className="users">
          {users.map(user => (
            <div 
              key={user} 
              className={`user-item ${selectedUser === user ? 'selected' : ''}`}
              onClick={() => handleUserSelect(user)}
            >
              <span className="user-name">{user}</span>
              <span className="user-status online">●</span>
            </div>
          ))}
        </div>
      )}
      {selectedUser && (
        <div className="selected-user-actions">
          <h4>Send file to: {selectedUser}</h4>
          <button 
            onClick={() => sendFileToUser(selectedUser)}
            className="send-file-btn"
          >
            Send File
          </button>
        </div>
      )}
    </div>
  );
};

export default UserList; 