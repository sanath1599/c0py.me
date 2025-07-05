# ShareDrop Demo Guide

This guide will help you test the ShareDrop file sharing application.

## Prerequisites

1. MongoDB running on your system
2. Node.js and npm installed
3. Two browser windows/tabs (to simulate two users)

## Quick Start

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Open two browser windows**
   - Window 1: `http://localhost:3000`
   - Window 2: `http://localhost:3000`

## Demo Steps

### Step 1: Connect Users

1. **In Window 1:**
   - Enter username: "Alice"
   - Click "Connect"

2. **In Window 2:**
   - Enter username: "Bob"
   - Click "Connect"

3. **Verify Connection:**
   - Both users should see each other in the "Connected Users" panel
   - Connection status should show "Connected" with green dot

### Step 2: Send a File

1. **In Window 1 (Alice):**
   - Select a file using the file input
   - Click on "Bob" in the user list
   - Click "Send File" button

2. **In Window 2 (Bob):**
   - You should see a pending transfer request
   - Click "Accept" to receive the file

3. **Monitor Transfer:**
   - Watch the progress bar in both windows
   - File should appear in Bob's "Received Files" section

### Step 3: Download File

1. **In Window 2 (Bob):**
   - Click "Download" on the received file
   - File should download to your computer

## Testing Different Scenarios

### Large File Transfer
- Try transferring a file larger than 10MB
- Monitor the progress bar and transfer speed

### Multiple Files
- Send multiple files simultaneously
- Test the queue system

### Network Simulation
- Use browser dev tools to simulate slow network
- Test how the application handles network issues

### Cross-Browser Testing
- Test between different browsers (Chrome, Firefox, Safari)
- Verify WebRTC compatibility

## Troubleshooting

### Common Issues

1. **Users don't see each other**
   - Check browser console for errors
   - Ensure both users are connected to the same server

2. **File transfer fails**
   - Check if both users are on the same network
   - Try refreshing the page
   - Check firewall settings

3. **MongoDB connection error**
   - Ensure MongoDB is running
   - Check the connection string in `.env`

### Debug Information

- Open browser dev tools (F12)
- Check Console tab for error messages
- Check Network tab for WebSocket connections
- Monitor WebRTC connections in Application tab

## Expected Behavior

### Successful Transfer
- Progress bar shows transfer progress
- File appears in recipient's received files list
- No errors in browser console
- Transfer completes without interruption

### Error Handling
- Graceful handling of network disconnections
- Clear error messages for failed transfers
- Automatic retry mechanisms for failed connections

## Performance Metrics

- **Transfer Speed**: Should be limited by network bandwidth
- **Connection Time**: WebRTC connection should establish within 5-10 seconds
- **File Size**: No practical limit (limited by browser memory)
- **Concurrent Transfers**: Multiple transfers should work simultaneously

## Security Features

- Files are transferred directly between peers
- No file content stored on server
- WebRTC connections are encrypted
- User sessions are isolated

This demo showcases the core functionality of ShareDrop. The application is designed to be simple yet powerful, providing a seamless peer-to-peer file sharing experience. 