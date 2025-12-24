# Logs Auto-Upload and Admin Security Implementation

## Changes Implemented

### 1. Removed Manual Upload Buttons

**File**: `apps/web/src/components/EventTable.tsx`

- Removed "Upload to Backend" button
- Removed "View Uploaded" button
- Removed `handleUploadLogs` function
- Removed `UploadedLogsViewer` modal
- Removed unused state variables (`uploading`, `showUploadedLogs`)

**Result**: Logs are now automatically uploaded on key events, eliminating the need for manual upload buttons.

### 2. Automatic Log Upload on Key Events

**File**: `apps/web/src/utils/eventLogger.ts`

#### Added Auto-Upload Functionality
```typescript
// Automatic upload on key events - called after specific events occur
let autoUploadScheduled = false;
let autoUploadTimeout: NodeJS.Timeout | null = null;

function scheduleAutoUpload() {
  // Debounce uploads - wait 2 seconds after last event before uploading
  if (autoUploadTimeout) {
    clearTimeout(autoUploadTimeout);
  }
  
  autoUploadTimeout = setTimeout(async () => {
    if (autoUploadScheduled) return;
    autoUploadScheduled = true;
    
    try {
      const logs = flushEvents();
      if (logs.length > 0) {
        await logUploadService.uploadLogs(logs, sessionId);
        console.log('📤 Logs automatically uploaded');
      }
    } catch (error) {
      console.error('Failed to auto-upload logs:', error);
    } finally {
      autoUploadScheduled = false;
    }
  }, 2000); // Wait 2 seconds after event before uploading
}
```

#### Events That Trigger Auto-Upload

1. **Incoming File** (`fileReceived`)
   - Triggered when a file request is received
   - Location: `apps/web/src/hooks/useWebRTC.ts` - when `file-request` message is received
   - Calls: `logSystemEvent.fileReceived()` which triggers `scheduleAutoUpload()`

2. **File Transfer Initiated** (`transferInitiated`)
   - Triggered when user initiates a file transfer
   - Location: `apps/web/src/utils/eventLogger.ts` - `logUserAction.transferInitiated()`
   - Automatically calls `scheduleAutoUpload()`

3. **File Transfer Completed** (`transferCompleted`)
   - Triggered when a file transfer finishes
   - Location: `apps/web/src/utils/eventLogger.ts` - `logSystemEvent.transferCompleted()`
   - Automatically calls `scheduleAutoUpload()`

4. **Change Room** (`roomJoined`)
   - Triggered when user joins a room
   - Location: `apps/web/src/utils/eventLogger.ts` - `logUserAction.roomJoined()`
   - Automatically calls `scheduleAutoUpload()`

#### Auto-Upload Behavior
- **Debounced**: Waits 2 seconds after the last event before uploading
- **Prevents Duplicates**: Uses `autoUploadScheduled` flag to prevent concurrent uploads
- **Silent**: Uploads happen in the background without user interaction
- **Error Handling**: Errors are logged but don't interrupt the application

### 3. Password-Protected Admin Page

**Files Modified**:
- `apps/web/src/pages/AdminLogin.tsx` (new file)
- `apps/web/src/pages/AdminDashboard.tsx`
- `apps/web/src/pages/AppPage.tsx`
- `apps/web/src/App.tsx`

#### Admin Login Page (`/admin/login`)
- **Password**: `sharedrop2024` (stored in code)
- **Features**:
  - Password input with show/hide toggle
  - Error message display
  - Loading state during authentication
  - Redirects to `/admin` on success
  - Stores authentication in `sessionStorage`
  - Beautiful glassmorphism UI matching app design

#### Admin Dashboard Protection
- Checks `sessionStorage.getItem('admin_authenticated')` on mount
- Redirects to `/admin/login` if not authenticated
- Authentication persists for the browser session
- Returns `null` while checking authentication (prevents flash of content)

#### Removed Admin Button from Navbar
- Removed admin button from `AppPage.tsx` navbar
- Admin access is now only available via direct URL: `/admin/login`
- Secret access - no visible link in the UI

## Implementation Details

### Auto-Upload Flow

1. **Event Occurs** (e.g., file received, transfer initiated)
2. **Event Logged** via `logUserAction` or `logSystemEvent`
3. **Auto-Upload Scheduled** via `scheduleAutoUpload()`
4. **Debounce Wait** (2 seconds)
5. **Upload Executed** (if no new events in 2 seconds)
6. **Logs Flushed** and uploaded to backend

### Admin Access Flow

1. **User navigates to** `/admin` or `/admin/login`
2. **If not authenticated**: Redirected to `/admin/login`
3. **User enters password**: `sharedrop2024`
4. **On success**: `sessionStorage.setItem('admin_authenticated', 'true')`
5. **Redirected to** `/admin` dashboard
6. **Dashboard checks authentication** on each render
7. **If session expires**: Redirected back to login

## Security Considerations

### Admin Password
- Currently hardcoded as `sharedrop2024`
- Stored in `apps/web/src/pages/AdminLogin.tsx`
- **Recommendation**: Move to environment variable for production
- Authentication stored in `sessionStorage` (cleared on browser close)

### Auto-Upload Security
- Uploads happen automatically without user consent
- No sensitive data should be logged
- Uploads are debounced to prevent excessive API calls
- Errors are logged but don't expose sensitive information

## Testing Recommendations

1. **Test Auto-Upload**:
   - Receive a file → Check console for "📤 Logs automatically uploaded"
   - Initiate transfer → Verify upload after 2 seconds
   - Complete transfer → Verify upload
   - Change room → Verify upload

2. **Test Admin Access**:
   - Navigate to `/admin` → Should redirect to `/admin/login`
   - Enter wrong password → Should show error
   - Enter correct password → Should access dashboard
   - Close browser → Should require login again

3. **Test Button Removal**:
   - Check navbar → Admin button should not be visible
   - Access admin via `/admin/login` → Should work

## Files Modified

1. `apps/web/src/components/EventTable.tsx` - Removed upload buttons
2. `apps/web/src/utils/eventLogger.ts` - Added auto-upload functionality
3. `apps/web/src/hooks/useWebRTC.ts` - Added logging for incoming files
4. `apps/web/src/pages/AdminLogin.tsx` - New password-protected login page
5. `apps/web/src/pages/AdminDashboard.tsx` - Added authentication check
6. `apps/web/src/pages/AppPage.tsx` - Removed admin button from navbar
7. `apps/web/src/App.tsx` - Added `/admin/login` route

## Future Improvements

1. **Environment Variable for Password**: Move admin password to `.env` file
2. **Session Timeout**: Add automatic logout after inactivity
3. **Rate Limiting**: Add rate limiting for auto-uploads to prevent abuse
4. **Upload Queue**: Implement upload queue for failed uploads
5. **Upload Status**: Show upload status indicator in UI (optional)

