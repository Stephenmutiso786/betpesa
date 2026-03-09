const API = '/api';
let token = localStorage.getItem('betpesa_token') || '';

const statusEl = document.getElementById('sp-status');
const refreshBadgeEl = document.getElementById('sp-refresh-badge');
const currentStateEl = document.getElementById('sp-current-state');
const liveOddEl = document.getElementById('sp-aviator-live');
const targetOddEl = document.getElementById('sp-aviator-target');
const roundIdEl = document.getElementById('sp-round-id');
const nextRefreshEl = document.getElementById('sp-aviator-next');
const upcomingGridEl = document.getElementById('sp-aviator-upcoming-grid');

let refreshTimer = null;

function setBusy(el, busy, busyText = 'Processing...') {
  if (!el) return;
  if (!el.dataset.idleText) el.dataset.idleText = el.textContent || '';
  el.disabled = !!busy;
  el.textContent = busy ? busyText : el.dataset.idleText;
}

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.style.color = error ? '#d93535' : '#1db954';
}

function prettyMode(mode) {
  if (mode === 'active_bets_low_range') return 'SAFE';
  if (mode === 'no_bets_high_range') return 'SAFE';
  return 'QUEUE';
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function ensureProvider() {
  if (!token) {
    window.location.replace('/login');
    return null;
  }
  const me = await api('/me');
  if (!(me.user?.role === 'signal_provider' || me.user?.isAdmin)) {
    window.location.replace('/dashboard');
    return null;
  }
  return me.user;
}

async function renderLive() {
  const state = await api('/aviator/state');
  const signal = state.signalAdmin;

  if (!signal) {
    setStatus('No access to live signal stream', true);
    return;
  }

  const phase = String(state.phase || 'betting').toUpperCase();
  currentStateEl.textContent = `• ${phase === 'CRASHED' ? 'WAITING' : phase}`;
  liveOddEl.textContent = `${Number(signal.live || state.multiplier || 1).toFixed(2)}x`;
  targetOddEl.textContent = `${Number(signal.target || 2).toFixed(2)}x`;
  roundIdEl.textContent = `${String(state.roundId || '').slice(0, 8)} • ${signal.mode || '-'}`;

  const leftMs = signal.nextSignalAt ? Math.max(0, new Date(signal.nextSignalAt).getTime() - Date.now()) : 0;
  const leftSec = (leftMs / 1000).toFixed(1);
  nextRefreshEl.textContent = `Refresh in ${leftSec}s`;
  refreshBadgeEl.textContent = `Live • Auto-refresh ${leftSec}s`;

  upcomingGridEl.innerHTML = '';
  (signal.upcoming || []).slice(0, 10).forEach((val, idx) => {
    const card = document.createElement('article');
    card.className = 'up-card';
    card.innerHTML = `
      <small>Round #${idx + 1}</small>
      <strong>${Number(val).toFixed(2)}x</strong>
      <span>${prettyMode(signal.mode)}</span>
    `;
    upcomingGridEl.appendChild(card);
  });
}

document.getElementById('sp-logout-btn').addEventListener('click', async () => {
  const btn = document.getElementById('sp-logout-btn');
  if (btn.disabled) return;
  try {
    setBusy(btn, true, 'Logging out...');
    await api('/logout', { method: 'POST' });
  } catch {
  }
  localStorage.removeItem('betpesa_token');
  token = '';
  if (refreshTimer) clearInterval(refreshTimer);
  setBusy(btn, false);
  window.location.replace('/login');
});

(async function init() {
  try {
    const ok = await ensureProvider();
    if (!ok) return;
    await renderLive();
    refreshTimer = setInterval(async () => {
      try {
        await renderLive();
      } catch {
      }
    }, 1000);
  } catch {
    localStorage.removeItem('betpesa_token');
    window.location.replace('/login');
  }
})();
