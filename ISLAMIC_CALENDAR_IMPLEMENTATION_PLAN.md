# Islamic Calendar Integration & 30-Day Prayer Times Calendar - DETAILED PLAN

**Date**: October 13, 2025  
**Status**: 📋 **PLANNING PHASE**  

---

## 🎯 **Overview**

A comprehensive Islamic calendar system that displays:
1. **Hijri Calendar** (Islamic lunar calendar)
2. **Gregorian Calendar** (Standard calendar)
3. **Prayer Times** for each day (30 days ahead)
4. **Islamic Events** (Ramadan, Eid, etc.)
5. **Prayer Tracking** (which prayers completed)
6. **Moon Phases** (for Hijri date accuracy)

---

## 📅 **What I Will Build**

### 1. **Calendar Page** (`/calendar.html`)

#### A. **Dual Calendar View**
```
┌─────────────────────────────────────────┐
│  October 2025 (Gregorian)               │
│  Rabiʻ II 1447 AH (Hijri)              │
├─────────────────────────────────────────┤
│  Sun  Mon  Tue  Wed  Thu  Fri  Sat     │
├─────────────────────────────────────────┤
│   1    2    3    4    5    6    7      │
│  22   23   24   25   26   27   28      │ ← Hijri dates below
│                                         │
│   8    9   10   11   12   13   14      │
│  29   30    1    2    3    4    5      │
│                                         │
│  15   16   17   18   19   20   21      │
│   6    7    8    9   10   11   12      │
│                                         │
│  22   23   24   25   26   27   28      │
│  13   14   15   16   17   18   19      │
│                                         │
│  29   30   31                           │
│  20   21   22                           │
└─────────────────────────────────────────┘
```

#### B. **Prayer Times on Each Day**
```
┌──────────────┐
│  Oct 14      │
│  Rabiʻ II 23│
├──────────────┤
│ 🌅 4:58 AM   │ ← Fajr
│ 🌄 6:15 AM   │ ← Sunrise
│ ☀️ 12:15 PM  │ ← Dhuhr
│ 🌤️ 3:30 PM   │ ← Asr
│ 🌅 6:30 PM   │ ← Maghrib
│ 🌙 8:00 PM   │ ← Isha
├──────────────┤
│ ✅ 4/5 Prayed│ ← Prayer status
└──────────────┘
```

#### C. **Islamic Events Highlighted**
```
┌──────────────┐
│  Mar 1, 2025 │
│  Ramadan 1   │ ← Special styling
├──────────────┤
│ 🌙 RAMADAN   │
│   BEGINS     │
└──────────────┘

┌──────────────┐
│  Mar 30, 2025│
│  Ramadan 29  │
├──────────────┤
│ 🌟 EID       │
│   AL-FITR    │
└──────────────┘
```

---

## 🔧 **Technical Implementation**

### 1. **Backend API Endpoints**

#### A. `/api/calendar/month` - Get Month Data
```javascript
GET /api/calendar/month?year=2025&month=10

Response:
{
  "success": true,
  "gregorian": {
    "year": 2025,
    "month": 10,
    "monthName": "October",
    "daysInMonth": 31
  },
  "hijri": {
    "year": 1447,
    "month": 4,
    "monthName": "Rabiʻ II",
    "daysInMonth": 30
  },
  "days": [
    {
      "gregorianDate": "2025-10-01",
      "hijriDate": "1447-04-22",
      "dayOfWeek": "Wednesday",
      "prayerTimes": {
        "fajr": "04:55:00",
        "sunrise": "06:12:00",
        "dhuhr": "12:14:00",
        "asr": "15:28:00",
        "maghrib": "18:28:00",
        "isha": "19:58:00"
      },
      "prayerStatus": {
        "fajr": true,
        "dhuhr": false,
        "asr": false,
        "maghrib": false,
        "isha": false
      },
      "islamicEvents": [],
      "moonPhase": "waxing_crescent"
    },
    // ... 30 more days
  ],
  "islamicEvents": [
    {
      "date": "2025-03-01",
      "hijriDate": "1447-09-01",
      "event": "Ramadan Begins",
      "type": "ramadan",
      "importance": "high"
    }
  ]
}
```

#### B. `/api/calendar/prayer-times` - Get 30-Day Prayer Times
```javascript
GET /api/calendar/prayer-times?lat=25.2048&lon=55.2708&days=30

Response:
{
  "success": true,
  "location": {
    "lat": 25.2048,
    "lon": 55.2708,
    "city": "Dubai",
    "timezone": "Asia/Dubai"
  },
  "prayerTimes": [
    {
      "date": "2025-10-14",
      "fajr": "04:58:00",
      "sunrise": "06:15:00",
      "dhuhr": "12:15:00",
      "asr": "15:30:00",
      "maghrib": "18:30:00",
      "isha": "20:00:00"
    },
    // ... 29 more days
  ]
}
```

#### C. `/api/calendar/islamic-events` - Get Islamic Events
```javascript
GET /api/calendar/islamic-events?year=2025

Response:
{
  "success": true,
  "events": [
    {
      "name": "Ramadan",
      "startDate": "2025-03-01",
      "endDate": "2025-03-30",
      "hijriStart": "1447-09-01",
      "hijriEnd": "1447-09-29",
      "type": "ramadan",
      "description": "The holy month of fasting"
    },
    {
      "name": "Eid al-Fitr",
      "date": "2025-03-31",
      "hijriDate": "1447-10-01",
      "type": "eid",
      "description": "Festival of Breaking the Fast"
    },
    {
      "name": "Eid al-Adha",
      "date": "2025-06-07",
      "hijriDate": "1447-12-10",
      "type": "eid",
      "description": "Festival of Sacrifice"
    },
    {
      "name": "Islamic New Year",
      "date": "2025-06-27",
      "hijriDate": "1448-01-01",
      "type": "new_year",
      "description": "First day of Muharram"
    },
    {
      "name": "Ashura",
      "date": "2025-07-06",
      "hijriDate": "1448-01-10",
      "type": "ashura",
      "description": "Day of Ashura"
    },
    {
      "name": "Mawlid al-Nabi",
      "date": "2025-09-04",
      "hijriDate": "1448-03-12",
      "type": "mawlid",
      "description": "Birthday of Prophet Muhammad (PBUH)"
    },
    {
      "name": "Laylat al-Qadr",
      "date": "2025-03-27",
      "hijriDate": "1447-09-27",
      "type": "special_night",
      "description": "Night of Power (estimated)"
    },
    {
      "name": "Laylat al-Miraj",
      "date": "2025-01-27",
      "hijriDate": "1447-07-27",
      "type": "special_night",
      "description": "Night Journey and Ascension"
    }
  ]
}
```

---

### 2. **Frontend Components**

#### A. **Calendar Grid Component**
```javascript
class IslamicCalendar {
  constructor() {
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.selectedDate = null;
    this.prayerTimes = {};
    this.islamicEvents = [];
  }

  // Render calendar grid
  renderCalendar() {
    // Build calendar HTML
    // Show dual dates (Gregorian + Hijri)
    // Highlight today
    // Show prayer times on hover/click
    // Mark Islamic events
  }

  // Navigate months
  nextMonth() { }
  previousMonth() { }
  goToToday() { }

  // Load data
  async loadMonthData() { }
  async loadPrayerTimes() { }
  async loadIslamicEvents() { }
}
```

#### B. **Day Detail Modal**
```javascript
class DayDetailModal {
  show(date) {
    // Show detailed view for selected day:
    // - Full prayer times
    // - Prayer status (prayed/not prayed)
    // - Islamic events
    // - Moon phase
    // - Quick actions (mark as prayed)
  }
}
```

#### C. **Month Selector**
```javascript
class MonthSelector {
  // Dropdown to select month/year
  // Jump to specific date
  // Jump to Islamic months (Ramadan, etc.)
}
```

---

### 3. **Database Models**

#### A. **IslamicEvent Model**
```javascript
const IslamicEventSchema = new mongoose.Schema({
  name: String,
  nameArabic: String,
  type: {
    type: String,
    enum: ['ramadan', 'eid', 'new_year', 'ashura', 'mawlid', 'special_night', 'other']
  },
  hijriDate: {
    year: Number,
    month: Number,
    day: Number
  },
  gregorianDate: Date, // Calculated based on moon sighting
  description: String,
  importance: {
    type: String,
    enum: ['high', 'medium', 'low']
  },
  isRecurring: Boolean, // e.g., Ramadan happens every year
  createdAt: Date,
  updatedAt: Date
});
```

#### B. **CalendarPreferences Model**
```javascript
const CalendarPreferencesSchema = new mongoose.Schema({
  userId: ObjectId,
  defaultView: {
    type: String,
    enum: ['month', 'week', 'day'],
    default: 'month'
  },
  showHijriDates: {
    type: Boolean,
    default: true
  },
  showPrayerTimes: {
    type: Boolean,
    default: true
  },
  showIslamicEvents: {
    type: Boolean,
    default: true
  },
  highlightToday: {
    type: Boolean,
    default: true
  },
  weekStartsOn: {
    type: String,
    enum: ['sunday', 'monday'],
    default: 'sunday'
  }
});
```

---

### 4. **Features**

#### A. **Calendar Navigation**
- ✅ Previous/Next month buttons
- ✅ Jump to today button
- ✅ Month/Year dropdown selector
- ✅ Jump to Islamic months (Ramadan, etc.)
- ✅ Keyboard navigation (arrow keys)

#### B. **Prayer Times Display**
- ✅ Show all 5 daily prayers + sunrise
- ✅ Color-coded by prayer status (prayed/not prayed)
- ✅ Hover to see times
- ✅ Click to see detailed view
- ✅ Quick "Mark as Prayed" button

#### C. **Islamic Events**
- ✅ Ramadan (30 days highlighted)
- ✅ Eid al-Fitr
- ✅ Eid al-Adha
- ✅ Islamic New Year
- ✅ Ashura
- ✅ Mawlid al-Nabi
- ✅ Laylat al-Qadr (Night of Power)
- ✅ Laylat al-Miraj (Night Journey)
- ✅ Custom events (user can add)

#### D. **Hijri Date Conversion**
- ✅ Accurate Hijri calendar
- ✅ Dual date display (Gregorian + Hijri)
- ✅ Moon phase indicator
- ✅ Adjustable for local moon sighting

#### E. **Prayer Tracking Integration**
- ✅ Shows which prayers completed
- ✅ Visual indicators (✅ prayed, ⏳ pending)
- ✅ Statistics per day/week/month
- ✅ Streak tracking on calendar

#### F. **Export & Print**
- ✅ Export to PDF
- ✅ Export to iCal/Google Calendar
- ✅ Print-friendly view
- ✅ Share calendar link

#### G. **Responsive Design**
- ✅ Desktop: Full month view
- ✅ Tablet: Week view option
- ✅ Mobile: Day/list view
- ✅ Touch-friendly navigation

---

## 🎨 **UI/UX Design**

### 1. **Color Scheme**

#### Prayer Status Colors
- **Prayed**: Green (#4CAF50)
- **Not Prayed**: Gray (#9E9E9E)
- **Missed**: Red (#F44336)
- **Current**: Blue (#2196F3)

#### Islamic Event Colors
- **Ramadan**: Purple (#9C27B0)
- **Eid**: Gold (#FFD700)
- **Special Nights**: Dark Blue (#1A237E)
- **Regular Events**: Teal (#009688)

### 2. **Layout**

```
┌────────────────────────────────────────────────────────┐
│  🕌 Islamic Calendar                          [Settings]│
├────────────────────────────────────────────────────────┤
│  [<] October 2025 (Rabiʻ II 1447 AH) [>]    [Today]   │
├────────────────────────────────────────────────────────┤
│  Sun    Mon    Tue    Wed    Thu    Fri    Sat        │
├────────────────────────────────────────────────────────┤
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐          │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │ │ 7 │          │
│  │22 │ │23 │ │24 │ │25 │ │26 │ │27 │ │28 │          │
│  │✅4│ │✅5│ │✅3│ │✅5│ │✅4│ │✅5│ │✅5│          │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘          │
│                                                        │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐          │
│  │ 8 │ │ 9 │ │10 │ │11 │ │12 │ │13 │ │14 │ ← Today  │
│  │29 │ │30 │ │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │          │
│  │✅5│ │✅4│ │⏳0│ │   │ │   │ │   │ │   │          │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘          │
│                                                        │
│  ... (more weeks)                                      │
├────────────────────────────────────────────────────────┤
│  📅 Upcoming Islamic Events:                           │
│  • Ramadan begins: Mar 1, 2025 (Ramadan 1, 1447)     │
│  • Eid al-Fitr: Mar 31, 2025 (Shawwal 1, 1447)       │
│  • Eid al-Adha: Jun 7, 2025 (Dhul Hijjah 10, 1447)   │
└────────────────────────────────────────────────────────┘
```

---

## 📱 **Mobile View**

```
┌──────────────────────┐
│ 🕌 Islamic Calendar  │
├──────────────────────┤
│ [<] Oct 2025 [>]     │
│     Rabiʻ II 1447    │
├──────────────────────┤
│ ┌──────────────────┐ │
│ │ Today - Oct 14   │ │
│ │ Rabiʻ II 23      │ │
│ ├──────────────────┤ │
│ │ 🌅 4:58 AM  ✅   │ │
│ │ 🌄 6:15 AM       │ │
│ │ ☀️ 12:15 PM ✅   │ │
│ │ 🌤️ 3:30 PM  ✅   │ │
│ │ 🌅 6:30 PM  ✅   │ │
│ │ 🌙 8:00 PM  ⏳   │ │
│ └──────────────────┘ │
├──────────────────────┤
│ [List View] [Month]  │
└──────────────────────┘
```

---

## 🔄 **Data Flow**

### 1. **Initial Load**
```
User opens calendar page
    ↓
Load current month data
    ↓
Fetch prayer times (30 days)
    ↓
Fetch Islamic events
    ↓
Fetch prayer logs (user's prayer status)
    ↓
Render calendar
```

### 2. **Month Navigation**
```
User clicks next/previous month
    ↓
Fetch new month data (cached if available)
    ↓
Update prayer times
    ↓
Update Islamic events
    ↓
Re-render calendar
```

### 3. **Day Click**
```
User clicks a day
    ↓
Show day detail modal
    ↓
Display:
  - Full prayer times
  - Prayer status
  - Islamic events
  - Quick actions
```

---

## 📦 **Dependencies**

### Backend
- `moment-hijri` - Hijri date conversion
- `adhan` - Prayer time calculations (already installed)
- `mongoose` - Database models

### Frontend
- `date-fns` or `moment.js` - Date manipulation
- `@fullcalendar/core` (optional) - Calendar UI library
- Or custom calendar implementation

---

## ⏱️ **Implementation Timeline**

### Phase 1: Backend (2-3 hours)
1. ✅ Create API endpoints (1 hour)
2. ✅ Create database models (30 min)
3. ✅ Implement Hijri conversion (30 min)
4. ✅ Add Islamic events data (30 min)
5. ✅ Test APIs (30 min)

### Phase 2: Frontend (3-4 hours)
1. ✅ Create calendar page HTML (30 min)
2. ✅ Build calendar grid component (1 hour)
3. ✅ Add prayer times display (1 hour)
4. ✅ Add Islamic events highlighting (30 min)
5. ✅ Add day detail modal (1 hour)
6. ✅ Add navigation controls (30 min)

### Phase 3: Integration (1-2 hours)
1. ✅ **Connect to EXISTING prayer tracking system** (30 min)
   - Use existing `/api/prayer-log/today` endpoint
   - Use existing `/api/prayer-log/stats` endpoint
   - Display prayer status from existing PrayerLog model
   - Link to profile page for detailed tracking
2. ✅ Add export/print features (30 min)
3. ✅ Mobile responsive design (30 min)
4. ✅ Testing & bug fixes (30 min)

**Total Time**: 6-9 hours

**Note**: We'll use the **existing prayer tracking system** from the profile page, not create a new one!

---

## 🎯 **Success Criteria**

### Must-Have
- [x] Display current month with dual dates
- [x] Show prayer times for each day
- [x] Highlight Islamic events
- [x] Show prayer completion status
- [x] Navigate between months
- [x] Mobile responsive

### Should-Have
- [x] 30-day prayer times ahead
- [x] Day detail modal
- [x] Export to PDF/iCal
- [x] Custom event creation
- [x] Moon phase indicator

### Nice-to-Have
- [ ] Widget for dashboard
- [ ] Share calendar link
- [ ] Sync with Google Calendar
- [ ] Offline mode
- [ ] Multiple calendar views (week, day)

---

## 💡 **Key Features Summary**

1. **Dual Calendar System** - Gregorian + Hijri dates
2. **30-Day Prayer Times** - All prayers for next 30 days
3. **Islamic Events** - Ramadan, Eid, special nights
4. **Prayer Tracking** - Visual indicators of completed prayers
5. **Responsive Design** - Works on all devices
6. **Export/Print** - PDF and iCal export
7. **Accurate Hijri Dates** - Based on calculations + moon sighting
8. **Beautiful UI** - Color-coded, intuitive design

---

## 🚀 **Ready to Start?**

I will build:
1. ✅ Complete backend API (3 endpoints)
2. ✅ Database models (2 models)
3. ✅ Frontend calendar component
4. ✅ Prayer times integration
5. ✅ Islamic events system
6. ✅ Prayer tracking integration
7. ✅ Export/print features
8. ✅ Mobile responsive design

**Estimated Time**: 6-9 hours  
**Result**: Professional Islamic calendar with all features!

---

**Shall I proceed with the implementation?** 🎯

I'll start with:
1. Backend API endpoints
2. Database models
3. Calendar page structure
4. Then build out all features step by step

**Ready when you are!** 🚀

