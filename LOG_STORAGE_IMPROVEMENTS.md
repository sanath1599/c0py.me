# Log Storage Improvements

## Overview
Enhanced log storage system to update existing logs by session ID instead of creating duplicates, removed IP address storage for privacy, and added event filtering/search capabilities in the admin dashboard.

## Changes Implemented

### 1. Session-Based Log Updates (Backend)

**File**: `apps/api/src/routes/logs.ts`

#### Updated Log Storage Logic
- **Before**: Each log upload created a new entry, even for the same session
- **After**: Logs are now mapped by `sessionId` - if a log with the same session ID exists, it's updated instead of creating a new entry

#### Implementation Details
```typescript
// Check if log entry with this sessionId already exists
const files = await fs.readdir(LOGS_DIR);
const jsonFiles = files.filter(file => file.endsWith('.json'));

let existingLog: StoredLogEntry | null = null;
let existingFilePath: string | null = null;

for (const file of jsonFiles) {
  const logEntry: StoredLogEntry = JSON.parse(content);
  if (logEntry.sessionId === sessionId) {
    existingLog = logEntry;
    existingFilePath = filepath;
    break;
  }
}
```

#### Update Behavior
- **Merges Logs**: New events are appended to existing logs (duplicates by timestamp are avoided)
- **Updates Device Info**: Latest device information replaces old data
- **Preserves Upload Time**: Original `uploadedAt` timestamp is preserved
- **Tracks Updates**: New `lastUpdatedAt` field tracks when log was last modified
- **Response**: Returns `isUpdate: true` when updating existing log vs creating new

#### Benefits
- Prevents duplicate log entries for the same session
- Consolidates all events from a session into a single entry
- Reduces storage overhead
- Easier to track session activity

### 2. Removed IP Address Storage (Privacy)

**Files Modified**:
- `apps/api/src/routes/logs.ts`
- `apps/web/src/pages/AdminDashboard.tsx`

#### Backend Changes
- Removed `ipAddress` field from `StoredLogEntry` interface
- Removed IP address extraction from request headers
- No longer stores: `req.ip`, `req.connection.remoteAddress`, or `x-forwarded-for` header

#### Frontend Changes
- Removed `ipAddress` from `UploadedLog` interface
- Removed IP address display from log list items
- Removed IP address from Session Metadata section

#### Privacy Benefits
- Complies with privacy regulations (GDPR, CCPA)
- Reduces privacy concerns
- Prevents potential IP-based tracking
- Still maintains session tracking via sessionId

### 3. Removed Connection Field

**File**: `apps/web/src/pages/AdminDashboard.tsx`

- Removed "Connection" field from Network & Browser section
- Kept: Downlink, RTT, Language, Platform
- Cleaner, more focused network information display

### 4. Event Filters and Search

**File**: `apps/web/src/pages/AdminDashboard.tsx`

#### New Features Added

1. **Event Search**
   - Text input to search events by type or details
   - Searches in event type and JSON details
   - Case-insensitive search

2. **Event Type Filter**
   - Dropdown to filter by specific event type
   - Dynamically populated from unique event types in selected log
   - "All Types" option to show all events

3. **Event Sorting**
   - Sort by: Timestamp or Event Type
   - Sort order: Ascending or Descending
   - Toggle button for sort order

4. **Event Count Display**
   - Shows "X of Y events" to indicate filtered vs total
   - Updates in real-time as filters change

#### Implementation

```typescript
const getFilteredAndSortedEvents = () => {
  if (!selectedLog) return [];
  
  let filtered = selectedLog.logs.filter(event => {
    // Search filter
    if (eventSearch) {
      const searchLower = eventSearch.toLowerCase();
      const eventType = (event.type || '').toLowerCase();
      const eventDetails = JSON.stringify(event.details || {}).toLowerCase();
      if (!eventType.includes(searchLower) && !eventDetails.includes(searchLower)) {
        return false;
      }
    }
    
    // Type filter
    if (eventTypeFilter && event.type !== eventTypeFilter) {
      return false;
    }
    
    return true;
  });
  
  // Sort events by timestamp or type
  filtered.sort((a, b) => {
    // Sorting logic...
  });
  
  return filtered;
};
```

#### UI Layout
- Event filters appear in a glass card above the events list
- 4-column grid layout (responsive)
- Filters reset when selecting a new log entry
- Empty state message when no events match filters

## Technical Details

### Backend Log Update Flow

1. **Check for Existing Log**
   - Read all JSON files in logs directory
   - Find log with matching `sessionId`
   - If found, prepare for update; otherwise, create new

2. **Merge Logic**
   - Create Set of existing event timestamps
   - Filter new events to exclude duplicates
   - Merge: `[...existingLogs, ...newLogs]`

3. **Update File**
   - Write updated log entry to existing file
   - Preserve original `uploadedAt` timestamp
   - Set new `lastUpdatedAt` timestamp

### Frontend Event Filtering

1. **Filter Chain**
   - Search filter → Type filter → Sort
   - All filters are applied sequentially
   - Real-time updates as user types/selects

2. **State Management**
   - `eventSearch`: Search query string
   - `eventTypeFilter`: Selected event type
   - `eventSortBy`: Sort field (timestamp/type)
   - `eventSortOrder`: Sort direction (asc/desc)

3. **Reset on Log Selection**
   - All event filters reset when new log is selected
   - Ensures clean state for each log view

## Files Modified

1. **Backend**:
   - `apps/api/src/routes/logs.ts`
     - Updated upload endpoint to check for existing logs
     - Removed IP address storage
     - Added `lastUpdatedAt` field
     - Implemented log merging logic

2. **Frontend**:
   - `apps/web/src/pages/AdminDashboard.tsx`
     - Removed IP address from interface and display
     - Removed Connection field from Network & Browser
     - Added event filter state variables
     - Added `getFilteredAndSortedEvents()` function
     - Added `getUniqueEventTypes()` function
     - Added event filter UI components
     - Updated events list to use filtered events
     - Added filter reset on log selection

## Benefits

### Storage Efficiency
- **Reduced Duplicates**: One log entry per session instead of multiple
- **Consolidated Data**: All events from a session in one place
- **Easier Management**: Simpler to find and manage session logs

### Privacy
- **No IP Storage**: Complies with privacy regulations
- **Reduced Risk**: Less sensitive data stored
- **User Trust**: Better privacy posture

### Usability
- **Event Search**: Quickly find specific events
- **Event Filtering**: Focus on specific event types
- **Event Sorting**: Organize events by time or type
- **Better UX**: More powerful event management

## Migration Notes

### Existing Logs
- Existing logs with IP addresses will still display them (if present)
- New logs will not have IP addresses
- Logs will be updated on next upload from same session

### Backward Compatibility
- Old log format still supported
- `lastUpdatedAt` is optional (for old logs)
- Frontend handles missing fields gracefully

## Testing Recommendations

1. **Session Update Test**:
   - Upload logs from same session twice
   - Verify logs are merged, not duplicated
   - Check `lastUpdatedAt` is updated

2. **Privacy Test**:
   - Verify no IP addresses in new logs
   - Check backend doesn't extract IP
   - Confirm frontend doesn't display IP

3. **Event Filtering Test**:
   - Select a log with multiple events
   - Test search functionality
   - Test type filter
   - Test sorting options
   - Verify filter reset on log selection

4. **Edge Cases**:
   - Empty search query
   - No matching events
   - Log with no events
   - Very large event lists

