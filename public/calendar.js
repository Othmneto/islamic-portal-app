// ==========================
// Script #1 — Theme & Toolbar Demos
// ==========================
// Cache the <html> element for theme toggling.
const html = document.documentElement;

// Toggle to dark theme.
document.getElementById('theme-dark').addEventListener('click', () => {
  html.setAttribute('data-theme','dark');
  document.getElementById('theme-dark').classList.add('active');
  document.getElementById('theme-light').classList.remove('active');
});

// Toggle to light theme.
document.getElementById('theme-light').addEventListener('click', () => {
  html.setAttribute('data-theme','light');
  document.getElementById('theme-light').classList.add('active');
  document.getElementById('theme-dark').classList.remove('active');
});

// Demo — open your existing event modal in integration.
document.getElementById('add-event').addEventListener('click', () => {
  // In your app: document.getElementById('event-modal').classList.add('open')
  alert('Preview only: In integration, open #event-modal and use your form logic.');
});

// ==========================
// Script #2 — Integration helpers + Modals, Occasions, OAuth, Day Modal, Reminders
// ==========================

/* ==========================
   Integration helpers — use your real data if present
   ========================== */

// Prefer your existing authenticatedFetch() if defined; otherwise fall back to window.fetch
const http = typeof authenticatedFetch === 'function' ? authenticatedFetch : (url, options={}) => fetch(url, options);

// Utility: parse a date coming from different event shapes (Date, ISO string, millis)
function toDate(x){
  if (!x) return null;
  try {
    if (x instanceof Date) return x;
    if (typeof x === 'number') return new Date(x);
    // Some codebases store {date: 'YYYY-MM-DD', time: 'HH:mm'}
    if (typeof x === 'object' && x.date) return new Date(`${x.date}${x.time? 'T'+x.time: ''}`);
    return new Date(x);
  } catch { return null; }
}

// Compare only Y/M/D (ignore time)
function isSameDay(a, b){
  return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

// Get events for a specific day from your real state (window.calendarEvents) if available,
// otherwise falls back to reading pills inside the clicked cell.
function getEventsForDate(targetDate, cell){
  const out = [];
  const list = Array.isArray(window.calendarEvents) ? window.calendarEvents : [];
  if (list.length){
    for (const ev of list){
      const start = toDate(ev.startDate || ev.start);
      if (isSameDay(start, targetDate)) out.push(ev);
    }
    return out;
  }
  // Fallback: scrape DOM pills (preview mode)
  cell?.querySelectorAll('.events .event-pill')?.forEach((n,i)=>{
    out.push({ id: n.getAttribute('data-id')||`preview-${i}`, title: n.textContent.trim() });
  });
  return out;
}

// Render a list item row for the Day modal, using your real events format when possible
function renderDayRow(ev){
  const id = ev.id || ev._id || ev.uuid || 'unknown';
  const title = ev.title || ev.name || '(untitled)';
  const li = document.createElement('li');
  li.innerHTML = `
    <div>
      <div style="font-weight:700;">${title}</div>
      <div class="meta">ID: ${id}</div>
    </div>
    <div>
      <button class="btn ghost small" data-action="edit" data-id="${id}">Edit</button>
      <button class="btn ghost small danger" data-action="delete" data-id="${id}">Delete</button>
    </div>`;
  return li;
}

// Optional hooks into your existing UI if present
function openEditorForEvent(id){
  // If your app exposes a helper, use it
  if (typeof openEventModalWith === 'function') return openEventModalWith(id);
  // Else, emit a custom event your code can listen for
  window.dispatchEvent(new CustomEvent('calendar:edit', { detail: { id } }));
}
async function deleteEventById(id){
  try {
    if (typeof deleteCalendarEvent === 'function') {
      await deleteCalendarEvent(id); // your function cleans state + persists
    } else if (Array.isArray(window.calendarEvents)) {
      // local state mutation fallback
      window.calendarEvents = window.calendarEvents.filter(e => (e.id||e._id||e.uuid) !== id);
    }
    if (typeof renderCalendarEnhanced === 'function') renderCalendarEnhanced();
  } catch(err){ console.error('Delete failed', err); }
}

// Read current visible month/year from #period-label (e.g., "October 2025")
function monthAnchor(){
  const label = document.getElementById('period-label')?.textContent?.trim()||'';
  const m = new Date(label+' 01');
  return isNaN(+m) ? new Date() : m;
}

// Infer the clicked date from data-date attribute first, else parse using period label + day number
function inferDateFromCell(cell){
  const ds = cell.getAttribute('data-date');
  if (ds) return new Date(ds);
  const base = monthAnchor();
  const dayNum = parseInt(cell.querySelector('.g-num')?.textContent||'1',10);
  const d = new Date(base.getFullYear(), base.getMonth(), dayNum);
  return d;
}

/* ==========================
   Modal utilities (open/close)
   ========================== */
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('open');
  m.setAttribute('aria-hidden','false');
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  m.setAttribute('aria-hidden','true');
}

// Close when clicking backdrop or ✕ buttons (they carry data-close="<name>")
document.addEventListener('click', (e)=>{
  const closeId = e.target.getAttribute('data-close');
  if (!closeId) return;
  closeModal(closeId+'-modal');
});

/* ==========================
   Occasions (country-specific)
   ========================== */
async function fetchOccasions(countryCode, year){
  try {
    // If your backend exists, use it; otherwise fall back to preview data
    const url = `/api/occasions?country=${encodeURIComponent(countryCode)}&year=${encodeURIComponent(year)}`;
    const res = await http(url, { credentials:'include' });
    if (res && res.ok) return await res.json();
  } catch(e){ /* ignore and fall back */ }
  // Fallback preview
  const fallback = {
    AE: [
      { date: `${year}-12-02`, label: 'UAE National Day', type: 'Public Holiday' },
      { date: `${year}-12-01`, label: 'Commemoration Day', type: 'Public Holiday' },
      { hijri: '1 Shawwal 1447', label: 'Eid al‑Fitr', type: 'Islamic' },
      { hijri: '10 Dhu al‑Hijjah 1447', label: 'Eid al‑Adha', type: 'Islamic' },
      { hijri: '12 Rabiʿ al‑Awwal 1447', label: 'Mawlid an‑Nabi', type: 'Islamic' }
    ]
  };
  return fallback[countryCode] || [];
}

async function renderOccasions(country){
  const y = document.getElementById('year-select')?.value || new Date().getFullYear();
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

document.getElementById('country-select')?.addEventListener('change', (e)=> renderOccasions(e.target.value));
document.getElementById('year-select')?.addEventListener('change', ()=> renderOccasions(document.getElementById('country-select')?.value||'AE'));

[document.getElementById('open-occasions'), document.getElementById('quick-occasions')]
  .filter(Boolean)
  .forEach(btn => btn.addEventListener('click', async ()=> {
    await renderOccasions(document.getElementById('country-select')?.value||'AE');
    openModal('occasions-modal');
  }));

document.getElementById('add-occasions-to-calendar')?.addEventListener('click', async ()=>{
  // In your app: transform currently rendered occasions into calendarEvents
  alert('Preview: would add selected occasions to your calendar and re-render.');
});

/* ==========================
   OAuth indicators — live status
   ========================== */
function setOAuthStatus({google, microsoft, googleEmail, msEmail}){
  const g = document.getElementById('oauth-google-status');
  const m = document.getElementById('oauth-microsoft-status');
  if (g) { g.classList.toggle('connected', !!google); g.classList.toggle('disconnected', !google); g.title = google ? `Google connected${googleEmail? ' • '+googleEmail:''}` : 'Google not connected'; }
  if (m) { m.classList.toggle('connected', !!microsoft); m.classList.toggle('disconnected', !microsoft); m.title = microsoft ? `Microsoft connected${msEmail? ' • '+msEmail:''}` : 'Microsoft not connected'; }
}

async function refreshOAuthStatus(){
  try {
    const res = await http('/api/auth/status', { credentials:'include' });
    if (res && res.ok) {
      const data = await res.json();
      setOAuthStatus(data);
      return;
    }
  } catch(e){ /* ignore */ }
  // Fallback: disconnected state
  setOAuthStatus({ google:false, microsoft:false });
}
refreshOAuthStatus();

/* ==========================
   Prayer email reminders — save via API if available
   ========================== */
document.getElementById('save-reminders')?.addEventListener('click', async ()=>{
  const chosen = ['fajr','sunrise','dhuhr','asr','maghrib','isha'].filter(k => document.getElementById('rem-'+k)?.checked);
  const email = document.getElementById('rem-email')?.value || '';
  const offset = document.getElementById('rem-offset')?.value || '0';
  const payload = { prayers: chosen, offset: Number(offset), email };
  const status = document.getElementById('rem-status');
  try {
    const res = await http('/api/prayer-reminders', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload), credentials:'include' });
    if (res && res.ok){
      status.textContent = `Saved: ${chosen.join(', ')} (offset ${offset}) → ${email}`;
    } else {
      status.textContent = 'Failed to save (server error)';
    }
  } catch(err){ status.textContent = 'Failed to save (network error)'; }
});

/* ==========================
   Day modal — open on day click with REAL events when available
   ========================== */
const dayList = document.getElementById('day-events-list');
const dayTitle = document.getElementById('day-title');

document.getElementById('month-grid')?.addEventListener('click', (e) => {
  const cell = e.target.closest('.day');
  if (!cell) return;
  const date = inferDateFromCell(cell);

  // Update modal title with readable date
  try {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' });
    if (dayTitle) dayTitle.textContent = `Events on ${fmt.format(date)}`;
  } catch { dayTitle.textContent = `Events on ${date.toDateString()}`; }

  // Populate list
  if (dayList){
    dayList.innerHTML = '';
    const events = getEventsForDate(date, cell);
    if (!events.length){
      const li = document.createElement('li');
      li.innerHTML = '<div>No events for this day.</div>';
      dayList.appendChild(li);
    } else {
      events.forEach(ev => dayList.appendChild(renderDayRow(ev)));
    }
  }
  // Open modal after content ready
  openModal('day-modal');
});

// Edit / Delete actions
dayList?.addEventListener('click', (e)=>{
  const action = e.target.getAttribute('data-action');
  const id = e.target.getAttribute('data-id');
  if (!action || !id) return;
  if (action === 'edit') return openEditorForEvent(id);
  if (action === 'delete') return deleteEventById(id);
});

// ==========================
// Additional Calendar Navigation & Today Button
// ==========================

// Today button functionality
document.getElementById('go-today')?.addEventListener('click', (e) => {
  e.preventDefault();
  // Scroll to today or refresh calendar view
  const today = new Date();
  const todayElement = document.querySelector(`[data-date="${today.toISOString().split('T')[0]}"]`);
  if (todayElement) {
    todayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    todayElement.focus();
  }
});

// Navigation buttons
document.getElementById('prev-button')?.addEventListener('click', () => {
  // Previous month/week/day logic
  console.log('Previous period clicked');
});

document.getElementById('next-button')?.addEventListener('click', () => {
  // Next month/week/day logic
  console.log('Next period clicked');
});

// View toggle buttons
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active class from all view buttons
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    // Add active class to clicked button
    btn.classList.add('active');
    console.log('View changed to:', btn.dataset.view);
  });
});

// Calendar type selector
document.getElementById('calendarType')?.addEventListener('change', (e) => {
  console.log('Calendar type changed to:', e.target.value);
});

// Prayer reminders modal
document.getElementById('open-reminders')?.addEventListener('click', () => {
  openModal('reminders-modal');
});

// Quick reminders button
document.getElementById('quick-reminders')?.addEventListener('click', () => {
  openModal('reminders-modal');
});

// Create event on day button
document.getElementById('create-event-on-day')?.addEventListener('click', () => {
  console.log('Create event on selected day');
  // Close day modal and open event creation modal
  closeModal('day-modal');
  // In integration: open your event creation modal
  alert('In integration: open event creation modal for selected day');
});

console.log('🎉 Islamic Calendar Modern UI/UX loaded successfully!');