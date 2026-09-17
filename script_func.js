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

function countLogsForDay(eventId, dateStr) {
  return getLogs().filter(l => l.eventId === eventId && l.date === dateStr).length;
}

// Adds a new log entry for eventId/dateStr. Habits can be logged more than
// once per day, so this always appends rather than toggling.
function addLog(eventId, dateStr, ts) {
  const logs = getLogs();
  logs.push({ id: genId(), eventId, date: dateStr, ts: ts != null ? ts : Date.now() });
  saveLogs(logs);
}

// Removes the most recently created log for eventId/dateStr (undo).
function removeLastLog(eventId, dateStr) {
  const logs = getLogs();
  let lastIdx = -1, lastTs = -Infinity;
  logs.forEach((l, i) => {
    if (l.eventId === eventId && l.date === dateStr && l.ts >= lastTs) {
      lastTs = l.ts;
      lastIdx = i;
    }
  });
  if (lastIdx < 0) return false;
  logs.splice(lastIdx, 1);
  saveLogs(logs);
  return true;
}

// Removes one specific log (matched by id, falling back to identity for
// older logs saved before ids existed).
function removeLogRef(log) {
  const logs = getLogs();
  const idx = log.id
    ? logs.findIndex(l => l.id === log.id)
    : logs.findIndex(l => l.eventId === log.eventId && l.date === log.date && l.ts === log.ts);
  if (idx < 0) return false;
  logs.splice(idx, 1);
  saveLogs(logs);
  return true;
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
const appMain  = document.querySelector('.app-main');

const headerTitles = {
  Home:   { title: 'Mis Eventos',    subtitle: 'Registrá tu progreso de hoy' },
  Habits: { title: 'Mis Hábitos',    subtitle: 'Gestioná y editá tus rutinas' },
  Add:    { title: 'Nuevo Evento',   subtitle: 'Definí qué querés trackear' },
  Stats:  { title: 'Estadísticas',   subtitle: 'Análisis de tu rendimiento y constancia' },
  Config: { title: 'Configuración', subtitle: 'Personalizá tu experiencia' },
};

function updateHeaderInfo(sectionId) {
  const info = headerTitles[sectionId];
  if (info) {
    const titleEl    = document.getElementById('header-title');
    const subtitleEl = document.getElementById('header-subtitle');
    if (titleEl)    titleEl.textContent    = info.title;
    if (subtitleEl) subtitleEl.textContent = info.subtitle;
  }
}

function refreshSectionData(sectionId) {
  if (sectionId === 'Home') renderDashboard();
  if (sectionId === 'Habits') renderHabits();
  if (sectionId === 'Add') { if (typeof renderAddCal === 'function') renderAddCal(); }
  if (sectionId === 'Stats') { if (typeof renderStats === 'function') renderStats(); }
}

let isProgrammaticScroll = false;
let programmaticScrollTimer = null;

function navigateTo(sectionId, smooth = true) {
  const target = document.getElementById(sectionId);
  if (!target) return;

  sections.forEach(s => s.classList.toggle('active', s.id === sectionId));
  navBtns.forEach(b => {
    const isCurrent = b.dataset.section === sectionId;
    b.classList.toggle('active', isCurrent);
    if (isCurrent) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  const configBtn = document.getElementById('header-config-btn');
  if (configBtn) configBtn.classList.toggle('active', sectionId === 'Config');

  document.body.dataset.section = sectionId;
  updateHeaderInfo(sectionId);
  refreshSectionData(sectionId);

  if (appMain) {
    isProgrammaticScroll = true;
    if (programmaticScrollTimer) clearTimeout(programmaticScrollTimer);
    programmaticScrollTimer = setTimeout(() => {
      isProgrammaticScroll = false;
    }, 550);

    appMain.scrollTo({
      left: target.offsetLeft,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  btn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateTo(btn.dataset.section); }
  });
});

document.getElementById('header-config-btn')?.addEventListener('click', () => {
  navigateTo('Config');
});

// Sync bottom dock and header when user scrolls/swipes horizontally
if (appMain) {
  let scrollDebounce = null;
  appMain.addEventListener('scroll', () => {
    if (isProgrammaticScroll) return;
    if (scrollDebounce) clearTimeout(scrollDebounce);
    scrollDebounce = setTimeout(() => {
      const scrollLeft = appMain.scrollLeft;
      let closest = null;
      let minDiff = Infinity;

      sections.forEach(s => {
        const diff = Math.abs(s.offsetLeft - scrollLeft);
        if (diff < minDiff) {
          minDiff = diff;
          closest = s;
        }
      });

      if (closest && document.body.dataset.section !== closest.id) {
        const sectionId = closest.id;
        document.body.dataset.section = sectionId;

        sections.forEach(s => s.classList.toggle('active', s.id === sectionId));
        navBtns.forEach(b => {
          const isCurrent = b.dataset.section === sectionId;
          b.classList.toggle('active', isCurrent);
          if (isCurrent) b.setAttribute('aria-current', 'page');
          else b.removeAttribute('aria-current');
        });

        const configBtn = document.getElementById('header-config-btn');
        if (configBtn) configBtn.classList.toggle('active', sectionId === 'Config');

        updateHeaderInfo(sectionId);
        refreshSectionData(sectionId);
      }
    }, 50);
  }, { passive: true });
}

window.addEventListener('resize', () => {
  const currentId = document.body.dataset.section || 'Home';
  const target = document.getElementById(currentId);
  if (target && appMain) {
    appMain.scrollTo({ left: target.offsetLeft, behavior: 'auto' });
  }
  if (currentId === 'Stats' && typeof renderEvolutionChart === 'function') {
    renderEvolutionChart();
  }
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
//  RENDER HOME – DASHBOARD QUICK-LOG GRID
// ─────────────────────────────────────────
function renderDashboard() {
  const grid   = document.getElementById('dashboard-grid') || document.getElementById('events-list');
  if (!grid) return;
  const events = getEvents();
  const logs   = getLogs();
  const today  = getTodayStr();

  grid.innerHTML = '';

  if (events.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">🌱</div>
        <div class="empty-title">No tenés hábitos aún</div>
        <div class="empty-sub">Creá tu primer hábito para empezar a registrar tu progreso diario</div>
        <button class="empty-cta" id="empty-dash-cta-btn">+ Crear hábito</button>
      </div>`;
    document.getElementById('empty-dash-cta-btn')
      ?.addEventListener('click', () => {
        navigateTo('Habits');
        openCreateHabitModal();
      });
    updateProgress(0, 0);
    return;
  }

  events.forEach(ev => {
    const todayCount = logs.filter(l => l.eventId === ev.id && l.date === today).length;
    const logged = todayCount > 0;
    const heatLevel = Math.min(todayCount, 4);

    // Calculate last seen counter for this specific event
    const evLogs = logs
      .filter(l => l.eventId === ev.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    const lastDate = evLogs.length > 0 ? evLogs[0].date : null;

    let daysSince = null;
    let cardClass = '';
    let counterText = 'Sin registros';

    if (lastDate) {
      const [y, m, d] = lastDate.split('-').map(Number);
      const last = new Date(y, m - 1, d);
      const [ty, tm, td] = today.split('-').map(Number);
      const todayDate = new Date(ty, tm - 1, td);
      daysSince = Math.round((todayDate - last) / 86400000);

      if (daysSince === 0) {
        counterText = todayCount > 1 ? `✓ Hoy ×${todayCount}` : '✓ Hoy';
        cardClass   = 'recent';
      } else if (daysSince === 1) {
        counterText = 'Ayer';
        cardClass   = 'recent';
      } else {
        counterText = `Hace ${daysSince} d`;
        cardClass   = daysSince >= 7 ? 'overdue' : '';
      }
    } else {
      cardClass = 'never';
    }

    const card = document.createElement('div');
    card.className = `habit-quick-card${logged ? ` registered heat-${heatLevel}` : ''}`;
    card.dataset.id = ev.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${ev.name} - ${logged ? `Registrado ${todayCount} ${todayCount === 1 ? 'vez' : 'veces'} hoy. Tocá para sumar otro registro` : 'Tocá para registrar hoy'}`);

    card.innerHTML = `
      <div class="quick-card-emoji">${ev.emoji || '✨'}</div>
      <div class="quick-card-name">${escHtml(ev.name)}</div>
      <div class="quick-card-counter ${cardClass}">
        <span>${counterText}</span>
      </div>
      ${todayCount > 0 ? `
      <button type="button" class="quick-card-undo" aria-label="Deshacer el último registro de hoy">
        <span class="quick-card-undo-count">${todayCount}</span>
        <span class="quick-card-undo-icon">↺</span>
      </button>` : ''}`;

    card.addEventListener('click', () => {
      addLog(ev.id, today);
      renderEvents();
      if (typeof renderStats === 'function') renderStats();
    });

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });

    card.querySelector('.quick-card-undo')?.addEventListener('click', e => {
      e.stopPropagation();
      removeLastLog(ev.id, today);
      renderEvents();
      if (typeof renderStats === 'function') renderStats();
    });

    grid.appendChild(card);
  });

  // Progress bar
  const total = events.length;
  const done  = events.filter(ev => isLoggedToday(ev.id)).length;
  updateProgress(done, total);
}

// ─────────────────────────────────────────
//  RENDER HABITS – DETAILED LIST
// ─────────────────────────────────────────
function renderHabits() {
  const list  = document.getElementById('habits-list');
  const badge = document.getElementById('habits-total-badge');
  if (!list) return;

  const events = getEvents();
  const logs   = getLogs();
  const today  = getTodayStr();

  if (badge) {
    badge.textContent = `${events.length} hábito${events.length === 1 ? '' : 's'}`;
  }

  list.innerHTML = '';

  if (events.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎯</div>
        <div class="empty-title">No tenés hábitos creados</div>
        <div class="empty-sub">Comenzá creando un hábito para construir tu rutina diaria</div>
        <button class="empty-cta" id="empty-habits-cta-btn">+ Crear hábito</button>
      </div>`;
    document.getElementById('empty-habits-cta-btn')
      ?.addEventListener('click', openCreateHabitModal);
    return;
  }

  events.forEach(ev => {
    const evLogs = logs
      .filter(l => l.eventId === ev.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    let lastRecordLabel = 'Nunca';
    if (evLogs.length > 0) {
      const lastDate = evLogs[0].date;
      if (lastDate === today) {
        lastRecordLabel = 'Hoy';
      } else if (lastDate === getYesterdayStr()) {
        lastRecordLabel = 'Ayer';
      } else {
        const [y, m, d] = lastDate.split('-').map(Number);
        const last = new Date(y, m - 1, d);
        lastRecordLabel = last.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
      }
    }

    const card = document.createElement('div');
    card.className = 'habit-detail-card';
    card.dataset.id = ev.id;

    card.innerHTML = `
      <div class="habit-detail-top">
        <div class="habit-detail-emoji">${ev.emoji || '✨'}</div>
        <div class="habit-detail-info">
          <span class="habit-detail-name">${escHtml(ev.name)}</span>
          <span class="habit-detail-desc">${escHtml(ev.desc || 'Sin descripción')}</span>
          <div class="habit-detail-stats">
            <span class="habit-stat-badge">📊 Total: <strong>${evLogs.length}</strong></span>
            <span class="habit-stat-badge">📅 Último: <strong>${lastRecordLabel}</strong></span>
          </div>
        </div>
      </div>
      <div class="habit-detail-actions">
        <button class="btn-habit-act act-edit" data-id="${ev.id}" title="Editar hábito">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          Editar
        </button>
        <button class="btn-habit-act act-hist" data-id="${ev.id}" title="Ver historial">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
          </svg>
          Historial
        </button>
        <button class="btn-habit-act act-delete" data-id="${ev.id}" title="Eliminar hábito">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Eliminar
        </button>
      </div>`;

    // Action handlers
    card.querySelector('.act-edit').addEventListener('click', () => {
      openConfigModal(ev.id);
    });

    card.querySelector('.act-hist').addEventListener('click', () => {
      openHistoryModal(ev.id);
    });

    card.querySelector('.act-delete').addEventListener('click', async () => {
      const ok = await showConfirm({
        icon:        '🗑️',
        title:       'Eliminar hábito',
        message:     `¿Estás seguro de que querés eliminar "${ev.name}"? Se borrarán todos sus registros.`,
        confirmText: 'Eliminar',
      });
      if (!ok) return;
      const updatedEvents = getEvents().filter(e => e.id !== ev.id);
      saveEvents(updatedEvents);
      const updatedLogs = getLogs().filter(l => l.eventId !== ev.id);
      saveLogs(updatedLogs);
      renderDashboard();
      renderHabits();
      if (typeof renderStats === 'function') renderStats();
    });

    list.appendChild(card);
  });
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function renderEvents() {
  renderDashboard();
  renderHabits();
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
    listEl.innerHTML = logs.map((log, i) => {
      const d   = new Date(log.date + 'T12:00:00');
      const fmt = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const rel = relativeTime(d);
      return `<div class="history-item">
        <div class="history-item-dot"></div>
        <div class="history-item-date">${fmt}</div>
        <div class="history-item-rel">${rel}</div>
        <button type="button" class="history-item-delete" data-idx="${i}" aria-label="Eliminar este registro" title="Eliminar este registro">×</button>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.history-item-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const log = logs[Number(btn.dataset.idx)];
        if (!log || !removeLogRef(log)) return;
        renderHistoryContent(eventId);
        renderHistCal();
        renderEvents(); // keep home & stats in sync
      });
    });
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
  const countByDate = {};
  logs.forEach(l => {
    if (l.eventId !== historyEventId) return;
    countByDate[l.date] = (countByDate[l.date] || 0) + 1;
  });

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
    const count   = countByDate[dateStr] || 0;
    const logged  = count > 0;
    const isFuture = dateStr > today;

    const cell = document.createElement('div');
    cell.className = 'cal-day' +
      (dateStr === today ? ' today' : '') +
      (logged ? ' hist-logged' : '') +
      (isFuture ? ' cal-future' : '');
    cell.dataset.date = dateStr;
    cell.title = logged
      ? `${count} registro${count === 1 ? '' : 's'} — tocá para sumar, mantené presionado para quitar uno`
      : 'Tocá para registrar este día';

    const num = document.createElement('div');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    if (logged) {
      const dots = document.createElement('div');
      dots.className = 'cal-dots';
      const maxDots = Math.min(count, 3);
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

    if (!isFuture) {
      let holdTimer = null;
      let didHold   = false;
      const startHold = () => {
        didHold = false;
        holdTimer = setTimeout(() => {
          didHold = true;
          removeHistCalLog(dateStr);
        }, 550);
      };
      const cancelHold = () => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      };
      cell.addEventListener('pointerdown', startHold);
      cell.addEventListener('pointerup', cancelHold);
      cell.addEventListener('pointerleave', cancelHold);
      cell.addEventListener('pointercancel', cancelHold);
      cell.addEventListener('click', () => {
        if (didHold) { didHold = false; return; }
        addHistCalLog(dateStr);
      });
    }
    grid.appendChild(cell);
  }
}

function fmtHistCalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

function showHistCalFeedback(text, kind) {
  const fb = document.getElementById('hist-cal-feedback');
  if (!fb) return;
  fb.textContent = text;
  fb.className   = 'hist-cal-feedback ' + kind;
  fb.hidden      = false;
  setTimeout(() => { fb.hidden = true; }, 2000);
}

// Tapping a day always adds a new log (a habit can be logged more than once
// per day); holding a day removes the most recently added log for it.
function addHistCalLog(dateStr) {
  addLog(historyEventId, dateStr, new Date(dateStr + 'T12:00:00').getTime());
  showHistCalFeedback(`✓ Registro agregado para el ${fmtHistCalDate(dateStr)}`, 'success');
  renderHistCal();
  renderHistoryContent(historyEventId);
  renderEvents(); // keep home in sync
}

function removeHistCalLog(dateStr) {
  const removed = removeLastLog(historyEventId, dateStr);
  if (removed) {
    showHistCalFeedback(`✕ Registro del ${fmtHistCalDate(dateStr)} eliminado`, 'error');
    renderHistCal();
    renderHistoryContent(historyEventId);
    renderEvents(); // keep home in sync
  }
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
  const formattedMonth = monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  label.textContent = formattedMonth;

  const monthBadge = document.getElementById('add-cal-month-badge');
  if (monthBadge) monthBadge.textContent = formattedMonth;

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

const addCalToggleBtn = document.getElementById('add-cal-toggle-btn');
const addCalBody = document.getElementById('add-cal-body');

if (addCalToggleBtn && addCalBody) {
  addCalToggleBtn.addEventListener('click', () => {
    const isExpanded = addCalToggleBtn.getAttribute('aria-expanded') === 'true';
    addCalToggleBtn.setAttribute('aria-expanded', !isExpanded);
    addCalBody.hidden = isExpanded;
  });
}

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
  if (addEmojiDisp) addEmojiDisp.textContent = '✨';
  if (addPickerWrap) addPickerWrap.hidden = true;

  // Reset add calendar
  addCalDates.clear();
  addCalYear  = new Date().getFullYear();
  addCalMonth = new Date().getMonth();
  renderAddCal();

  closeCreateHabitModal();
  renderDashboard();
  renderHabits();
  if (typeof renderStats === 'function') renderStats();
});

// ─────────────────────────────────────────
//  CREATE HABIT MODAL
// ─────────────────────────────────────────
const createHabitModal = document.getElementById('create-habit-modal');
const createHabitBtn   = document.getElementById('habits-create-btn');
const createHabitClose = document.getElementById('create-habit-close');

function openCreateHabitModal() {
  if (!createHabitModal) return;
  document.getElementById('add-form')?.reset();
  addSelectedEmoji = '✨';
  if (addEmojiDisp) addEmojiDisp.textContent = '✨';
  if (addPickerWrap) addPickerWrap.hidden = true;
  addCalDates.clear();
  addCalYear  = new Date().getFullYear();
  addCalMonth = new Date().getMonth();
  renderAddCal();

  createHabitModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeCreateHabitModal() {
  if (!createHabitModal) return;
  createHabitModal.hidden = true;
  document.body.style.overflow = '';
}

createHabitBtn?.addEventListener('click', openCreateHabitModal);
createHabitClose?.addEventListener('click', closeCreateHabitModal);
createHabitModal?.addEventListener('click', e => {
  if (e.target === createHabitModal) closeCreateHabitModal();
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

// Age Toggle (Adult Ads)
const STORE_OVER18 = 'habitx_over18';
const configAgeItem = document.getElementById('config-age');
const ageToggle = document.getElementById('age-toggle');

function loadAdultAds() {
  if (document.getElementById('adult-ads-script')) return;
  const script = document.createElement('script');
  script.src = "https://pl30537350.effectivecpmnetwork.com/52/85/57/528557c52adbd4e32c07d63caf6f19c8.js";
  script.id = 'adult-ads-script';
  document.body.appendChild(script);
}

if (configAgeItem && ageToggle) {
  // Init state
  const isOver18 = localStorage.getItem(STORE_OVER18) === 'true';
  if (isOver18) {
    ageToggle.classList.add('active');
    loadAdultAds();
  }

  // Handle click
  configAgeItem.addEventListener('click', () => {
    const isActive = ageToggle.classList.toggle('active');
    localStorage.setItem(STORE_OVER18, isActive);
    if (isActive) {
      loadAdultAds();
    } else {
      // Recargar la página para limpiar los scripts de ads ya inyectados
      window.location.reload();
    }
  });
}

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
  const formattedMonth = monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  label.textContent = formattedMonth;
  const badge = document.getElementById('cal-month-badge');
  if (badge) badge.textContent = formattedMonth;

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
    const level   = heatLevel(count);
    const isToday = dateStr === today;
    const isSel   = dateStr === calSelectedDate;

    const cell = document.createElement('div');
    cell.className = 'cal-day heat-' + level +
      (isToday ? ' today' : '') +
      (isSel   ? ' selected' : '');
    cell.dataset.date = dateStr;
    cell.title = count > 0 ? `${count} registro${count === 1 ? '' : 's'}` : 'Sin registros';

    // Number
    const num = document.createElement('div');
    num.className = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    // Heat count label
    if (count > 0) {
      const cnt = document.createElement('div');
      cnt.className = 'cal-heat-count';
      cnt.textContent = count;
      cell.appendChild(cnt);
    }

    cell.addEventListener('click', () => selectCalDay(dateStr));
    grid.appendChild(cell);
  }
}

// Buckets a day's log count into a heat intensity level (0-4), GitHub-style.
function heatLevel(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
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
  const logs = getLogs();
  const events = getEvents();
  const countByEvent = {};
  logs.forEach(l => {
    if (l.date !== dateStr) return;
    countByEvent[l.eventId] = (countByEvent[l.eventId] || 0) + 1;
  });

  panelEvs.innerHTML = '';

  const loggedEvents = events.filter(ev => countByEvent[ev.id]);

  if (loggedEvents.length === 0) {
    panelEvs.innerHTML = '<p class="cal-empty-day">Sin registros este día.</p>';
  } else {
    loggedEvents.forEach(ev => {
      const count = countByEvent[ev.id];
      const row = document.createElement('div');
      row.className = 'cal-event-row logged';
      row.innerHTML = `
        <span class="cal-event-emoji">${ev.emoji || '✨'}</span>
        <span class="cal-event-name">${escHtml(ev.name)}</span>
        <span class="cal-event-badge done">${count > 1 ? `✓ ×${count}` : '✓ Hecho'}</span>
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

// Heatmap calendar body is permanently visible and non-reducible
const calBody = document.getElementById('cal-body');
if (calBody) {
  calBody.hidden = false;
}

// Initial render + refresh after toggle
const _origRenderEvents = renderEvents;
renderEvents = function() {
  _origRenderEvents();
  renderCalendar();
};

renderCalendar();

// ─────────────────────────────────────────
//  STATS SECTION – CHARTS & ANALYTICS
// ─────────────────────────────────────────
function getStatsAvailableMonths(logs) {
  const current = new Date();
  const currentKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
  const keysSet = new Set([currentKey]);

  (logs || []).forEach(l => {
    if (l.date && l.date.length >= 7) {
      keysSet.add(l.date.substring(0, 7));
    }
  });

  return Array.from(keysSet).sort().reverse();
}

function formatStatsMonthLabel(key, currentKey) {
  const [yStr, mStr] = key.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const dateObj = new Date(y, m - 1, 1);
  const formatted = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  return key === currentKey ? `${capitalized} (Este mes)` : capitalized;
}

function updateStatsMonthSelect(selectId, availableKeys, currentKey) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const currentVal = select.value;
  let optionsHtml = '';
  availableKeys.forEach(k => {
    optionsHtml += `<option value="${k}">${formatStatsMonthLabel(k, currentKey)}</option>`;
  });
  optionsHtml += `<option value="all">Todos los meses</option>`;
  select.innerHTML = optionsHtml;

  if (currentVal && (availableKeys.includes(currentVal) || currentVal === 'all')) {
    select.value = currentVal;
  } else {
    select.value = currentKey;
  }
}

function initStatsCollapsibles() {
  // Los contenedores de estadísticas no se pueden contraer
  document.querySelectorAll('.stats-chart-body').forEach(b => {
    b.hidden = false;
  });
}

function renderStats() {
  const events = getEvents();
  const logs   = getLogs();
  const today  = getTodayStr();

  // 1. KPI Cards
  const totalLogsEl    = document.getElementById('stats-total-logs');
  const activeStreakEl = document.getElementById('stats-active-streak');
  const monthlyPctEl   = document.getElementById('stats-monthly-pct');
  const bestHabitEl    = document.getElementById('stats-best-habit');

  if (totalLogsEl) totalLogsEl.textContent = logs.length;

  // Active Global Streak (consecutive days with at least 1 log)
  const logDatesSet = new Set(logs.map(l => l.date));
  let streak = 0;
  let cursor = today;
  while (logDatesSet.has(cursor)) {
    streak++;
    cursor = prevDay(cursor);
  }
  if (activeStreakEl) activeStreakEl.textContent = `${streak} ${streak === 1 ? 'día' : 'días'}`;

  // Monthly Completion Rate % (last 30 days)
  const days30 = [];
  let dCursor = today;
  for (let i = 0; i < 30; i++) {
    days30.push(dCursor);
    dCursor = prevDay(dCursor);
  }
  const days30Set = new Set(days30);
  const last30LogsCount = logs.filter(l => days30Set.has(l.date)).length;

  const maxPossible30 = events.length * 30;
  const monthlyPct = maxPossible30 > 0 ? Math.round((last30LogsCount / maxPossible30) * 100) : 0;
  if (monthlyPctEl) monthlyPctEl.textContent = `${monthlyPct}%`;

  // Best Habit
  const habitCounts = {};
  logs.forEach(l => {
    habitCounts[l.eventId] = (habitCounts[l.eventId] || 0) + 1;
  });
  let bestEvId = null;
  let maxCount = -1;
  Object.keys(habitCounts).forEach(id => {
    if (habitCounts[id] > maxCount) {
      maxCount = habitCounts[id];
      bestEvId = id;
    }
  });
  const bestEv = events.find(e => e.id === bestEvId);
  if (bestHabitEl) {
    bestHabitEl.textContent = bestEv ? `${bestEv.emoji || '✨'} ${bestEv.name}` : '—';
  }

  // Populate Month Filter Selects
  const current = new Date();
  const currentKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
  const availableKeys = getStatsAvailableMonths(logs);
  updateStatsMonthSelect('stats-donut-month-select', availableKeys, currentKey);
  updateStatsMonthSelect('stats-breakdown-month-select', availableKeys, currentKey);

  // Initialize Collapsible Containers
  initStatsCollapsibles();

  // Render Calendar
  renderCalendar();

  // 2. Chart 1: Evolution SVG Line Chart
  renderEvolutionChart();

  // 3. Chart 2: Donut Distribution Chart
  renderDonutChart();

  // 4. Chart 3: Weekday Performance Bar Chart
  renderWeekdayChart();

  // 5. Breakdown List
  renderBreakdownList();
}

function renderEvolutionChart() {
  const container = document.getElementById('stats-evolution-chart-container');
  if (!container) return;

  const select = document.getElementById('stats-timeframe-select');
  const timeframe = select ? parseInt(select.value, 10) || 14 : 14;

  const logs  = getLogs();
  const today = getTodayStr();

  // Build last N days array (oldest to newest)
  const days = [];
  let cursor = today;
  for (let i = 0; i < timeframe; i++) {
    days.unshift(cursor);
    cursor = prevDay(cursor);
  }

  // Count logs per day
  const counts = days.map(d => logs.filter(l => l.date === d).length);
  const maxVal = Math.max(...counts, 4);

  // Dimensions
  const svgWidth  = Math.max(container.clientWidth || 320, 320);
  const svgHeight = 160;
  const paddingX  = 24;
  const paddingTop = 24;
  const paddingBottom = 30;

  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingTop - paddingBottom;

  const stepX = days.length > 1 ? chartW / (days.length - 1) : chartW;

  const points = counts.map((c, i) => {
    const x = paddingX + i * stepX;
    const y = paddingTop + chartH - (c / maxVal) * chartH;
    return { x, y, val: c, date: days[i] };
  });

  // Path data
  let dPath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    dPath += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const dArea = `${dPath} L ${points[points.length - 1].x} ${svgHeight - paddingBottom} L ${points[0].x} ${svgHeight - paddingBottom} Z`;

  // X labels step
  const labelStep = timeframe > 14 ? 5 : timeframe > 7 ? 2 : 1;

  let labelsSvg = '';
  points.forEach((p, i) => {
    if (i % labelStep === 0 || i === points.length - 1) {
      const [y, m, d] = p.date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const fmtStr = dateObj.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.','');
      labelsSvg += `<text x="${p.x}" y="${svgHeight - 8}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${fmtStr}</text>`;
    }
  });

  let dotsSvg = '';
  points.forEach(p => {
    dotsSvg += `
      <circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--accent)" stroke="#ffffff" stroke-width="1.5" />
      ${p.val > 0 ? `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--accent-light)">${p.val}</text>` : ''}
    `;
  });

  container.innerHTML = `
    <svg width="100%" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="overflow: visible;">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <line x1="${paddingX}" y1="${paddingTop + chartH}" x2="${svgWidth - paddingX}" y2="${paddingTop + chartH}" stroke="var(--border)" stroke-width="1"/>
      <path d="${dArea}" fill="url(#chartGrad)" />
      <path d="${dPath}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
      ${dotsSvg}
      ${labelsSvg}
    </svg>
  `;
}

function renderDonutChart() {
  const container = document.getElementById('stats-donut-container');
  const legend = document.getElementById('stats-donut-legend');
  if (!container || !legend) return;

  const events = getEvents();
  const logs   = getLogs();
  const select = document.getElementById('stats-donut-month-select');
  const selectedMonth = select ? select.value : 'all';

  const filteredLogs = (selectedMonth && selectedMonth !== 'all')
    ? logs.filter(l => l.date && l.date.startsWith(selectedMonth))
    : logs;

  if (events.length === 0 || filteredLogs.length === 0) {
    container.innerHTML = `<div class="history-empty" style="padding:20px 0;">Sin registros en este período 📭</div>`;
    legend.innerHTML = '';
    return;
  }

  const colors = ['#7c5cfc', '#34d399', '#f59e0b', '#ec4899', '#3b82f6', '#a855f7', '#6366f1', '#10b981'];

  const eventCounts = events.map((ev, i) => {
    const cnt = filteredLogs.filter(l => l.eventId === ev.id).length;
    return { ...ev, count: cnt, color: colors[i % colors.length] };
  }).filter(ev => ev.count > 0);

  const total = eventCounts.reduce((acc, ev) => acc + ev.count, 0);

  if (total === 0) {
    container.innerHTML = `<div class="history-empty" style="padding:20px 0;">Sin registros en este período 📭</div>`;
    legend.innerHTML = '';
    return;
  }

  // SVG Donut
  const size = 140;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  let circlesSvg = '';

  eventCounts.forEach(ev => {
    const pct = ev.count / total;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativeOffset;
    cumulativeOffset += pct * circumference;

    circlesSvg += `
      <circle
        cx="${size/2}" cy="${size/2}" r="${radius}"
        fill="transparent"
        stroke="${ev.color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${strokeDasharray}"
        stroke-dashoffset="${strokeDashoffset}"
        style="transition: stroke-dasharray 0.6s var(--ease);"
      />
    `;
  });

  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);">
      <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="transparent" stroke="var(--bg-elevated)" stroke-width="${strokeWidth}" />
      ${circlesSvg}
    </svg>
    <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
      <span style="font-size:1.1rem; font-weight:800; color:var(--text-primary); line-height:1;">${total}</span>
      <span style="font-size:0.65rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Registros</span>
    </div>
  `;

  legend.innerHTML = eventCounts.map(ev => {
    const pct = Math.round((ev.count / total) * 100);
    return `
      <div class="stats-legend-item">
        <div class="stats-legend-left">
          <div class="stats-legend-dot" style="background:${ev.color};"></div>
          <span class="stats-legend-name">${ev.emoji || '✨'} ${escHtml(ev.name)}</span>
        </div>
        <span class="stats-legend-pct">${pct}% (${ev.count})</span>
      </div>
    `;
  }).join('');
}

function renderWeekdayChart() {
  const container = document.getElementById('stats-weekday-chart');
  if (!container) return;

  const logs = getLogs();
  const weekdays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

  logs.forEach(l => {
    const [y, m, d] = l.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayIdx = (dateObj.getDay() + 6) % 7; // Mon=0 … Sun=6
    weekdayCounts[dayIdx]++;
  });

  const maxVal = Math.max(...weekdayCounts, 1);

  container.innerHTML = weekdays.map((dayLabel, i) => {
    const cnt = weekdayCounts[i];
    const pct = Math.round((cnt / maxVal) * 100);
    return `
      <div class="stats-bar-col">
        <span class="stats-bar-val">${cnt > 0 ? cnt : ''}</span>
        <div class="stats-bar-track">
          <div class="stats-bar-fill" style="height: ${pct}%;"></div>
        </div>
        <span class="stats-bar-lbl">${dayLabel}</span>
      </div>
    `;
  }).join('');
}

function renderBreakdownList() {
  const listEl = document.getElementById('stats-breakdown-list');
  if (!listEl) return;

  const events = getEvents();
  const logs   = getLogs();
  const select = document.getElementById('stats-breakdown-month-select');
  const selectedMonth = select ? select.value : 'all';

  if (events.length === 0) {
    listEl.innerHTML = `<div class="history-empty">Sin eventos aún 📭</div>`;
    return;
  }

  if (selectedMonth && selectedMonth !== 'all') {
    const [yStr, mStr] = selectedMonth.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthLogs = logs.filter(l => l.date && l.date.startsWith(selectedMonth));

    listEl.innerHTML = events.map(ev => {
      const evMonthLogs = monthLogs.filter(l => l.eventId === ev.id).length;
      const pct = Math.min(100, Math.round((evMonthLogs / daysInMonth) * 100));

      return `
        <div class="stats-breakdown-item">
          <div class="stats-breakdown-emoji">${ev.emoji || '✨'}</div>
          <div class="stats-breakdown-info">
            <div class="stats-breakdown-name">${escHtml(ev.name)}</div>
            <div class="stats-breakdown-progress-track">
              <div class="stats-breakdown-progress-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
          <div class="stats-breakdown-stats">
            <span class="stats-breakdown-count">${evMonthLogs} reg.</span>
            <span class="stats-breakdown-pct">${pct}% (${daysInMonth}d)</span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    // All time
    const totalLogs = logs.length;
    listEl.innerHTML = events.map(ev => {
      const evLogs = logs.filter(l => l.eventId === ev.id);
      const cnt = evLogs.length;
      const pct = totalLogs > 0 ? Math.round((cnt / totalLogs) * 100) : 0;

      return `
        <div class="stats-breakdown-item">
          <div class="stats-breakdown-emoji">${ev.emoji || '✨'}</div>
          <div class="stats-breakdown-info">
            <div class="stats-breakdown-name">${escHtml(ev.name)}</div>
            <div class="stats-breakdown-progress-track">
              <div class="stats-breakdown-progress-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
          <div class="stats-breakdown-stats">
            <span class="stats-breakdown-count">${cnt} reg.</span>
            <span class="stats-breakdown-pct">${pct}% (total)</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

document.getElementById('stats-timeframe-select')?.addEventListener('change', () => {
  renderEvolutionChart();
});

document.getElementById('stats-donut-month-select')?.addEventListener('change', () => {
  renderDonutChart();
});

document.getElementById('stats-breakdown-month-select')?.addEventListener('change', () => {
  renderBreakdownList();
});
