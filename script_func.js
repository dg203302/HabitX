// =========================================
//  HabitX – Core Logic v2
// =========================================

// ─────────────────────────────────────────
//  DATA LAYER  (localStorage)
// ─────────────────────────────────────────
const STORE_EVENTS = 'habitx_events';
const STORE_LOGS   = 'habitx_logs';

function getEvents() {
  return JSON.parse(localStorage.getItem(STORE_EVENTS) || '[]');
}

function saveEvents(events) {
  localStorage.setItem(STORE_EVENTS, JSON.stringify(events));
}

function getLogs() {
  return JSON.parse(localStorage.getItem(STORE_LOGS) || '[]');
}

function saveLogs(logs) {
  localStorage.setItem(STORE_LOGS, JSON.stringify(logs));
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function isLoggedToday(eventId) {
  return getLogs().some(l => l.eventId === eventId && l.date === getTodayStr());
}

function toggleLog(eventId) {
  const logs  = getLogs();
  const today = getTodayStr();
  const idx   = logs.findIndex(l => l.eventId === eventId && l.date === today);
  if (idx >= 0) {
    logs.splice(idx, 1);
    saveLogs(logs);
    return false; // unregistered
  } else {
    logs.push({ eventId, date: today, ts: Date.now() });
    saveLogs(logs);
    return true; // registered
  }
}

function getEventLogs(eventId) {
  return getLogs()
    .filter(l => l.eventId === eventId)
    .sort((a, b) => b.ts - a.ts);
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Seed with sample data only on first run
function seedIfEmpty() {
  if (getEvents().length === 0) {
    const seed = [
      { id: genId(), emoji: '🧘', name: 'Meditación',   desc: 'Meditar al menos 10 min cada mañana', createdAt: Date.now() },
      { id: genId(), emoji: '🏃', name: 'Ejercicio',     desc: 'Salir a correr o hacer 30 min de actividad', createdAt: Date.now() },
      { id: genId(), emoji: '📚', name: 'Lectura',       desc: 'Leer al menos 20 páginas antes de dormir', createdAt: Date.now() },
    ];
    saveEvents(seed);
  }
}

seedIfEmpty();

// ─────────────────────────────────────────
//  SECTION NAVIGATION
// ─────────────────────────────────────────
const navBtns  = document.querySelectorAll('.nav-btn[data-section]');
const sections = document.querySelectorAll('.section');

function navigateTo(sectionId) {
  sections.forEach(s => s.classList.remove('active'));
  navBtns.forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });

  // Drive CSS header-hide via data attribute on body
  document.body.dataset.section = sectionId;

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active');
    // restart animation
    target.style.animation = 'none';
    target.offsetHeight;
    target.style.animation = '';
  }

  const btn = document.querySelector(`.nav-btn[data-section="${sectionId}"]`);
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-current', 'page'); }

  // Update header title & subtitle
  const headerTitles = {
    Home:   { title: 'Mis Eventos',    subtitle: 'Registrá tu progreso de hoy' },
    Add:    { title: 'Nuevo Evento',   subtitle: 'Definí qué querés trackear' },
    Config: { title: 'Configuración', subtitle: 'Personalizá tu experiencia' },
  };
  const info = headerTitles[sectionId];
  if (info) {
    const titleEl    = document.getElementById('header-title');
    const subtitleEl = document.getElementById('header-subtitle');
    if (titleEl)    titleEl.textContent    = info.title;
    if (subtitleEl) subtitleEl.textContent = info.subtitle;
  }

  // Refresh home on every visit
  if (sectionId === 'Home') renderEvents();
  // Refresh add-cal on every visit to Add
  if (sectionId === 'Add') { if (typeof renderAddCal === 'function') renderAddCal(); }
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  btn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateTo(btn.dataset.section); }
  });
});

// ─────────────────────────────────────────
//  HEADER DATE
// ─────────────────────────────────────────
function updateHeaderDate() {
  const el = document.getElementById('header-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}
updateHeaderDate();

// ─────────────────────────────────────────
//  RENDER HOME – EVENT LIST
// ─────────────────────────────────────────
function renderEvents() {
  const list   = document.getElementById('events-list');
  const events = getEvents();

  list.innerHTML = '';

  if (events.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌱</div>
        <div class="empty-title">No tenés eventos aún</div>
        <div class="empty-sub">Creá tu primer evento para empezar a trackear tus hábitos</div>
        <button class="empty-cta" id="empty-cta-btn">+ Crear evento</button>
      </div>`;
    document.getElementById('empty-cta-btn')
      ?.addEventListener('click', () => navigateTo('Add'));
    updateProgress(0, 0);
    return;
  }

  events.forEach(ev => {
    const logged = isLoggedToday(ev.id);
    const card = document.createElement('div');
    card.className = `event-card${logged ? ' registered' : ''}`;
    card.dataset.id = ev.id;

    card.innerHTML = `
      <div class="event-emoji-wrap">${ev.emoji || '✨'}</div>
      <div class="event-info">
        <span class="event-name">${escHtml(ev.name)}</span>
        <span class="event-desc">${escHtml(ev.desc || '')}</span>
        <div class="event-status">
          <span class="status-dot"></span>
          <span class="status-text">${logged ? 'Registrado hoy ✓' : 'Sin registrar hoy'}</span>
        </div>
      </div>
      <div class="event-actions">
        <button
          class="btn-register${logged ? ' registered-btn' : ''}"
          aria-label="${logged ? 'Quitar registro de hoy' : 'Registrar hoy'}"
          data-id="${ev.id}"
          title="${logged ? 'Quitar registro' : 'Registrar hoy'}"
        >
          ${logged
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                 <polyline points="20 6 9 17 4 12"/>
               </svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                 <line x1="12" y1="5" x2="12" y2="19"/>
                 <line x1="5" y1="12" x2="19" y2="12"/>
               </svg>`
          }
        </button>
        <button
          class="btn-cfg"
          aria-label="Detalles de ${escHtml(ev.name)}"
          data-id="${ev.id}"
          title="Ver detalles"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="2.5"/>
            <circle cx="19" cy="12" r="2.5"/>
            <circle cx="5" cy="12" r="2.5"/>
          </svg>
        </button>
      </div>`;

    // Register button
    card.querySelector('.btn-register').addEventListener('click', () => {
      const nowLogged = toggleLog(ev.id);
      renderEvents(); // full re-render keeps it simple & consistent
    });

    // Details button
    card.querySelector('.btn-cfg').addEventListener('click', () => {
      openDetailsModal(ev.id);
    });

    list.appendChild(card);
  });

  // Progress bar
  const total  = events.length;
  const done   = events.filter(ev => isLoggedToday(ev.id)).length;
  updateProgress(done, total);
}

function updateProgress(done, total) {
  const bar = document.getElementById('progress-bar');
  const val = document.getElementById('progress-value');
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  if (bar) bar.style.width = pct + '%';
  if (val) val.textContent = `${done} / ${total}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────
//  DETAILS MODAL
// ─────────────────────────────────────────
const detailsModal    = document.getElementById('event-details-modal');
const detailsEmoji    = document.getElementById('details-emoji');
const detailsName     = document.getElementById('details-name');
const detailsDesc     = document.getElementById('details-desc');
let activeDetailsId   = null;

function openDetailsModal(eventId) {
  const events = getEvents();
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;

  activeDetailsId = eventId;
  detailsEmoji.textContent = ev.emoji || '✨';
  detailsName.textContent  = ev.name;
  detailsDesc.textContent  = ev.desc || 'Sin descripción';

  detailsModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
  detailsModal.hidden = true;
  document.body.style.overflow = '';
}

document.getElementById('event-details-close').addEventListener('click', closeDetailsModal);
detailsModal.addEventListener('click', e => { if (e.target === detailsModal) closeDetailsModal(); });

document.getElementById('details-edit-btn').addEventListener('click', () => {
  closeDetailsModal();
  openConfigModal(activeDetailsId);
});

document.getElementById('details-history-btn').addEventListener('click', () => {
  closeDetailsModal();
  openHistoryModal(activeDetailsId);
});

document.getElementById('details-delete-btn').addEventListener('click', async () => {
  const eventId = activeDetailsId;
  const ok = await showConfirm({
    icon:        '🗑️',
    title:       'Eliminar evento',
    message:     'Se borrarán todos los registros de este evento. Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
  });
  if (!ok) return;
  const events = getEvents().filter(e => e.id !== eventId);
  saveEvents(events);
  const logs = getLogs().filter(l => l.eventId !== eventId);
  saveLogs(logs);
  closeDetailsModal();
  renderEvents();
});

// ─────────────────────────────────────────
//  CONFIG MODAL
// ─────────────────────────────────────────
const configModal    = document.getElementById('event-config-modal');
const cfgNameInput   = document.getElementById('cfg-name-input');
const cfgDescInput   = document.getElementById('cfg-desc-input');
const cfgEmojiDisp   = document.getElementById('cfg-emoji-display');
const cfgPickerWrap  = document.getElementById('cfg-emoji-picker-wrapper');
const cfgPicker      = document.getElementById('cfg-emoji-picker');

let activeConfigId   = null;
let cfgSelectedEmoji = '✨';

function openConfigModal(eventId) {
  const events = getEvents();
  const ev = events.find(e => e.id === eventId);
  if (!ev) return;

  activeConfigId       = eventId;
  cfgSelectedEmoji     = ev.emoji || '✨';
  cfgEmojiDisp.textContent = cfgSelectedEmoji;
  cfgNameInput.value   = ev.name;
  cfgDescInput.value   = ev.desc || '';

  // Hide emoji picker
  cfgPickerWrap.hidden = true;

  configModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeConfigModal() {
  configModal.hidden = true;
  document.body.style.overflow = '';
  activeConfigId = null;
  cfgPickerWrap.hidden = true;
}

// Toggle emoji picker (config modal)
document.getElementById('cfg-emoji-trigger').addEventListener('click', () => {
  cfgPickerWrap.hidden = !cfgPickerWrap.hidden;
});

cfgPicker?.addEventListener('emoji-click', e => {
  cfgSelectedEmoji = e.detail.unicode;
  cfgEmojiDisp.textContent = cfgSelectedEmoji;
  cfgPickerWrap.hidden = true;
});

// Save
document.getElementById('cfg-save-btn').addEventListener('click', () => {
  const name = cfgNameInput.value.trim();
  if (!name) { cfgNameInput.focus(); cfgNameInput.classList.add('shake'); setTimeout(()=>cfgNameInput.classList.remove('shake'),400); return; }

  const events = getEvents();
  const idx = events.findIndex(e => e.id === activeConfigId);
  if (idx >= 0) {
    events[idx].emoji = cfgSelectedEmoji;
    events[idx].name  = name;
    events[idx].desc  = cfgDescInput.value.trim();
    saveEvents(events);
  }
  closeConfigModal();
  renderEvents();
});

// Back & Close
function closeConfigAndBack() {
  const currentId = activeConfigId;
  closeConfigModal();
  if (currentId) {
    openDetailsModal(currentId);
  }
}

document.getElementById('event-config-back').addEventListener('click', closeConfigAndBack);
document.getElementById('event-config-close').addEventListener('click', closeConfigModal);
configModal.addEventListener('click', e => { if (e.target === configModal) closeConfigModal(); });

// ─────────────────────────────────────────
//  HISTORY MODAL
// ─────────────────────────────────────────
const historyModal  = document.getElementById('history-modal');
let historyEventId  = null; // track which event is open in history

function renderHistoryContent(eventId) {
  const events = getEvents();
  const ev     = events.find(e => e.id === eventId);
  if (!ev) return;

  document.getElementById('history-title').textContent = `${ev.emoji} ${ev.name}`;

  const logs   = getEventLogs(eventId);
  const streak = calcStreak(logs);

  // Stats
  document.getElementById('history-stats').innerHTML = `
    <div class="history-stat-card">
      <div class="history-stat-value">${logs.length}</div>
      <div class="history-stat-label">Total</div>
    </div>
    <div class="history-stat-card">
      <div class="history-stat-value">${streak}</div>
      <div class="history-stat-label">Racha actual</div>
    </div>
    <div class="history-stat-card">
      <div class="history-stat-value">${logs.length > 0 ? calcMaxStreak(logs) : 0}</div>
      <div class="history-stat-label">Racha máxima</div>
    </div>`;

  // Log list
  const listEl = document.getElementById('history-list');
  if (logs.length === 0) {
    listEl.innerHTML = '<div class="history-empty">Sin registros todavía 📭</div>';
  } else {
    listEl.innerHTML = logs.map(log => {
      const d   = new Date(log.date + 'T12:00:00');
      const fmt = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const rel = relativeTime(d);
      return `<div class="history-item">
        <div class="history-item-dot"></div>
        <div class="history-item-date">${fmt}</div>
        <div class="history-item-rel">${rel}</div>
      </div>`;
    }).join('');
  }
}

function openHistoryModal(eventId) {
  historyEventId = eventId;
  renderHistoryContent(eventId);

  // Reset history calendar to current month
  histCalYear  = new Date().getFullYear();
  histCalMonth = new Date().getMonth();

  // Hide config, show history
  configModal.hidden    = true;
  historyModal.hidden   = false;
  document.body.style.overflow = 'hidden';

  // Render the per-event calendar
  renderHistCal();
}

function closeHistoryModal() {
  historyModal.hidden = true;
  document.body.style.overflow = '';
}

function closeHistoryAndBack() {
  historyModal.hidden = true;
  if (historyEventId) {
    openDetailsModal(historyEventId);
  } else {
    document.body.style.overflow = '';
  }
}

document.getElementById('history-back').addEventListener('click', closeHistoryAndBack);
document.getElementById('history-close').addEventListener('click', () => { closeHistoryModal(); });
historyModal.addEventListener('click', e => { if (e.target === historyModal) { closeHistoryModal(); } });

// ─────────────────────────────────────────
//  HISTORY CALENDAR – per-event toggle
// ─────────────────────────────────────────
let histCalYear  = new Date().getFullYear();
let histCalMonth = new Date().getMonth();

function renderHistCal() {
  const grid  = document.getElementById('hist-cal-grid');
  const label = document.getElementById('hist-cal-month-label');
  if (!grid || !label || !historyEventId) return;

  const today = getTodayStr();
  const logs  = getLogs();
  const eventLogs = new Set(logs.filter(l => l.eventId === historyEventId).map(l => l.date));

  const monthDate = new Date(histCalYear, histCalMonth, 1);
  label.textContent = monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  const firstDay    = new Date(histCalYear, histCalMonth, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(histCalYear, histCalMonth + 1, 0).getDate();

  grid.innerHTML = '';

  for (let i = 0; i < startOffset; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${histCalYear}-${String(histCalMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const logged  = eventLogs.has(dateStr);
    const isFuture = dateStr > today;

    const cell = document.createElement('div');
    cell.className = 'cal-day' +
      (dateStr === today ? ' today' : '') +
      (logged ? ' hist-logged' : '') +
      (isFuture ? ' cal-future' : '');
    cell.dataset.date = dateStr;

    const num = document.createElement('div');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    if (logged) {
      const dot = document.createElement('div');
      dot.className = 'cal-dots';
      dot.innerHTML = '<div class="cal-dot"></div>';
      cell.appendChild(dot);
    }

    if (!isFuture) {
      cell.addEventListener('click', () => toggleHistCalDay(dateStr));
    }
    grid.appendChild(cell);
  }
}

function toggleHistCalDay(dateStr) {
  const logs   = getLogs();
  const idx    = logs.findIndex(l => l.eventId === historyEventId && l.date === dateStr);
  const fb     = document.getElementById('hist-cal-feedback');
  const [y,m,d] = dateStr.split('-').map(Number);
  const date   = new Date(y, m-1, d);
  const fmt    = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

  if (idx >= 0) {
    logs.splice(idx, 1);
    saveLogs(logs);
    if (fb) { fb.textContent = `✕ Registro del ${fmt} eliminado`; fb.className = 'hist-cal-feedback error'; fb.hidden = false; }
  } else {
    logs.push({ eventId: historyEventId, date: dateStr, ts: new Date(dateStr + 'T12:00:00').getTime() });
    saveLogs(logs);
    if (fb) { fb.textContent = `✓ Registro agregado para el ${fmt}`; fb.className = 'hist-cal-feedback success'; fb.hidden = false; }
  }
  if (fb) setTimeout(() => { fb.hidden = true; }, 2000);

  renderHistCal();
  renderHistoryContent(historyEventId);
  renderEvents(); // keep home in sync
}

document.getElementById('hist-cal-prev')?.addEventListener('click', () => {
  histCalMonth--;
  if (histCalMonth < 0) { histCalMonth = 11; histCalYear--; }
  renderHistCal();
});
document.getElementById('hist-cal-next')?.addEventListener('click', () => {
  histCalMonth++;
  if (histCalMonth > 11) { histCalMonth = 0; histCalYear++; }
  renderHistCal();
});


// ─────────────────────────────────────────
//  HELPERS – Streak & Time
// ─────────────────────────────────────────
function calcStreak(logs) {
  if (!logs.length) return 0;
  const dates = [...new Set(logs.map(l => l.date))].sort((a,b) => b.localeCompare(a));
  let streak = 0;
  let cursor = getTodayStr();
  for (const d of dates) {
    if (d === cursor) { streak++; cursor = prevDay(cursor); }
    else break;
  }
  return streak;
}

function calcMaxStreak(logs) {
  if (!logs.length) return 0;
  const dates = [...new Set(logs.map(l => l.date))].sort();
  let max = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    if (nextDay(dates[i-1]) === dates[i]) { cur++; max = Math.max(max, cur); }
    else cur = 1;
  }
  return max;
}

function prevDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function relativeTime(date) {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7)  return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days/7)} sem.`;
  return `hace ${Math.floor(days/30)} mes.`;
}

// ─────────────────────────────────────────
//  ADD FORM – Emoji Picker
// ─────────────────────────────────────────
let addSelectedEmoji = '✨';

const addEmojiTrigger = document.getElementById('add-emoji-trigger');
const addEmojiDisp    = document.getElementById('add-emoji-display');
const addPickerWrap   = document.getElementById('add-emoji-picker-wrapper');
const addPicker       = document.getElementById('add-emoji-picker');

addEmojiTrigger?.addEventListener('click', () => {
  addPickerWrap.hidden = !addPickerWrap.hidden;
});

addPicker?.addEventListener('emoji-click', e => {
  addSelectedEmoji = e.detail.unicode;
  addEmojiDisp.textContent = addSelectedEmoji;
  addPickerWrap.hidden = true;
});

// ─────────────────────────────────────────
//  ADD CAL – pre-selected dates for new event
// ─────────────────────────────────────────
let addCalYear   = new Date().getFullYear();
let addCalMonth  = new Date().getMonth();
let addCalDates  = new Set(); // selected 'YYYY-MM-DD' strings

function renderAddCal() {
  const grid  = document.getElementById('add-cal-grid');
  const label = document.getElementById('add-cal-month-label');
  const badge = document.getElementById('add-cal-badge');
  if (!grid || !label) return;

  const today = getTodayStr();
  const monthDate = new Date(addCalYear, addCalMonth, 1);
  label.textContent = monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  if (badge) badge.textContent = addCalDates.size;

  const firstDay    = new Date(addCalYear, addCalMonth, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(addCalYear, addCalMonth + 1, 0).getDate();

  grid.innerHTML = '';

  for (let i = 0; i < startOffset; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${addCalYear}-${String(addCalMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const selected = addCalDates.has(dateStr);
    const isFuture = dateStr > today;

    const cell = document.createElement('div');
    cell.className = 'cal-day' +
      (dateStr === today ? ' today' : '') +
      (selected ? ' add-cal-selected' : '') +
      (isFuture ? ' cal-future' : '');
    cell.dataset.date = dateStr;

    const num = document.createElement('div');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    if (selected) {
      const dot = document.createElement('div');
      dot.className = 'cal-dots';
      dot.innerHTML = '<div class="cal-dot"></div>';
      cell.appendChild(dot);
    }

    if (!isFuture) {
      cell.addEventListener('click', () => {
        if (addCalDates.has(dateStr)) addCalDates.delete(dateStr);
        else addCalDates.add(dateStr);
        renderAddCal();
      });
    }
    grid.appendChild(cell);
  }
}

document.getElementById('add-cal-prev')?.addEventListener('click', () => {
  addCalMonth--;
  if (addCalMonth < 0) { addCalMonth = 11; addCalYear--; }
  renderAddCal();
});
document.getElementById('add-cal-next')?.addEventListener('click', () => {
  addCalMonth++;
  if (addCalMonth > 11) { addCalMonth = 0; addCalYear++; }
  renderAddCal();
});

// ─────────────────────────────────────────
//  ADD FORM – Submit
// ─────────────────────────────────────────
document.getElementById('add-form')?.addEventListener('submit', e => {
  e.preventDefault();

  const name = document.getElementById('add-name-input')?.value.trim();
  const desc = document.getElementById('add-desc-input')?.value.trim();

  if (!name) {
    const inp = document.getElementById('add-name-input');
    inp?.focus();
    return;
  }

  const newId = genId();
  const events = getEvents();
  events.push({ id: newId, emoji: addSelectedEmoji, name, desc: desc || '', createdAt: Date.now() });
  saveEvents(events);

  // Save pre-selected calendar days as logs
  if (addCalDates.size > 0) {
    const logs = getLogs();
    addCalDates.forEach(dateStr => {
      if (!logs.some(l => l.eventId === newId && l.date === dateStr)) {
        logs.push({ eventId: newId, date: dateStr, ts: new Date(dateStr + 'T12:00:00').getTime() });
      }
    });
    saveLogs(logs);
  }

  // Reset form
  document.getElementById('add-form').reset();
  addSelectedEmoji = '✨';
  addEmojiDisp.textContent = '✨';
  addPickerWrap.hidden = true;

  // Reset add calendar
  addCalDates.clear();
  addCalYear  = new Date().getFullYear();
  addCalMonth = new Date().getMonth();
  renderAddCal();

  navigateTo('Home');
});


// ─────────────────────────────────────────
//  CUSTOM CONFIRM DIALOG – Helper
// ─────────────────────────────────────────
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmOkBtn   = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');

function showConfirm({ icon = '⚠️', title, message, confirmText = 'Confirmar', cancelText = 'Cancelar' }) {
  return new Promise(resolve => {
    // Populate
    document.getElementById('confirm-icon').textContent    = icon;
    document.getElementById('confirm-title').textContent   = title;
    document.getElementById('confirm-message').textContent = message;
    confirmOkBtn.textContent     = confirmText;
    confirmCancelBtn.textContent = cancelText;

    // Show
    confirmOverlay.hidden = false;
    document.body.style.overflow = 'hidden';

    // Re-trigger card animation
    const dialog = document.getElementById('confirm-dialog');
    dialog.style.animation = 'none';
    dialog.offsetHeight;
    dialog.style.animation = '';

    function cleanup(result) {
      confirmOverlay.hidden = true;
      document.body.style.overflow = '';
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      confirmOverlay.removeEventListener('click', onBackdrop);
      resolve(result);
    }

    function onOk()      { cleanup(true);  }
    function onCancel()  { cleanup(false); }
    function onBackdrop(e) { if (e.target === confirmOverlay) cleanup(false); }

    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
    confirmOverlay.addEventListener('click', onBackdrop);
  });
}

// ─────────────────────────────────────────
//  CONFIG SECTION
// ─────────────────────────────────────────
document.getElementById('config-reset')?.addEventListener('click', async () => {
  const ok = await showConfirm({
    icon:        '🗑️',
    title:       'Reiniciar todo',
    message:     'Se eliminarán todos los eventos y registros. Esta acción no se puede deshacer.',
    confirmText: 'Reiniciar',
  });
  if (!ok) return;
  localStorage.removeItem(STORE_EVENTS);
  localStorage.removeItem(STORE_LOGS);
  renderEvents();
  navigateTo('Home');
});

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────
document.body.dataset.section = 'Home'; // sync initial state
renderEvents();

window.addEventListener('load', () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    // Slight simulated delay for effect
    setTimeout(() => {
      splash.classList.add('hidden');
      setTimeout(() => splash.remove(), 400); // remove from DOM after fade out
    }, 800);
  }
});

// ─────────────────────────────────────────
//  CALENDAR
// ─────────────────────────────────────────
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed
let calSelectedDate = null; // 'YYYY-MM-DD' | null

function renderCalendar() {
  const grid      = document.getElementById('cal-grid');
  const label     = document.getElementById('cal-month-label');
  if (!grid || !label) return;

  const today     = getTodayStr();
  const logs      = getLogs();
  const events    = getEvents();

  // Month label
  const monthDate = new Date(calYear, calMonth, 1);
  label.textContent = monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  // Build set: dateStr -> count of logs
  const logCountByDay = {};
  logs.forEach(l => {
    if (!logCountByDay[l.date]) logCountByDay[l.date] = 0;
    logCountByDay[l.date]++;
  });

  // Grid: first day of month (Mon=0 … Sun=6)
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const startOffset = (firstDay + 6) % 7; // convert to Mon-first
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  grid.innerHTML = '';

  // Empty cells before first day
  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count   = logCountByDay[dateStr] || 0;
    const isToday = dateStr === today;
    const isSel   = dateStr === calSelectedDate;

    const cell = document.createElement('div');
    cell.className = 'cal-day' +
      (isToday ? ' today' : '') +
      (isSel   ? ' selected' : '');
    cell.dataset.date = dateStr;

    // Number
    const num = document.createElement('div');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    // Dots (max 3 visible + 1 overflow)
    if (count > 0) {
      const dots = document.createElement('div');
      dots.className = 'cal-dots';
      const maxDots  = Math.min(count, 3);
      for (let i = 0; i < maxDots; i++) {
        const dot = document.createElement('div');
        dot.className = 'cal-dot';
        dots.appendChild(dot);
      }
      if (count > 3) {
        const more = document.createElement('div');
        more.className = 'cal-dot-more';
        dots.appendChild(more);
      }
      cell.appendChild(dots);
    }

    cell.addEventListener('click', () => selectCalDay(dateStr));
    grid.appendChild(cell);
  }
}

function selectCalDay(dateStr) {
  // Toggle off if same day clicked again
  if (calSelectedDate === dateStr) {
    calSelectedDate = null;
    closeCalPanel();
    renderCalendar();
    return;
  }
  calSelectedDate = dateStr;
  renderCalendar();
  openCalPanel(dateStr);
}

function openCalPanel(dateStr) {
  const panel     = document.getElementById('cal-day-panel');
  const panelDate = document.getElementById('cal-day-panel-date');
  const panelEvs  = document.getElementById('cal-day-events');
  if (!panel) return;

  // Format date label
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  panelDate.textContent = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Build event rows
  const logs   = getLogs();
  const events = getEvents();
  const logged = new Set(logs.filter(l => l.date === dateStr).map(l => l.eventId));

  panelEvs.innerHTML = '';

  if (events.length === 0) {
    panelEvs.innerHTML = '<p class="cal-empty-day">No hay eventos creados aún.</p>';
  } else {
    events.forEach(ev => {
      const isLogged = logged.has(ev.id);
      const row = document.createElement('div');
      row.className = 'cal-event-row' + (isLogged ? ' logged' : '');
      row.innerHTML = `
        <span class="cal-event-emoji">${ev.emoji || '✨'}</span>
        <span class="cal-event-name">${escHtml(ev.name)}</span>
        <span class="cal-event-badge ${isLogged ? 'done' : 'miss'}">${isLogged ? '✓ Hecho' : 'Sin registro'}</span>
      `;
      panelEvs.appendChild(row);
    });
  }

  panel.hidden = false;
  // Scroll panel into view smoothly
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function closeCalPanel() {
  const panel = document.getElementById('cal-day-panel');
  if (panel) panel.hidden = true;
}

// Nav buttons
document.getElementById('cal-prev')?.addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  calSelectedDate = null;
  closeCalPanel();
  renderCalendar();
});

document.getElementById('cal-next')?.addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  calSelectedDate = null;
  closeCalPanel();
  renderCalendar();
});

document.getElementById('cal-day-panel-close')?.addEventListener('click', () => {
  calSelectedDate = null;
  closeCalPanel();
  renderCalendar();
});

// Initial render + refresh after toggle
const _origRenderEvents = renderEvents;
renderEvents = function() {
  _origRenderEvents();
  renderCalendar();
  renderLastSeen();
};

renderCalendar();

// ─────────────────────────────────────────
//  LAST SEEN SECTION
// ─────────────────────────────────────────
function renderLastSeen() {
  const list   = document.getElementById('last-seen-list');
  const section = document.getElementById('last-seen-section');
  if (!list) return;

  const events = getEvents();
  const logs   = getLogs();
  const today  = getTodayStr();

  // Hide section if no events
  if (events.length === 0) {
    if (section) section.hidden = true;
    return;
  }
  if (section) section.hidden = false;

  list.innerHTML = '';

  events.forEach(ev => {
    const evLogs = logs
      .filter(l => l.eventId === ev.id)
      .sort((a, b) => b.date.localeCompare(a.date)); // most recent first

    const lastDate = evLogs.length > 0 ? evLogs[0].date : null;

    // Calculate days since last log
    let daysSince = null;
    let cardClass = '';
    let daysDisplay = '—';
    let daysLabel   = 'sin registros';
    let subText     = 'Nunca registrado';

    if (lastDate) {
      const [y, m, d] = lastDate.split('-').map(Number);
      const last = new Date(y, m - 1, d);
      const [ty, tm, td] = today.split('-').map(Number);
      const todayDate = new Date(ty, tm - 1, td);
      daysSince = Math.round((todayDate - last) / 86400000);

      if (daysSince === 0) {
        daysDisplay = '✓';
        daysLabel   = 'hoy';
        cardClass   = 'recent';
        subText     = 'Registrado hoy';
      } else if (daysSince === 1) {
        daysDisplay = '1';
        daysLabel   = 'día';
        cardClass   = 'recent';
        subText     = 'Último registro: ayer';
      } else {
        daysDisplay = String(daysSince);
        daysLabel   = daysSince === 1 ? 'día' : 'días';
        cardClass   = daysSince >= 7 ? 'overdue' : '';
        const fmt = last.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
        subText = `Último registro: ${fmt}`;
      }
    } else {
      cardClass = 'never';
    }

    const card = document.createElement('div');
    card.className = `last-seen-card ${cardClass}`.trim();
    card.innerHTML = `
      <div class="last-seen-emoji">${ev.emoji || '✨'}</div>
      <div class="last-seen-info">
        <div class="last-seen-name">${escHtml(ev.name)}</div>
        <div class="last-seen-sub">${subText}</div>
      </div>
      <div class="last-seen-days">
        <span class="last-seen-days-num">${daysDisplay}</span>
        <span class="last-seen-days-label">${daysLabel}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

renderLastSeen();
