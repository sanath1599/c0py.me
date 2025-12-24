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
- **Performance Optimization**: Refactored to focus only on meaningful events with consistent format
- **New Event Categories**: user_action (navigation, interaction, file_operation, profile) and system_event (connection, webrtc, transfer, api, error, performance)
- **Consistent Format**: All events now follow structured format with categories and relevant metadata
- **Reduced Verbosity**: Removed excessive logging, focusing on user actions and important system events

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

## Feature: Incoming Feedback Viewer - Admin Dashboard

**Description**: Implement a comprehensive admin dashboard for viewing and managing incoming feedback from clients, with enhanced filtering, statistics, and detailed log viewing capabilities.

**Planned Implementation Overview**:
- Create dedicated AdminDashboard page with comprehensive UI
- Implement real-time statistics and metrics display
- Add advanced filtering by session ID, device type, browser
- Provide sorting and search capabilities
- Include export functionality for log data
- Add bulk operations (clear all logs)
- Display detailed device information and session metadata
- Show event summaries with expandable details
- Integrate with existing backend API endpoints

**Dependencies**: 
- Existing backend logs API (`/api/logs/*`)
- Frontend log upload service
- Existing event logging system

**User Input / Notes**:
- Should provide comprehensive view of all uploaded logs
- Include statistics cards showing total logs, events, sessions
- Allow filtering by various criteria (session ID, device type, browser)
- Provide sorting options (upload date, event count, session ID)
- Include export functionality for data analysis
- Show detailed device information and network stats
- Display event details with proper formatting
- Integrate with existing navigation system

**Status**: completed

**Implementation Details**:
- Created `AdminDashboard` component with comprehensive UI
- Implemented statistics cards showing total logs, events, sessions, and averages
- Added filtering system for session ID, device type, and browser
- Implemented sorting functionality with multiple criteria
- Added export functionality for JSON data download
- Included bulk operations (clear all logs)
- Enhanced log details view with device information and metadata
- Integrated with existing backend API endpoints
- Added navigation integration with admin button in navbar
- Implemented responsive design for mobile and desktop
- Added proper error handling and loading states

---

## Feature: Server-Side Metrics & Stats

**Description**: Track and display server-side metrics over time including active WebSocket connections, file transfer operations, unique users, and user actions with visualization through charts.

**Planned Implementation Overview**:
- Implement real-time WebSocket connection tracking
- Add file transfer metrics (in-progress, completed, failed)
- Track unique users and session statistics
- Create time-series data collection system
- Implement chart visualization (line/bar charts)
- Add time-range filtering (last hour, 24h, all time)
- Display connection throughput and performance metrics
- Show user activity patterns and trends

**Dependencies**: 
- Socket service and WebRTC implementation
- Database models for metrics storage
- Chart visualization library

**User Input / Notes**:
- Track active WebSocket connections in real-time
- Monitor file transfer operations and throughput
- Display unique user counts and session statistics
- Show user actions (clicks, forms, downloads)
- Provide time-series visualization with charts
- Support multiple time ranges for analysis
- Include performance metrics and trends

**Status**: pending

---

## Feature: Admin Controls & Analytics

**Description**: Implement advanced admin controls and analytics with filtering by time-range, user ID, event type, and include export options and administrative actions.

**Planned Implementation Overview**:
- Add time-range filtering (last hour, 24h, 7 days, 30 days, all time)
- Implement user ID and event type filtering
- Create advanced search and filtering controls
- Add administrative actions (clear logs, resend notifications)
- Implement CSV/JSON export options
- Add bulk operations and batch processing
- Include user management and session control
- Provide analytics dashboard with insights

**Dependencies**: 
- Incoming Feedback Viewer implementation
- Backend API enhancements
- Export functionality

**User Input / Notes**:
- Allow filtering by time-range with preset options
- Support filtering by user ID and event type
- Include advanced search capabilities
- Provide administrative controls for log management
- Add export options in multiple formats
- Include bulk operations for efficiency
- Show analytics insights and trends

**Status**: pending

---

## Feature: URL-Based Routing System

**Description**: Implement proper URL-based routing for the application with React Router, including routes for `/app`, `/admin`, `/logs`, and improved navigation.

**Planned Implementation Overview**:
- Add React Router DOM for client-side routing
- Implement routes for `/app`, `/admin`, `/logs`, and `/`
- Update components to use React Router navigation
- Add page tracking for analytics
- Ensure proper navigation between pages
- Handle 404 redirects to landing page

**Dependencies**: 
- React Router DOM
- Existing page components
- Analytics tracking system

**User Input / Notes**:
- Need proper URL routing instead of state-based navigation
- Routes should be `/app`, `/admin`, `/logs`, and `/`
- Should maintain existing functionality
- Add proper page tracking for analytics

**Status**: completed

**Implementation Details**:
- Added React Router DOM dependency
- Implemented BrowserRouter with Routes and Route components
- Created routes for `/` (LandingPage), `/app` (AppPage), `/admin` (AdminDashboard), `/logs` (ClientLogPage)
- Updated all components to use `useNavigate` hook instead of prop-based navigation
- Added PageTracker component for automatic page view tracking
- Implemented 404 redirect to landing page
- Maintained all existing functionality while improving URL structure

---

## Feature: Connection Stability Improvements

**Description**: Fix multiple disconnections and reconnections by improving connection timeout handling, peer cleanup logic, and reconnection management.

**Planned Implementation Overview**:
- Increase ping timeout from 90s to 180s for better stability
- Extend peer removal delay from 30s to 5 minutes for reconnection attempts
- Increase cleanup frequency from 5 minutes to 15 minutes
- Extend peer expiration from 5 minutes to 15 minutes
- Add better reconnection detection and handling
- Improve error handling for socket connections

**Dependencies**: 
- Socket service implementation
- Redis peer management
- Server cleanup scheduling

**User Input / Notes**:
- Users are frequently disconnecting and reconnecting
- "Remove offline peer" messages are happening too quickly
- Need more stable connection handling
- Should allow for network interruptions and reconnections

**Status**: completed

**Implementation Details**:
- Increased ping timeout from 90 seconds to 180 seconds (3 minutes)
- Extended peer removal delay from 30 seconds to 5 minutes
- Increased scheduled cleanup frequency from 5 minutes to 15 minutes
- Extended peer expiration time from 5 minutes to 15 minutes
- Added reconnection detection in handleJoinRoom
- Added socket error handling to prevent crashes
- Improved logging for reconnection events
- All changes maintain backward compatibility

---

## Feature: Visualization & Infrastructure

**Description**: Implement comprehensive visualization and infrastructure with real-time dashboards, charts showing trends, and performance monitoring.

**Planned Implementation Overview**:
- Create real-time dashboard with live updates
- Implement chart visualization (line, bar, time-series)
- Add WebSocket count monitoring
- Display file transfer throughput metrics
- Show events per user and per event type
- Implement performance monitoring and alerts
- Add infrastructure health monitoring
- Create responsive dashboard layouts

**Dependencies**: 
- Server-side metrics implementation
- Chart visualization library
- Real-time data infrastructure

**User Input / Notes**:
- Real-time WebSocket connection monitoring
- File transfer throughput visualization
- Events per user and event type charts
- Performance monitoring and trend analysis
- Infrastructure health indicators
- Responsive dashboard design

**Status**: pending

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