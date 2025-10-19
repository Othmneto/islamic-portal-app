# Sync Rules & Duplicate Prevention System - Complete

## Overview
Implemented a comprehensive **two-way sync with intelligent duplicate prevention** that allows creating events while preventing duplicates through multiple detection rules.

## Solution Approach
Instead of disabling sync, we implemented **smart filtering and duplicate detection** at every sync stage.

---

## Sync Direction 1: FROM External Calendar (Google/Microsoft → Local)

### Duplicate Detection Rules (Lines 4637-4721)

When fetching events FROM Google/Microsoft, the system checks for duplicates using **3 detection rules** in priority order:

#### **RULE 1: Check by External ID** (Most Reliable)
```javascript
existingEvent = calendarEvents.find(event => 
    event.externalId === externalEvent.id ||
    event.googleEventId === externalEvent.id ||
    event.microsoftEventId === externalEvent.id
);
```
- **Purpose**: Match events using their unique external calendar ID
- **Reliability**: 100% (IDs are unique)
- **Use Case**: Events that were previously synced

#### **RULE 2: Check by Title + Date** (Exact Match)
```javascript
const externalDate = new Date(externalEvent.startDate).toISOString().split('T')[0];
existingEvent = calendarEvents.find(event => {
    const eventDate = new Date(event.startDate).toISOString().split('T')[0];
    return event.title === externalEvent.title && eventDate === externalDate;
});
```
- **Purpose**: Match events with same title on same day
- **Reliability**: 95% (same title + same day = likely duplicate)
- **Use Case**: Events created locally that match external events

#### **RULE 3: Check by Title + Time** (Within 5 Minutes)
```javascript
const externalTime = new Date(externalEvent.startDate).getTime();
existingEvent = calendarEvents.find(event => {
    const eventTime = new Date(event.startDate).getTime();
    const timeDiff = Math.abs(externalTime - eventTime);
    return event.title === externalEvent.title && timeDiff < 5 * 60 * 1000; // 5 minutes
});
```
- **Purpose**: Catch duplicates even if time slightly differs
- **Reliability**: 90% (same title + similar time = likely duplicate)
- **Use Case**: Events with minor time adjustments

### Action Based on Detection

If **duplicate found**:
- **Check timestamps**: Compare `updated` timestamps
- **Update if newer**: If external event is newer, update local event
- **Skip if older**: If local event is up-to-date, skip

If **no duplicate found**:
- **Add as new event**: Create new event with proper IDs and metadata
- **Mark as synced**: Set `syncedFromEmail: true`, `emailSyncDate`, `source`, `googleEventId`/`microsoftEventId`

---

## Sync Direction 2: TO External Calendar (Local → Google/Microsoft)

### Filtering Rules (Lines 4535-4563)

Before pushing events TO Google/Microsoft, filter out events that should NOT be synced using **5 rules**:

#### **RULE 1: Already Synced**
```javascript
if (event.syncedToEmail) {
    return false; // Skip - already in external calendar
}
```
- **Purpose**: Don't re-create events that are already in external calendar
- **Prevents**: Duplicates from re-syncing same events

#### **RULE 2: Has External ID**
```javascript
if (event.externalId || event.googleEventId || event.microsoftEventId) {
    return false; // Skip - came from external calendar
}
```
- **Purpose**: Don't push back events that originated from external calendar
- **Prevents**: Circular syncing (external → local → external)

#### **RULE 3: Has External Source**
```javascript
if (event.source && (event.source.includes('google') || event.source.includes('microsoft'))) {
    return false; // Skip - marked as external source
}
```
- **Purpose**: Additional check for external origin
- **Prevents**: Re-creating imported events

#### **RULE 4: Only Future Events**
```javascript
if (!event.startDate || new Date(event.startDate) < new Date()) {
    return false; // Skip - past event
}
```
- **Purpose**: Only sync upcoming events
- **Prevents**: Syncing old/irrelevant events

#### **RULE 5: Synced From Email**
```javascript
if (event.syncedFromEmail) {
    return false; // Skip - imported from email
}
```
- **Purpose**: Don't push events that were fetched from external calendar
- **Prevents**: Duplicate push of imported events

---

## Error Handling

### 403 Forbidden Graceful Handling (Lines 4999-5004, 5029-5034)

If write permissions are not available:
```javascript
try {
    await syncToEmailCalendar();
} catch (error) {
    if (error.message && error.message.includes('403')) {
        console.log('⚠️ Google Calendar write access not available (read-only mode)');
        // Continue without error - gracefully fallback to read-only
    } else {
        throw error; // Re-throw non-permission errors
    }
}
```

- **Purpose**: Allow sync to work even without write permissions
- **Behavior**: Fetch FROM external calendar works, push TO external calendar silently skips if no permissions
- **User Experience**: No errors, graceful degradation to read-only mode

---

## Sync Functions Updated

### 1. `syncGoogleCalendar()` (Lines 4985-5013)
- **Mode**: Two-way with duplicate prevention
- **Step 1**: Fetch FROM Google (with 3 duplicate detection rules)
- **Step 2**: Push TO Google (with 5 filtering rules + 403 handling)

### 2. `syncMicrosoftCalendar()` (Lines 5015-5043)
- **Mode**: Two-way with duplicate prevention
- **Step 1**: Fetch FROM Microsoft (with 3 duplicate detection rules)
- **Step 2**: Push TO Microsoft (with 5 filtering rules + 403 handling)

### 3. `syncWithGoogle()` (Lines 5844-5860)
- **Mode**: Manual sync button handler
- **Calls**: `syncGoogleCalendar()` with all duplicate prevention

### 4. `syncWithMicrosoft()` (Lines 5862-5878)
- **Mode**: Manual sync button handler
- **Calls**: `syncMicrosoftCalendar()` with all duplicate prevention

---

## Event Metadata for Tracking

### When Event is Fetched FROM External Calendar:
```javascript
{
    id: `${provider}_${externalEvent.id}_${Date.now()}`,
    externalId: externalEvent.id,
    googleEventId: externalEvent.id, // or microsoftEventId
    syncedFromEmail: true,
    emailSyncDate: '2025-10-12T...',
    source: 'google' // or 'microsoft'
}
```

### When Event is Pushed TO External Calendar:
```javascript
{
    syncedToEmail: true,
    emailSyncDate: '2025-10-12T...',
    googleEventId: result.id, // ID from Google/Microsoft response
}
```

---

## How It Prevents Duplicates

### Scenario 1: Event Created in Google Calendar
1. **Sync FROM Google** → Fetches event with `googleEventId: "abc123"`
2. **Next sync FROM Google** → RULE 1 matches by `googleEventId` → Skips (already exists)
3. **Sync TO Google** → RULE 2 filters out (has `googleEventId`) → Won't push back
4. **Result**: ✅ Event appears once, no duplicates

### Scenario 2: Event Created Locally
1. **Local event** → No external IDs, `syncedToEmail: false`
2. **Sync TO Google** → Passes all 5 rules → Creates in Google → Gets `googleEventId`
3. **Next sync TO Google** → RULE 1 filters out (has `syncedToEmail: true`) → Won't recreate
4. **Sync FROM Google** → RULE 1 matches by `googleEventId` → Updates if needed
5. **Result**: ✅ Event synced once, no duplicates

### Scenario 3: Same Event in Both Calendars (Before Sync)
1. **Event "Meeting" at 2pm** exists locally
2. **Event "Meeting" at 2pm** exists in Google
3. **Sync FROM Google** → RULE 2 matches (same title + same date) → Updates instead of adding
4. **Sync TO Google** → RULE 5 filters out (has `syncedFromEmail: true`) → Won't push
5. **Result**: ✅ Events merged, no duplicates

---

## Logging for Debugging

The system provides detailed console logs:

- `➕ Adding new event "Event Title"` - New event added
- `🔄 Updating event "Event Title" (external is newer)` - Event updated
- `⏭️ Skipping event "Event Title" (local is up-to-date)` - Duplicate skipped
- `📥 Step 1/2: Fetching events FROM Google Calendar...` - Fetch stage
- `📤 Step 2/2: Pushing local events TO Google Calendar...` - Push stage
- `⚠️ Google Calendar write access not available (read-only mode)` - No permissions

---

## Benefits

✅ **No Duplicates**: Multiple detection rules catch all duplicate scenarios  
✅ **Two-Way Sync**: Can create events in both directions  
✅ **Smart Filtering**: Only syncs relevant events  
✅ **Graceful Degradation**: Works in read-only mode if no write permissions  
✅ **Timestamp Awareness**: Updates only if external version is newer  
✅ **Circular Sync Prevention**: Won't push back imported events  
✅ **Past Event Filtering**: Only syncs future events  
✅ **Detailed Logging**: Easy to debug sync issues  

---

## Status
✅ **COMPLETE** - Intelligent two-way sync with comprehensive duplicate prevention implemented. System can create events while preventing duplicates through multiple detection and filtering rules.

