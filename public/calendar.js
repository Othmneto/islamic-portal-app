/* Production JS for Islamic Calendar (split from preview v3)
   — Keeps your IDs/classes so it plugs into existing code
   — Adds day click → modal (Edit/Delete), occasions modal, OAuth indicators, prayer reminders
*/

// ===== Theme toggle =====
const html = document.documentElement;
document.addEventListener('DOMContentLoaded', () => {
  const darkBtn = document.getElementById('theme-dark');
  const lightBtn = document.getElementById('theme-light');

  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      html.setAttribute('data-theme','dark');
      darkBtn.classList.add('active');
      if (lightBtn) lightBtn.classList.remove('active');
    });
  }
  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      html.setAttribute('data-theme','light');
      lightBtn.classList.add('active');
      if (darkBtn) darkBtn.classList.remove('active');
    });
  }

  // Add event (hook your real modal if available)
  const addEventBtn = document.getElementById('add-event');
  if (addEventBtn) {
    addEventBtn.addEventListener('click', () => {
      // document.getElementById('event-modal')?.classList.add('open');
      alert('Preview only: In integration, open your #event-modal and use your form logic.');
    });
  }
});

// ===== HTTP wrapper (uses your authenticatedFetch if available) =====
const http = typeof authenticatedFetch === 'function' ? authenticatedFetch : (url, options={}) => fetch(url, options);

// ===== Utilities =====
function toDate(x){
  // Accept Date, ms, ISO string, or {date:'YYYY-MM-DD', time:'HH:mm'}
  if (!x) return null;
  try {
    if (x instanceof Date) return x;
    if (typeof x === 'number') return new Date(x);
    if (typeof x === 'object' && x.date) return new Date(`${x.date}${x.time? 'T'+x.time: ''}`);
    return new Date(x);
  } catch { return null; }
}
function isSameDay(a, b){
  return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function monthAnchor(){
  // Derive visible month from label "October 2025"
  const periodLabel = document.getElementById('period-label');
  const label = periodLabel ? periodLabel.textContent.trim() : '';
  const m = new Date(label+' 01');
  return isNaN(+m) ? new Date() : m;
}
function inferDateFromCell(cell){
  // Prefer data-date (YYYY-MM-DD); otherwise compose from period + .g-num
  const ds = cell.getAttribute('data-date');
  if (ds) return new Date(ds);
  const base = monthAnchor();
  const gNumEl = cell.querySelector('.g-num');
  const dayNum = parseInt(gNumEl ? gNumEl.textContent : '1', 10);
  return new Date(base.getFullYear(), base.getMonth(), dayNum);
}

// ===== Events access =====
function getEventsForDate(targetDate, cell){
  // Prefer real data if available
  const list = Array.isArray(window.calendarEvents) ? window.calendarEvents : [];
  if (list.length){
    return list.filter(ev => isSameDay(toDate(ev.startDate || ev.start || ev.begin), targetDate));
  }
  // Fallback: scrape preview DOM
  const out = [];
  if (cell) {
    const eventPills = cell.querySelectorAll('.events .event-pill');
    eventPills.forEach((n,i)=>{
      out.push({ id: n.getAttribute('data-id')||`preview-${i}`, title: n.textContent.trim() });
    });
  }
  return out;
}
function eventId(ev){ return ev.id || ev._id || ev.uuid || ev.key || ev.slug || ''; }
function eventTitle(ev){ return ev.title || ev.name || ev.summary || '(untitled)'; }

// ===== Modal helpers =====
function openModal(id){
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('open');
  m.setAttribute('aria-hidden','false');
}
function closeModal(id){
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  m.setAttribute('aria-hidden','true');
}
// Global close for backdrops and ✕
document.addEventListener('click', (e)=>{
  const closeId = e.target.getAttribute('data-close');
  if (!closeId) return;
  closeModal(closeId+'-modal');
});

// ===== Occasions (country-specific) =====
async function fetchOccasions(countryCode, year){
  try{
    const url = `/api/occasions?country=${encodeURIComponent(countryCode)}&year=${encodeURIComponent(year)}`;
    const res = await http(url, { credentials:'include' });
    if (res && res.ok) return await res.json();
  }catch(_){/* ignore */}
  // Fallback preview set
                return [
    { date: `${year}-12-02`, label: 'UAE National Day', type: 'Public Holiday' },
    { date: `${year}-12-01`, label: 'Commemoration Day', type: 'Public Holiday' },
    { hijri: '1 Shawwal 1447', label: 'Eid al‑Fitr', type: 'Islamic' },
    { hijri: '10 Dhu al‑Hijjah 1447', label: 'Eid al‑Adha', type: 'Islamic' },
    { hijri: '12 Rabiʿ al‑Awwal 1447', label: 'Mawlid an‑Nabi', type: 'Islamic' }
  ];
}
async function renderOccasions(country){
  const yearSelect = document.getElementById('year-select');
  const y = yearSelect ? yearSelect.value : new Date().getFullYear();
  const list = document.getElementById('occasions-list');
  if (!list) return;
  list.innerHTML = '<li><div>Loading…</div><div class="pill">Please wait</div></li>';
  const items = await fetchOccasions(country, y);
  list.innerHTML = '';
  items.forEach(ev => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:700;">${ev.label}</div><div class="meta">${ev.date ? ev.date : ev.hijri} • ${ev.type||''}</div>`;
    const right = document.createElement('div');
    right.innerHTML = '<span class="pill">Add</span>';
    li.append(left,right);
    list.appendChild(li);
  });
}
const countrySelect = document.getElementById('country-select');
if (countrySelect) {
  countrySelect.addEventListener('change', (e)=> renderOccasions(e.target.value));
}

const yearSelect = document.getElementById('year-select');
if (yearSelect) {
  yearSelect.addEventListener('change', ()=> {
    const countrySelectEl = document.getElementById('country-select');
    renderOccasions(countrySelectEl ? countrySelectEl.value : 'AE');
  });
}

[document.getElementById('open-occasions'), document.getElementById('quick-occasions')]
  .filter(Boolean)
  .forEach(btn => btn.addEventListener('click', async ()=> {
    const countrySelectEl = document.getElementById('country-select');
    await renderOccasions(countrySelectEl ? countrySelectEl.value : 'AE');
    openModal('occasions-modal');
  }));

const addOccasionsBtn = document.getElementById('add-occasions-to-calendar');
if (addOccasionsBtn) {
  addOccasionsBtn.addEventListener('click', ()=>{
    alert('Preview: would add selected occasions to your calendar and re-render.');
  });
}

// ===== OAuth indicators =====
function setOAuthStatus({google, microsoft, googleEmail, msEmail}){
  const g = document.getElementById('oauth-google-status');
  const m = document.getElementById('oauth-microsoft-status');
  if (g) { g.classList.toggle('connected', !!google); g.classList.toggle('disconnected', !google); g.title = google ? `Google connected${googleEmail? ' • '+googleEmail:''}` : 'Google not connected'; }
  if (m) { m.classList.toggle('connected', !!microsoft); m.classList.toggle('disconnected', !microsoft); m.title = microsoft ? `Microsoft connected${msEmail? ' • '+msEmail:''}` : 'Microsoft not connected'; }
}
async function refreshOAuthStatus(){
  try {
    const res = await http('/api/auth/status', { credentials:'include' });
    if (res && res.ok) { setOAuthStatus(await res.json()); return; }
  } catch(_){/* ignore */}
  setOAuthStatus({ google:false, microsoft:false });
}
refreshOAuthStatus();

// ===== Prayer email reminders =====
const saveRemindersBtn = document.getElementById('save-reminders');
if (saveRemindersBtn) {
  saveRemindersBtn.addEventListener('click', async ()=>{
    const chosen = ['fajr','sunrise','dhuhr','asr','maghrib','isha'].filter(k => {
      const checkbox = document.getElementById('rem-'+k);
      return checkbox ? checkbox.checked : false;
    });
    const emailEl = document.getElementById('rem-email');
    const email = emailEl ? emailEl.value : '';
    const offsetEl = document.getElementById('rem-offset');
    const offset = offsetEl ? offsetEl.value : '0';
    const payload = { prayers: chosen, offset: Number(offset), email };
    const status = document.getElementById('rem-status');
    try {
      const res = await http('/api/prayer-reminders', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload), credentials:'include' });
      if (status) {
        status.textContent = res && res.ok ? `Saved: ${chosen.join(', ')} (offset ${offset}) → ${email}` : 'Failed to save (server error)';
      }
    } catch(_){ 
      if (status) status.textContent = 'Failed to save (network error)'; 
    }
  });
}

// ===== Day modal (open on day click) =====
const dayList = document.getElementById('day-events-list');
const dayTitle = document.getElementById('day-title');
let lastClickedDate = null;

// Open modal when any .day cell in #month-grid is clicked
const monthGrid = document.getElementById('month-grid');
if (monthGrid) {
  monthGrid.addEventListener('click', (e) => {
  const cell = e.target.closest('.day');
  if (!cell) return;
  const date = inferDateFromCell(cell);
  lastClickedDate = date;

  // Title formatting
  try {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' });
    if (dayTitle) dayTitle.textContent = `Events on ${fmt.format(date)}`;
  } catch { if (dayTitle) dayTitle.textContent = `Events on ${date.toDateString()}`; }

  // List events for that day
  if (dayList){
    dayList.innerHTML = '';
    const events = getEventsForDate(date, cell);
    if (!events.length){
      const li = document.createElement('li');
      li.innerHTML = '<div>No events for this day.</div>';
      dayList.appendChild(li);
    } else {
      events.forEach(ev => {
        const id = eventId(ev);
        const li = document.createElement('li');
        li.innerHTML = `
          <div>
            <div style="font-weight:700;">${eventTitle(ev)}</div>
            <div class="meta">ID: ${id}</div>
            </div>
          <div>
            <button class="btn ghost small" data-action="edit" data-id="${id}">Edit</button>
            <button class="btn ghost small danger" data-action="delete" data-id="${id}">Delete</button>
            </div>`;
        dayList.appendChild(li);
      });
    }
  }
  openModal('day-modal');
  });
}

// Edit/Delete inside the modal
if (dayList) {
  dayList.addEventListener('click', async (e)=>{
  const action = e.target.getAttribute('data-action');
  const id = e.target.getAttribute('data-id');
  if (!action || !id) return;

  if (action === 'edit'){
    if (typeof openEventModalWith === 'function') openEventModalWith(id);
    else alert('Edit event ' + id);
            return;
        }
        
  if (action === 'delete'){
    const yes = confirm('Delete this event?');
    if (!yes) return;
    try{
      if (typeof deleteCalendarEvent === 'function'){
        await deleteCalendarEvent(id);
      } else if (Array.isArray(window.calendarEvents)){
        window.calendarEvents = window.calendarEvents.filter(e => (e.id||e._id||e.uuid) !== id);
      }
      if (typeof renderCalendarEnhanced === 'function') renderCalendarEnhanced();
    }catch(err){ console.error('Delete failed', err); }

    // Refresh the list after delete
    if (lastClickedDate){
      const refreshed = getEventsForDate(lastClickedDate);
      dayList.innerHTML = '';
      if (!refreshed.length){
        const li = document.createElement('li');
        li.textContent = 'No events for this day.';
        dayList.appendChild(li);
        } else {
        refreshed.forEach(ev => {
          const li = document.createElement('li');
          const id2 = eventId(ev);
          li.innerHTML = `
            <div>
              <div style="font-weight:700;">${eventTitle(ev)}</div>
              <div class="meta">ID: ${id2}</div>
            </div>
            <div>
              <button class="btn ghost small" data-action="edit" data-id="${id2}">Edit</button>
              <button class="btn ghost small danger" data-action="delete" data-id="${id2}">Delete</button>
            </div>`;
          dayList.appendChild(li);
        });
      }
    }
  }
  });
}

// Create new event for selected date (prefill)
const createEventBtn = document.getElementById('create-event-on-day');
if (createEventBtn) {
  createEventBtn.addEventListener('click', ()=>{
    if (typeof openEventModalWith === 'function') {
      // Extend your function to accept an object with date when creating
      openEventModalWith({ date: lastClickedDate });
    } else {
      const dateStr = lastClickedDate ? lastClickedDate.toDateString() : 'selected date';
      alert('Preview: would open create-event dialog for ' + dateStr);
    }
  });
}

// ===== Optional: "Today" panel & prayer times hooks =====
function setTodayPanel(){
  try {
        const now = new Date();
    const fmt = new Intl.DateTimeFormat(undefined, { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
    const todayLabel = document.getElementById('today-label');
    if (todayLabel) todayLabel.textContent = fmt.format(now);
        } catch {}
  const list = document.getElementById('today-list');
  if (!list) return;
  list.innerHTML = '';
  const items = (window.calendarEvents||[]).filter(ev => isSameDay(toDate(ev.startDate||ev.start), new Date()));
  items.slice(0,5).forEach(ev => {
    const d = toDate(ev.startDate||ev.start);
    const time = d ? String(d).slice(16,21) : '--:--';
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `<div class="time">${time}</div><div><div style="font-weight:700;">${eventTitle(ev)}</div><div class="meta"><span>${ev.category||''}</span></div></div>`;
    list.appendChild(row);
  });
}
async function refreshPrayerTimes(){ /* hook your endpoint here if available */ }
setTodayPanel();