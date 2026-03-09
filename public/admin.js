const API = '/api';
let token = localStorage.getItem('betpesa_token') || '';

const statusEl = document.getElementById('admin-status');
const meEl = document.getElementById('admin-me');
const overviewEl = document.getElementById('admin-overview');
const aviatorEl = document.getElementById('admin-aviator');
const betsEl = document.getElementById('admin-bets');
const txRowsEl = document.getElementById('admin-tx-rows');
const adminSignalHistoryEl = document.getElementById('admin-signal-history');
const adminSignalLiveDisplayEl = document.getElementById('admin-signal-live-display');
const adminSignalTargetDisplayEl = document.getElementById('admin-signal-target-display');
const adminSignalUpcomingLiveEl = document.getElementById('admin-signal-upcoming-live');
const adminAviatorRoundEl = document.getElementById('admin-aviator-round');
const adminAviatorPhaseEl = document.getElementById('admin-aviator-phase');
const adminAviatorCountdownEl = document.getElementById('admin-aviator-countdown');
const adminAviatorMultiplierEl = document.getElementById('admin-aviator-multiplier');
const adminOddsLabelEl = document.getElementById('admin-odds-label');
const adminOddsValueEl = document.getElementById('admin-odds-value');
const adminAviatorCurrentOddEl = document.getElementById('admin-aviator-current-odd');
const adminAviatorLastOddEl = document.getElementById('admin-aviator-last-odd');
const adminAviatorNextOddEl = document.getElementById('admin-aviator-next-odd');
const adminAviatorModeEl = document.getElementById('admin-aviator-mode');
const adminAviatorOddsListEl = document.getElementById('admin-aviator-odds-list');
const oddsEventEl = document.getElementById('odds-event');
const roleUserEl = document.getElementById('role-user');
const roleValueEl = document.getElementById('role-value');
const adminSignalEl = document.getElementById('admin-signal');
const periodButtons = Array.from(document.querySelectorAll('.period-tabs [data-period]'));

let refreshTimer = null;
let adminAviatorState = null;
let overviewSnapshot = null;
let activePeriod = 'all';

function setBusy(el, busy, busyText = 'Processing...') {
  if (!el) return;
  if (!el.dataset.idleText) el.dataset.idleText = el.textContent || '';
  el.disabled = !!busy;
  el.textContent = busy ? busyText : el.dataset.idleText;
}

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

function periodFactor(period) {
  if (period === 'today') return 0.22;
  if (period === 'week') return 0.58;
  if (period === 'month') return 0.81;
  if (period === 'custom') return 0.47;
  return 1;
}

function renderOverviewCards(snapshot, period = 'all') {
  if (!snapshot) return;
  const f = periodFactor(period);
  overviewEl.innerHTML = `
    <article class="kpi-card kpi-blue"><small>Users</small><strong>${Math.max(1, Math.round(snapshot.users * f))}</strong></article>
    <article class="kpi-card kpi-green"><small>Revenue</small><strong>KES ${fmt(snapshot.revenue * f)}</strong></article>
    <article class="kpi-card kpi-gold"><small>Deposits</small><strong>KES ${fmt(snapshot.deposits * f)}</strong></article>
    <article class="kpi-card kpi-red"><small>Withdrawals</small><strong>KES ${fmt(snapshot.withdrawals * f)}</strong></article>
    <article class="kpi-card"><small>Total Bets</small><strong>KES ${fmt(snapshot.totalBets * f)}</strong></article>
    <article class="kpi-card"><small>Total Cashouts</small><strong>KES ${fmt(snapshot.totalCashouts * f)}</strong></article>
    <article class="kpi-card kpi-violet"><small>Transactions</small><strong>${Math.max(1, Math.round(snapshot.transactions * f))}</strong></article>
    <article class="kpi-card"><small>Net Cashflow</small><strong>KES ${fmt(snapshot.netCashflow * f)}</strong></article>
  `;
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
  overviewSnapshot = {
    users: Number(data.overview.users || 0),
    revenue: Number(data.finance?.deposits || 0),
    deposits: Number(data.finance?.deposits || 0),
    withdrawals: Number(data.finance?.withdrawals || 0),
    totalBets: Number(data.finance?.stakes || 0),
    totalCashouts: Number(data.finance?.payouts || 0),
    transactions: Number(data.overview.transactions || 0),
    netCashflow: Number(data.finance?.netCashflow || 0)
  };
  renderOverviewCards(overviewSnapshot, activePeriod);

  aviatorEl.innerHTML = `
    <div class="item">Round: <strong>${String(data.aviator.roundId || '-').slice(0, 8)}</strong></div>
    <div class="item">Phase: <strong>${phaseLabel(data.aviator.phase)}</strong></div>
    <div class="item">Live Multiplier: <strong>${fmt(data.aviator.multiplier)}x</strong></div>
  `;

  adminAviatorState = data.aviator;
  adminAviatorRoundEl.textContent = String(data.aviator.roundId || '-').slice(0, 8);
  adminAviatorPhaseEl.textContent = phaseLabel(data.aviator.phase || 'betting');
  adminAviatorCountdownEl.textContent = computeCountdown(data.aviator);
  adminAviatorMultiplierEl.textContent = `${fmt(data.aviator.multiplier || 1)}x`;
  const countdownText = adminAviatorCountdownEl.textContent || '';
  if (data.aviator.phase === 'flying') {
    adminOddsLabelEl.textContent = 'LIVE ODDS';
    adminOddsValueEl.textContent = `${fmt(data.aviator.multiplier || 1)}x`;
  } else {
    adminOddsLabelEl.textContent = 'NEXT ROUND IN';
    const secsMatch = countdownText.match(/(\d+)s/);
    adminOddsValueEl.textContent = secsMatch ? secsMatch[1] : '--';
  }

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

  txRowsEl.innerHTML = '';
  (data.recentBets || []).slice(0, 12).forEach((b) => {
    const tr = document.createElement('tr');
    const type = b.status === 'open' ? 'Bet' : b.status === 'won' ? 'Payout' : 'Bet';
    const amount = Number(b.stake || 0);
    tr.innerHTML = `
      <td>${new Date(b.createdAt || Date.now()).toLocaleString()}</td>
      <td class="tx-type">${type}</td>
      <td>${String(b.userId || 'system').slice(0, 10)}</td>
      <td class="${amount >= 0 ? 'tx-pos' : 'tx-neg'}">${amount >= 0 ? '+' : ''}KES ${fmt(Math.abs(amount))}</td>
      <td>${b.market || 'Aviator'}</td>
    `;
    txRowsEl.appendChild(tr);
  });
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
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  try {
    setBusy(submitBtn, true, 'Updating...');
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
  } finally {
    setBusy(submitBtn, false);
  }
});

document.getElementById('settle-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  try {
    setBusy(submitBtn, true, 'Settling...');
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
  } finally {
    setBusy(submitBtn, false);
  }
});

document.getElementById('role-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  try {
    setBusy(submitBtn, true, 'Applying...');
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
  } finally {
    setBusy(submitBtn, false);
  }
});

document.getElementById('signal-approve-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  try {
    setBusy(submitBtn, true, 'Applying...');
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
  } finally {
    setBusy(submitBtn, false);
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
    periodButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        activePeriod = btn.dataset.period || 'all';
        periodButtons.forEach((other) => other.classList.remove('active'));
        btn.classList.add('active');
        renderOverviewCards(overviewSnapshot, activePeriod);
        setStatus(`Overview switched to ${btn.textContent}`);
      });
    });
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
