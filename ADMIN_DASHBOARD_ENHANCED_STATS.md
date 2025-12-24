# Admin Dashboard Enhanced Statistics with Graphs

## Overview
Enhanced the admin dashboard to display comprehensive statistics with Total, This Week, and AVG/Day metrics along with visual graphs for better data insights.

## Changes Implemented

### 1. Added Recharts Library
**File**: `apps/web/package.json`
- Added `recharts: ^2.12.7` dependency for chart visualization
- **Note**: Run `pnpm install` (or your package manager) to install the dependency

### 2. Enhanced Statistics Interface
**File**: `apps/web/src/pages/AdminDashboard.tsx`

#### Updated `LogStats` Interface
```typescript
interface DailyData {
  date: string;
  logs: number;
  events: number;
  sessions: number;
}

interface LogStats {
  // Existing fields...
  totalLogs: number;
  totalEvents: number;
  totalSessions: number;
  
  // New weekly stats
  weeklyLogs: number;
  weeklyEvents: number;
  weeklySessions: number;
  
  // New daily averages
  avgLogsPerDay: number;
  avgEventsPerDay: number;
  avgSessionsPerDay: number;
  
  // Time series data for charts
  dailyData: DailyData[];
}
```

### 3. Enhanced Statistics Calculation
The `calculateStats` function now:
- **Calculates Weekly Stats**: Counts logs, events, and sessions from the last 7 days
- **Calculates Daily Averages**: Computes average logs, events, and sessions per day based on the total time period
- **Generates Time-Series Data**: Creates daily breakdown data for the last 7 days for chart visualization
- **Fills Missing Days**: Ensures all days in the last week are represented (even if no data)

### 4. Updated UI Components

#### Statistics Cards Layout
- Changed from 4 cards in a row to 3 cards (better spacing for graphs)
- Each card now displays:
  - **Total**: The overall count
  - **This Week**: Count from the last 7 days
  - **AVG/Day**: Average per day calculated from total period

#### Visual Charts
Each statistics card includes a graph:

1. **Total Logs Card**:
   - Line chart showing daily log count over the last 7 days
   - Orange/brown color scheme (#A6521B)

2. **Total Events Card**:
   - Bar chart showing daily event count over the last 7 days
   - Orange/brown color scheme (#A6521B)

3. **Unique Sessions Card**:
   - Line chart showing daily session count over the last 7 days
   - Golden yellow color scheme (#F6C148)

### 5. Chart Features
- **Responsive Design**: Charts adapt to container size
- **Tooltips**: Interactive tooltips on hover showing exact values
- **Styled Axes**: Custom styling matching the app's color scheme
- **Compact Layout**: 120px height charts that fit nicely in cards

## Implementation Details

### Weekly Calculation
```typescript
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
// Filters logs from the last 7 days
if (logDate >= oneWeekAgo) {
  weeklyEvents += eventCount;
  weeklyLogs++;
  weeklySessions.add(log.sessionId);
}
```

### Daily Average Calculation
```typescript
const daysDiff = Math.max(1, Math.ceil((now.getTime() - oldestDate.getTime()) / (24 * 60 * 60 * 1000)));
avgLogsPerDay = logData.length / daysDiff;
avgEventsPerDay = totalEvents / daysDiff;
avgSessionsPerDay = sessions.size / daysDiff;
```

### Time-Series Data Generation
```typescript
// Creates data for each day in the last week
for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  const dateKey = d.toISOString().split('T')[0];
  const dayData = dailyDataMap.get(dateKey) || { logs: 0, events: 0, sessions: new Set() };
  dailyData.push({
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    logs: dayData.logs,
    events: dayData.events,
    sessions: dayData.sessions.size,
  });
}
```

## Visual Design

### Card Structure
```
┌─────────────────────────────┐
│ 📊 Total Logs         1234  │
│ This Week: 45  AVG/Day: 6.2 │
│ ┌─────────────────────────┐ │
│ │     Line Chart          │ │
│ │   (7 days of data)      │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Color Scheme
- **Primary**: #A6521B (Dark orange/brown)
- **Accent**: #F6C148 (Golden yellow)
- **Text**: #2C1B12 (Dark brown)
- **Background**: Glassmorphism with rgba(255, 255, 255, 0.8)

## Usage

### Installation
After pulling the changes, install dependencies:
```bash
cd apps/web
pnpm install  # or npm install / yarn install
```

### Viewing Statistics
1. Navigate to `/admin/login`
2. Enter admin password
3. View the enhanced dashboard with:
   - Total counts
   - This week's activity
   - Daily averages
   - Visual trend graphs

## Benefits

1. **Better Insights**: Visual representation makes trends immediately apparent
2. **Time Context**: "This Week" provides recent activity context
3. **Normalized Metrics**: AVG/Day allows comparison across different time periods
4. **Quick Analysis**: Graphs show patterns at a glance
5. **Professional Look**: Enhanced visual appeal with modern chart components

## Future Enhancements

Potential improvements:
- [ ] Add time range selector (Last 7 days, Last 30 days, All time)
- [ ] Add comparison with previous period
- [ ] Export charts as images
- [ ] Add more chart types (pie charts for device types, browsers)
- [ ] Real-time updates for live statistics
- [ ] Add trend indicators (↑/↓ arrows showing change)

## Files Modified

1. `apps/web/package.json` - Added recharts dependency
2. `apps/web/src/pages/AdminDashboard.tsx` - Enhanced statistics calculation and UI

## Dependencies

- **recharts**: ^2.12.7 - React charting library built on D3.js
  - Provides LineChart, BarChart, ResponsiveContainer components
  - Lightweight and performant
  - Fully customizable styling

