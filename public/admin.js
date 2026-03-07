const API = '/api';
let token = localStorage.getItem('betpesa_token') || '';

const statusEl = document.getElementById('admin-status');
const meEl = document.getElementById('admin-me');
const overviewEl = document.getElementById('admin-overview');
const aviatorEl = document.getElementById('admin-aviator');
const betsEl = document.getElementById('admin-bets');
const adminSignalHistoryEl = document.getElementById('admin-signal-history');
const adminSignalLiveDisplayEl = document.getElementById('admin-signal-live-display');
const adminSignalTargetDisplayEl = document.getElementById('admin-signal-target-display');
const adminSignalUpcomingLiveEl = document.getElementById('admin-signal-upcoming-live');
const adminAviatorRoundEl = document.getElementById('admin-aviator-round');
const adminAviatorPhaseEl = document.getElementById('admin-aviator-phase');
const adminAviatorCountdownEl = document.getElementById('admin-aviator-countdown');
const adminAviatorMultiplierEl = document.getElementById('admin-aviator-multiplier');
const adminAviatorCanvas = document.getElementById('admin-aviator-canvas');
const adminAviatorCurrentOddEl = document.getElementById('admin-aviator-current-odd');
const adminAviatorLastOddEl = document.getElementById('admin-aviator-last-odd');
const adminAviatorNextOddEl = document.getElementById('admin-aviator-next-odd');
const adminAviatorModeEl = document.getElementById('admin-aviator-mode');
const adminAviatorOddsListEl = document.getElementById('admin-aviator-odds-list');
const oddsEventEl = document.getElementById('odds-event');
const roleUserEl = document.getElementById('role-user');
const roleValueEl = document.getElementById('role-value');
const adminSignalEl = document.getElementById('admin-signal');

let refreshTimer = null;
let adminAviatorState = null;
let adminAviatorFrame = null;
let adminFlightStartMs = Date.now();

function phaseLabel(phase) {
  return phase === 'crashed' ? 'flew away' : phase;
}

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.style.color = error ? '#d93535' : '#1db954';
}

function fmt(num) {
  return Number(num || 0).toFixed(2);
}

function oddsModeLabel(mode) {
  if (mode === 'active_bets_low_range') return 'Bet placed (1.01x - 1.97x)';
  if (mode === 'no_bets_high_range') return 'No bets (8.01x - 79.81x)';
  return '-';
}

function formatSecs(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${s}s`;
}

function computeCountdown(state) {
  if (!state) return '--';
  if (state.phase === 'betting' && state.bettingClosesAt) {
    const left = new Date(state.bettingClosesAt).getTime() - Date.now();
    return left > 0 ? `Takeoff in ${formatSecs(left)}` : 'Takeoff now';
  }
  if (state.phase === 'crashed' && state.crashedAt) {
    const left = new Date(state.crashedAt).getTime() + 6000 - Date.now();
    return left > 0 ? `Next round in ${formatSecs(left)}` : 'Starting...';
  }
  if (state.phase === 'flying') return 'In flight';
  return '--';
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

async function ensureAdmin() {
  if (!token) {
    window.location.replace('/login');
    return null;
  }
  const me = await api('/me');
  if (!me.user?.isAdmin) {
    localStorage.removeItem('betpesa_token');
    window.location.replace('/dashboard');
    return null;
  }
  meEl.textContent = `${me.user.username} (${me.user.phone})`;
  return me.user;
}

async function loadLive() {
  const data = await api('/admin/live');
  overviewEl.innerHTML = `
    <div class="item">Users: <strong>${data.overview.users}</strong></div>
    <div class="item">Open Bets: <strong>${data.overview.openBets}</strong></div>
    <div class="item">Pending KYC: <strong>${data.overview.pendingKyc}</strong></div>
    <div class="item">Transactions: <strong>${data.overview.transactions}</strong></div>
    <div class="item">Recent Stake Volume: <strong>KES ${fmt(data.totalStaked)}</strong></div>
    <div class="item">Total Deposits: <strong>KES ${fmt(data.finance?.deposits)}</strong></div>
    <div class="item">Total Withdrawals: <strong>KES ${fmt(data.finance?.withdrawals)}</strong></div>
    <div class="item">Total Stakes: <strong>KES ${fmt(data.finance?.stakes)}</strong></div>
    <div class="item">Total Payouts: <strong>KES ${fmt(data.finance?.payouts)}</strong></div>
    <div class="item">System GGR: <strong>KES ${fmt(data.finance?.ggr)}</strong></div>
    <div class="item">Net Cashflow: <strong>KES ${fmt(data.finance?.netCashflow)}</strong></div>
  `;

  aviatorEl.innerHTML = `
    <div class="item">Round: <strong>${String(data.aviator.roundId || '-').slice(0, 8)}</strong></div>
    <div class="item">Phase: <strong>${phaseLabel(data.aviator.phase)}</strong></div>
    <div class="item">Live Multiplier: <strong>${fmt(data.aviator.multiplier)}x</strong></div>
  `;

  if (
    !adminAviatorState ||
    adminAviatorState.roundId !== data.aviator.roundId ||
    adminAviatorState.phase !== data.aviator.phase
  ) {
    adminFlightStartMs = Date.now();
  }
  adminAviatorState = data.aviator;
  adminAviatorRoundEl.textContent = String(data.aviator.roundId || '-').slice(0, 8);
  adminAviatorPhaseEl.textContent = phaseLabel(data.aviator.phase || 'betting');
  adminAviatorCountdownEl.textContent = computeCountdown(data.aviator);
  adminAviatorMultiplierEl.textContent = `${fmt(data.aviator.multiplier || 1)}x`;

  adminSignalLiveDisplayEl.textContent = fmt(data.aviator.signalAdmin?.live || data.aviator.multiplier || 1);
  adminSignalTargetDisplayEl.textContent = `Target: ${fmt(data.aviator.signalAdmin?.target || 2)}x`;
  adminSignalHistoryEl.innerHTML = '';
  (data.aviator.history || []).slice(0, 12).forEach((row) => {
    const chip = document.createElement('span');
    chip.className = 'signal-chip';
    chip.textContent = `${fmt(row.crashPoint)}x`;
    adminSignalHistoryEl.appendChild(chip);
  });

  adminSignalUpcomingLiveEl.innerHTML = '';
  const upcoming = (data.aviator.signalAdmin?.upcoming || []).slice(0, 5);
  if (!upcoming.length) {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = '<strong>Queue</strong><small>Waiting for rounds</small>';
    adminSignalUpcomingLiveEl.appendChild(row);
  } else {
    upcoming.forEach((val, idx) => {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `<strong>${idx === 0 ? 'Live' : `Next #${idx}`}</strong><small>${fmt(val)}x</small>`;
      adminSignalUpcomingLiveEl.appendChild(row);
    });
  }

  const currentOdd = Number(data.aviator.multiplier || data.aviator.signalAdmin?.live || 1);
  const lastOdd = data.aviator.history?.length ? Number(data.aviator.history[0].crashPoint) : null;
  const nextOdd = data.aviator.signalAdmin?.upcoming?.length ? Number(data.aviator.signalAdmin.upcoming[0]) : null;
  adminAviatorCurrentOddEl.textContent = `Current: ${fmt(currentOdd)}x`;
  adminAviatorLastOddEl.textContent = `Last: ${lastOdd ? `${fmt(lastOdd)}x` : '-'}`;
  adminAviatorNextOddEl.textContent = `Next: ${nextOdd ? `${fmt(nextOdd)}x` : '-'}`;
  adminAviatorModeEl.textContent = `Mode: ${oddsModeLabel(data.aviator.signalAdmin?.mode)}`;

  adminAviatorOddsListEl.innerHTML = '';
  [currentOdd, ...(data.aviator.signalAdmin?.upcoming || [])].slice(0, 10).forEach((odd) => {
    const chip = document.createElement('span');
    chip.className = 'signal-chip';
    chip.textContent = `${fmt(odd)}x`;
    adminAviatorOddsListEl.appendChild(chip);
  });

  betsEl.innerHTML = '';
  (data.recentBets || []).forEach((b) => {
    const row = document.createElement('div');
    row.className = 'item';
    row.textContent = `${b.id} | ${b.eventId} | ${b.market} | stake ${fmt(b.stake)} | ${b.status}`;
    betsEl.appendChild(row);
  });
}

function drawAdminAviator() {
  if (!adminAviatorCanvas) return;
  const ctx = adminAviatorCanvas.getContext('2d');
  const w = adminAviatorCanvas.width;
  const h = adminAviatorCanvas.height;

  const grd = ctx.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, h * 0.8);
  grd.addColorStop(0, '#1f2235');
  grd.addColorStop(0.45, '#111625');
  grd.addColorStop(1, '#090b11');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.62;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 28; i += 1) {
    const a = (Math.PI * 2 * i) / 28;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * h);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = '#2a2f47';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = (h / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const phase = adminAviatorState?.phase || 'betting';
  const elapsed = (Date.now() - adminFlightStartMs) / 1000;
  const progress = phase === 'flying' ? Math.min(1, elapsed / 10) : phase === 'crashed' ? 1 : 0;

  const points = [];
  for (let i = 0; i <= 120; i += 1) {
    const t = i / 120;
    const x = 20 + t * (w - 40) * progress;
    const curve = Math.pow(t, 1.8);
    const y = h - 18 - curve * (h - 42);
    points.push({ x, y });
  }

  if (points.length > 1) {
    ctx.strokeStyle = '#ff3f4f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  if (points.length) {
    const p = points[points.length - 1];
    const prev = points[Math.max(0, points.length - 2)];
    const angle = Math.atan2(p.y - prev.y, p.x - prev.x);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#ff3d4c';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a90f20';
    ctx.fillRect(-1, -2, 7, 4);
    ctx.fillStyle = '#ff7682';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-13, -7);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-13, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  adminAviatorFrame = requestAnimationFrame(drawAdminAviator);
}

async function loadEvents() {
  const data = await api('/events');
  oddsEventEl.innerHTML = '';
  data.events.forEach((event) => {
    const opt = document.createElement('option');
    opt.value = event.id;
    opt.textContent = `${event.homeTeam} vs ${event.awayTeam}`;
    opt.dataset.home = event.markets.homeWin;
    opt.dataset.draw = event.markets.draw;
    opt.dataset.away = event.markets.awayWin;
    oddsEventEl.appendChild(opt);
  });

  const first = oddsEventEl.options[0];
  if (first) {
    document.getElementById('odds-home').value = first.dataset.home;
    document.getElementById('odds-draw').value = first.dataset.draw;
    document.getElementById('odds-away').value = first.dataset.away;
  }
}

async function loadUsers() {
  const data = await api('/admin/users');
  roleUserEl.innerHTML = '';
  data.users.forEach((u) => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.username} (${u.phone}) [${u.role || 'user'}]`;
    roleUserEl.appendChild(opt);
  });
}

async function loadSignalsAdmin() {
  const data = await api('/admin/signals');
  adminSignalEl.innerHTML = '';
  data.signals.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.game} | ${s.prediction} | ${s.status}`;
    adminSignalEl.appendChild(opt);
  });
}

oddsEventEl.addEventListener('change', () => {
  const selected = oddsEventEl.options[oddsEventEl.selectedIndex];
  if (!selected) return;
  document.getElementById('odds-home').value = selected.dataset.home;
  document.getElementById('odds-draw').value = selected.dataset.draw;
  document.getElementById('odds-away').value = selected.dataset.away;
});

document.getElementById('odds-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/admin/events/odds', {
      method: 'POST',
      body: JSON.stringify({
        eventId: oddsEventEl.value,
        markets: {
          homeWin: Number(document.getElementById('odds-home').value),
          draw: Number(document.getElementById('odds-draw').value),
          awayWin: Number(document.getElementById('odds-away').value)
        }
      })
    });
    setStatus('Odds updated. Clients now use these odds.');
    await loadEvents();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('settle-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/admin/settle', {
      method: 'POST',
      body: JSON.stringify({
        betId: document.getElementById('settle-bet-id').value,
        result: document.getElementById('settle-result').value
      })
    });
    setStatus('Bet settled successfully');
    e.target.reset();
    await loadLive();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('role-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/admin/users/role', {
      method: 'POST',
      body: JSON.stringify({
        userId: roleUserEl.value,
        role: roleValueEl.value
      })
    });
    setStatus('User role updated');
    await loadUsers();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('signal-approve-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/admin/signals/status', {
      method: 'POST',
      body: JSON.stringify({
        signalId: adminSignalEl.value,
        status: document.getElementById('admin-signal-status').value
      })
    });
    setStatus('Signal status updated');
    await loadSignalsAdmin();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('admin-logout-btn').addEventListener('click', async () => {
  try {
    await api('/logout', { method: 'POST' });
  } catch {
  }
  localStorage.removeItem('betpesa_token');
  token = '';
  if (refreshTimer) clearInterval(refreshTimer);
  if (adminAviatorFrame) cancelAnimationFrame(adminAviatorFrame);
  window.location.replace('/login');
});

(async function init() {
  try {
    const admin = await ensureAdmin();
    if (!admin) return;
    await loadEvents();
    await loadUsers();
    await loadSignalsAdmin();
    await loadLive();
    if (adminAviatorFrame) cancelAnimationFrame(adminAviatorFrame);
    drawAdminAviator();
    refreshTimer = setInterval(async () => {
      try {
        await loadLive();
        await loadSignalsAdmin();
      } catch {
      }
    }, 1000);
  } catch {
    localStorage.removeItem('betpesa_token');
    window.location.replace('/login');
  }
})();
