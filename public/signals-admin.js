const API = '/api';
let token = localStorage.getItem('betpesa_token') || '';

const statusEl = document.getElementById('sp-status');
const meEl = document.getElementById('sp-me');
const statsEl = document.getElementById('sp-stats');
const signalsEl = document.getElementById('sp-signals');
const aviatorLiveEl = document.getElementById('sp-aviator-live');
const aviatorTargetEl = document.getElementById('sp-aviator-target');
const aviatorModeEl = document.getElementById('sp-aviator-mode');
const aviatorNextEl = document.getElementById('sp-aviator-next');
const aviatorUpcomingEl = document.getElementById('sp-aviator-upcoming');
const aviatorHistoryEl = document.getElementById('sp-aviator-history');

let refreshTimer = null;

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.style.color = error ? '#d93535' : '#1db954';
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
  meEl.textContent = `${me.user.username} (${me.user.role})`;
  return me.user;
}

async function loadSignals() {
  const data = await api('/signals/mine?limit=100');
  const rows = data.signals || [];

  const counts = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 }
  );

  statsEl.innerHTML = `
    <div class="item">Total: <strong>${counts.total}</strong></div>
    <div class="item">Approved: <strong>${counts.approved}</strong></div>
    <div class="item">Pending: <strong>${counts.pending}</strong></div>
    <div class="item">Rejected: <strong>${counts.rejected}</strong></div>
  `;

  signalsEl.innerHTML = '';
  rows.forEach((s) => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<strong>${s.game}</strong><small>${s.prediction}</small><small>Odds ${Number(s.odds).toFixed(
      2
    )} | ${s.confidence} | ${s.status} | ${new Date(s.startsAt).toLocaleString()}</small>`;
    signalsEl.appendChild(el);
  });
}

function prettyMode(mode) {
  if (mode === 'active_bets_low_range') return 'Bets Placed (1.01x - 1.97x)';
  if (mode === 'no_bets_high_range') return 'No Bets (8.01x - 79.81x)';
  return '-';
}

async function loadAviatorSignals() {
  const state = await api('/aviator/state');
  const stream = state.signalAdmin;
  if (!stream) {
    aviatorLiveEl.textContent = `${Number(state.multiplier || 1).toFixed(2)}x`;
    aviatorTargetEl.textContent = '-';
    aviatorModeEl.textContent = 'Not allowed';
    aviatorNextEl.textContent = '-';
    aviatorUpcomingEl.innerHTML = '<div class="item">No access to admin aviator signal stream</div>';
  } else {
    aviatorLiveEl.textContent = `${Number(stream.live || 1).toFixed(2)}x`;
    aviatorTargetEl.textContent = `${Number(stream.target || 2).toFixed(2)}x`;
    aviatorModeEl.textContent = prettyMode(stream.mode);

    if (stream.nextSignalAt) {
      const leftMs = Math.max(0, new Date(stream.nextSignalAt).getTime() - Date.now());
      aviatorNextEl.textContent = `${(leftMs / 1000).toFixed(1)}s`;
    } else {
      aviatorNextEl.textContent = '-';
    }

    aviatorUpcomingEl.innerHTML = '';
    const upcoming = (stream.upcoming || []).slice(0, 8);
    if (!upcoming.length) {
      aviatorUpcomingEl.innerHTML = '<div class="item">Generating...</div>';
    } else {
      upcoming.forEach((val, idx) => {
        const row = document.createElement('div');
        row.className = 'item';
        row.innerHTML = `<strong>${idx === 0 ? 'Next' : `Queue #${idx + 1}`}</strong><small>${Number(val).toFixed(
          2
        )}x</small>`;
        aviatorUpcomingEl.appendChild(row);
      });
    }
  }

  aviatorHistoryEl.innerHTML = '';
  (state.history || []).slice(0, 15).forEach((row) => {
    const chip = document.createElement('span');
    chip.className = 'signal-chip';
    chip.textContent = `${Number(row.crashPoint).toFixed(2)}x`;
    aviatorHistoryEl.appendChild(chip);
  });
}

document.getElementById('sp-create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/signals', {
      method: 'POST',
      body: JSON.stringify({
        game: document.getElementById('sp-game').value,
        prediction: document.getElementById('sp-prediction').value,
        odds: Number(document.getElementById('sp-odds').value),
        confidence: document.getElementById('sp-confidence').value,
        startsAt: new Date(document.getElementById('sp-starts-at').value).toISOString()
      })
    });
    e.target.reset();
    setStatus('Signal submitted successfully');
    await loadSignals();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('sp-logout-btn').addEventListener('click', async () => {
  try {
    await api('/logout', { method: 'POST' });
  } catch {
  }
  localStorage.removeItem('betpesa_token');
  token = '';
  if (refreshTimer) clearInterval(refreshTimer);
  window.location.replace('/login');
});

(async function init() {
  try {
    const ok = await ensureProvider();
    if (!ok) return;
    await loadAviatorSignals();
    await loadSignals();
    refreshTimer = setInterval(async () => {
      try {
        await loadAviatorSignals();
        await loadSignals();
      } catch {
      }
    }, 1000);
  } catch {
    localStorage.removeItem('betpesa_token');
    window.location.replace('/login');
  }
})();
