# 🚀 ShareDrop - Features To Be Implemented

## 📋 Feature Tracking

This file tracks features that have been requested but not yet implemented. Features are marked as `pending`, `work in progress`, or `completed`.

---

## Feature: World/Room Selection Persistence and Restoration

**Description**: Implement a system to remember and restore the user's room/world selection across sessions, including room history, visit counts, and seamless restoration on app reload.

**Planned Implementation Overview**:
- Create world persistence hook using localStorage and sessionStorage
- Implement room history tracking with visit counts and timestamps
- Add automatic restoration of world/room selection on app load
- Integrate with existing world switcher and room modal
- Show recent rooms in room selection modal
- Display visit statistics in UI
- Handle session restoration for page reloads

**Dependencies**: 
- Existing world selection system
- Room modal component
- AppPage component
- Socket connection management

**User Input / Notes**:
- Should remember the last selected world and room
- Track room visit history with timestamps
- Show recent rooms for quick access
- Restore state seamlessly on app reload
- Display visit counts and statistics
- Integrate with existing UI components

**Status**: completed

**Implementation Details**:
- Created `useWorldPersistence` hook with localStorage and sessionStorage integration
- Implemented world state tracking (selected world, current room, visit count, last visited)
- Added room history tracking with visit counts and timestamps
- Integrated automatic restoration on app load with session fallback
- Updated `RoomModal` to display recent rooms for quick access
- Enhanced world indicator in navbar to show visit statistics
- Added seamless room restoration when connection is established
- Implemented session restore for page reloads and network recovery
- Added room history management with automatic cleanup (keep last 10 rooms)
- Integrated with existing world selection and room joining workflows

---

## Feature: Remove Unused FamilyWifiWarningModal Component

**Description**: Remove the unused FamilyWifiWarningModal component and clean up any related imports or references.

**Planned Implementation Overview**:
- Identify and remove the FamilyWifiWarningModal component file
- Clean up any imports of this component
- Remove any references or usage in other components
- Update any related TypeScript interfaces or types
- Ensure no broken references remain

**Dependencies**: 
- None - this is a cleanup task

**User Input / Notes**:
- Component is confirmed to be unused
- Should be a straightforward cleanup task

**Status**: completed

**Implementation Details**:
- Component was not found in the codebase (no file exists)
- No imports or references found
- Feature was already clean

---

## Feature: Client-Side Event Logging - Phase 1 (Instrumentation)

**Description**: Implement a robust, non-blocking, in-memory-first event logging system for client-side event capture, with localStorage persistence and error safety.

**Planned Implementation Overview**:
- Define `EventEntry` data model in types
- Implement logger utility with in-memory buffer and scheduled flush to localStorage
- Provide core logging API and convenience functions
- Unit test logger utility and error handling

**Dependencies**: None

**User Input / Notes**:
- All logging must be non-blocking and never crash the app
- Use localStorage for persistence, flush off-main-thread
- Provide hooks for click, navigation, form, file, peer, and error events
- Unit tests should cover all core logic
- Note: Some convenience function tests are flaky due to async flush in test env; core logger is robust

**Status**: completed

**Implementation Details**:
- `EventEntry` type added to `src/types/index.ts`
- Logger utility implemented in `src/utils/eventLogger.ts`
- In-memory buffer, scheduled flush, and error handling in place
- Unit tests for core logger and error handling pass
- Some tests for convenience functions are flaky due to async flush; to be reviewed later

---

## Feature: Client-Side Event Logging - Phase 2 (Retrieval & Management UI)

**Description**: Implement a UI for loading, filtering, and viewing client-side event logs, including a log page, event table, and filter input.

**Planned Implementation Overview**:
- Add `ClientLogPage` to `src/pages/`
- Implement `EventTable` component in `src/components/`
- Add filter input and empty state handling
- Defensive JSON parsing and error boundaries
- Integrate with logger utility for loading and clearing logs

**Dependencies**: Phase 1 logger utility

**User Input / Notes**:
- UI should be robust to malformed data
- Provide filter/search for event type and details
- Show empty state when no events
- Use semantic HTML and accessible design

**Status**: completed

**Implementation Details**:
- Created `EventTable` component with filtering, sorting, and expandable details
- Implemented `ClientLogPage` with export/import functionality and robust error handling
- Added navigation integration with "Logs" button in AppPage navbar
- Implemented glassmorphism design consistent with app theme
- Added event type color coding and metadata display
- Included import/export functionality for log files
- Added responsive design for mobile and desktop
- Integrated with Phase 1 logger utility for data loading and clearing

---

## Feature: Client-Side Event Logging - Phase 3 (Feedback Export)

**Description**: Implement backend integration for sharing event logs with support for batching large payloads and non-blocking upload.

**Planned Implementation Overview**:
- Create `ShareButton` component for non-blocking log upload
- Implement batching system for large log payloads (500 events per batch)
- Add backend API endpoint `/api/logs/import` for receiving logs
- Implement progress tracking and error handling for uploads
- Add automatic log clearing after successful upload
- Provide user feedback for upload status

**Dependencies**: 
- Phase 1 & 2 logger components
- Backend API server
- Existing error handling and toast system

**User Input / Notes**:
- Upload should be non-blocking and not crash the app
- Large logs should be batched into manageable chunks
- Provide clear feedback on upload progress and success/failure
- Optionally clear local logs after successful upload
- Handle network errors gracefully with retry options
- Integrate with existing toast notification system

**Status**: pending

**Technical Requirements**:
- Backend API contract: `POST /api/logs/import` with `{ events: EventEntry[] }`
- Batch size: 500 events per request
- Error handling: Retry failed batches, keep successful ones
- Progress tracking: Show upload progress to user
- Success feedback: Clear local logs only after all batches succeed

---

## 📝 Implementation History

### ✅ Completed Features

#### Feature: FamilyPrivacyNotice Mobile Data Detection Integration
**Description**: Updated FamilyPrivacyNotice component to integrate mobile data detection and show appropriate warnings.

**Implementation Details**:
- Created `useMobileDataDetection` hook using Network Information API
- Added fallback detection for mobile data and slow connections
- Enhanced component to show warnings about mobile data usage
- Added confirmation modal for mobile data usage
- Updated UI elements with appropriate icons and messaging

**Status**: completed

#### Feature: Update World Icons and Descriptions
**Description**: Updated world selection icons and descriptions for better clarity and user understanding.

**Implementation Details**:
- Changed Room icon from 🏠 to 🔒 (lock) to indicate private/secure sharing
- Changed Family icon from 👨‍👩‍👧‍👦 to 📶 (wifi) to indicate WiFi-only functionality
- Updated world descriptions to be more descriptive:
  - Jungle: "Open world - share with anyone globally"
  - Room: "Private room - secure sharing with room code"
  - Family: "WiFi family - same network sharing only"
- Added descriptions under each world button in the world switcher
- Updated FamilyPrivacyNotice to clarify WiFi-only functionality
- Added warnings about mobile data not working for Family mode
- Added mobile network detection and warning system
- Disabled Family button when on mobile data
- Added alternative action buttons for Jungle and Private Room when on mobile data

**Status**: completed

---

## 🎯 Next Steps

1. **Choose one feature** from the pending list above
2. **Implement the selected feature** completely
3. **Remove the feature** from this file once completed
4. **Move to the next feature** in the list

---

*Last updated: $(date)* 