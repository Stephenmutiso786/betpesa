const API = '/api';
let token = localStorage.getItem('betpesa_token') || '';

const statusEl = document.getElementById('status');
const meLineEl = document.getElementById('me-line');
const walletBalanceEl = document.getElementById('wallet-balance');
const eventsEl = document.getElementById('events');
const betsEl = document.getElementById('bets');
const transactionsEl = document.getElementById('transactions');
const aviatorRoundEl = document.getElementById('aviator-round');
const aviatorPhaseEl = document.getElementById('aviator-phase');
const aviatorCountdownEl = document.getElementById('aviator-countdown');
const aviatorMultiplierEl = document.getElementById('aviator-multiplier');
const aviatorHistoryEl = document.getElementById('aviator-history');
const aviatorOddsCurrentEl = document.getElementById('aviator-odds-current');
const aviatorLastCrashEl = document.getElementById('aviator-last-crash');
const aviatorOddsListEl = document.getElementById('aviator-odds-list');
const aviatorFlewAwayEl = document.getElementById('aviator-flewaway');
const aviatorFlewAwayMultEl = document.getElementById('aviator-flewaway-mult');
const aviatorCashoutBtn = document.getElementById('aviator-cashout-btn');
const aviatorCanvas = document.getElementById('aviator-canvas');

let me = null;
let aviatorTimer = null;
let aviatorState = null;
let aviatorFrame = null;
let flightStartMs = Date.now();
let mpesaPollTimer = null;

function phaseLabel(phase) {
  return phase === 'crashed' ? 'flew away' : phase;
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

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.style.color = error ? '#d93535' : '#1db954';
}

function fmtMoney(value) {
  return Number(value || 0).toFixed(2);
}

function mustLogin() {
  if (!token) {
    window.location.replace('/login');
    return false;
  }
  return true;
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

async function refreshMe() {
  const data = await api('/me');
  me = data.user;
  meLineEl.textContent = `${me.username} | ${me.phone} | KYC: ${me.kycStatus}`;
  walletBalanceEl.textContent = fmtMoney(me.walletBalance);
}

async function renderEvents() {
  const { events } = await api('/events', { method: 'GET' });
  if (!events.length) {
    eventsEl.textContent = 'No events available';
    return;
  }

  eventsEl.innerHTML = '';
  events.forEach((event) => {
    const card = document.createElement('div');
    card.className = 'item';
    card.innerHTML = `
      <strong>${event.homeTeam} vs ${event.awayTeam}</strong>
      <small>${event.league} | ${new Date(event.startsAt).toLocaleString()}</small>
      <input id="stake-${event.id}" type="number" min="1" step="0.01" value="10" />
      <div class="market-row">
        <button data-event="${event.id}" data-market="homeWin">Home @ ${event.markets.homeWin}</button>
        <button data-event="${event.id}" data-market="draw">Draw @ ${event.markets.draw}</button>
        <button data-event="${event.id}" data-market="awayWin">Away @ ${event.markets.awayWin}</button>
      </div>
    `;

    card.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const stake = Number(document.getElementById(`stake-${event.id}`).value);
        try {
          await api('/bets', {
            method: 'POST',
            body: JSON.stringify({ eventId: btn.dataset.event, market: btn.dataset.market, stake })
          });
          setStatus('Bet placed');
          await refreshMe();
          await renderBets();
          await renderTransactions();
        } catch (err) {
          setStatus(err.message, true);
        }
      });
    });

    eventsEl.appendChild(card);
  });
}

async function renderBets() {
  const { bets } = await api('/bets?limit=40', { method: 'GET' });
  if (!bets.length) {
    betsEl.textContent = 'No bets yet';
    return;
  }

  betsEl.innerHTML = '';
  bets.forEach((bet) => {
    const item = document.createElement('div');
    item.className = `item ${bet.status}`;
    item.textContent = `${bet.eventId} | ${bet.market} | Stake ${fmtMoney(bet.stake)} | Potential ${fmtMoney(
      bet.potentialPayout
    )} | ${bet.status}`;
    betsEl.appendChild(item);
  });
}

async function renderTransactions() {
  const { transactions } = await api('/transactions?limit=40', { method: 'GET' });
  if (!transactions.length) {
    transactionsEl.textContent = 'No transactions yet';
    return;
  }

  transactionsEl.innerHTML = '';
  transactions.forEach((tx) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.textContent = `${String(tx.walletTxnType || 'transaction').toUpperCase()} ${fmtMoney(tx.amount)} | ${
      tx.reference
    }`;
    transactionsEl.appendChild(item);
  });
}

async function renderAviator() {
  const state = await api('/aviator/state', { method: 'GET' });
  if (!aviatorState || aviatorState.roundId !== state.roundId || aviatorState.phase !== state.phase) {
    flightStartMs = Date.now();
  }
  aviatorState = state;
  aviatorRoundEl.textContent = String(state.roundId || '-').slice(0, 8);
  aviatorPhaseEl.textContent = phaseLabel(state.phase);
  aviatorCountdownEl.textContent = computeCountdown(state);
  aviatorMultiplierEl.textContent = `${Number(state.multiplier || 1).toFixed(2)}x`;
  aviatorCashoutBtn.disabled = state.phase !== 'flying' || !state.userBet || state.userBet.cashedOut;
  if (aviatorFlewAwayEl && aviatorFlewAwayMultEl) {
    if (state.phase === 'crashed') {
      aviatorFlewAwayMultEl.textContent = `${Number(state.multiplier || 1).toFixed(2)}x`;
      aviatorFlewAwayEl.style.display = 'block';
    } else {
      aviatorFlewAwayEl.style.display = 'none';
    }
  }

  aviatorHistoryEl.innerHTML = '';
  const items = state.history || [];
  if (!items.length) {
    aviatorHistoryEl.textContent = 'No rounds finished yet';
    aviatorLastCrashEl.textContent = '-';
  } else {
    aviatorLastCrashEl.textContent = `${Number(items[0].crashPoint).toFixed(2)}x`;
    items.forEach((row) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.textContent = `${String(row.roundId).slice(0, 8)} flew away at ${Number(row.crashPoint).toFixed(2)}x`;
      aviatorHistoryEl.appendChild(item);
    });
  }

  aviatorOddsCurrentEl.textContent = `${Number(state.multiplier || 1).toFixed(2)}x`;
  aviatorOddsListEl.innerHTML = '';
  (state.history || []).slice(0, 12).forEach((row) => {
    const chip = document.createElement('span');
    chip.className = 'signal-chip';
    chip.textContent = `${Number(row.crashPoint).toFixed(2)}x`;
    aviatorOddsListEl.appendChild(chip);
  });
}

function drawAviator() {
  if (!aviatorCanvas) return;
  const ctx = aviatorCanvas.getContext('2d');
  const w = aviatorCanvas.width;
  const h = aviatorCanvas.height;

  ctx.clearRect(0, 0, w, h);
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

  const phase = aviatorState?.phase || 'betting';
  const displayMultiplier = Number(aviatorState?.multiplier || 1);
  const elapsed = (Date.now() - flightStartMs) / 1000;
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
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    if (phase === 'flying') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,95,109,0.35)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  if (points.length) {
    const p = points[points.length - 1];
    const prev = points[Math.max(0, points.length - 2)];
    const angle = Math.atan2(p.y - prev.y, p.x - prev.x);

    // Draw stylized red aviator plane aligned to the curve.
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

    if (phase === 'flying') {
      ctx.fillStyle = 'rgba(255, 70, 90, 0.6)';
      ctx.beginPath();
      ctx.arc(p.x - 8, p.y + 1, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#c3d1df';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Phase: ${phaseLabel(phase)}`, 20, 24);
  ctx.fillText(`Multiplier: ${displayMultiplier.toFixed(2)}x`, 20, 44);

  aviatorFrame = requestAnimationFrame(drawAviator);
}

async function safeLoad() {
  if (!mustLogin()) return;
  try {
    await refreshMe();
    if (me?.isAdmin) {
      window.location.replace('/admin');
      return;
    }
    document.getElementById('mpesa-phone').value = me.phone || '';
    await renderAviator();
    await renderEvents();
    await renderBets();
    await renderTransactions();
    if (aviatorTimer) clearInterval(aviatorTimer);
    if (aviatorFrame) cancelAnimationFrame(aviatorFrame);
    aviatorTimer = setInterval(async () => {
      try {
        await renderAviator();
      } catch {
      }
    }, 1000);
    drawAviator();
  } catch (err) {
    localStorage.removeItem('betpesa_token');
    token = '';
    window.location.replace('/login');
  }
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await api('/logout', { method: 'POST' });
  } catch {
  }
  localStorage.removeItem('betpesa_token');
  token = '';
  if (aviatorTimer) clearInterval(aviatorTimer);
  if (aviatorFrame) cancelAnimationFrame(aviatorFrame);
  if (mpesaPollTimer) clearInterval(mpesaPollTimer);
  window.location.replace('/login');
});

document.getElementById('mpesa-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/payments/mpesa/stkpush', {
      method: 'POST',
      body: JSON.stringify({
        phone: document.getElementById('mpesa-phone').value,
        amount: document.getElementById('mpesa-amount').value
      })
    });

    const checkoutRequestId = data.checkoutRequestId;
    setStatus('STK sent. Enter M-Pesa PIN on your phone.');

    if (mpesaPollTimer) clearInterval(mpesaPollTimer);
    mpesaPollTimer = setInterval(async () => {
      try {
        const status = await api(`/payments/mpesa/stkpush/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`, {
          method: 'GET'
        });
        if (status.status === 'completed') {
          clearInterval(mpesaPollTimer);
          mpesaPollTimer = null;
          setStatus('M-Pesa deposit successful.');
          await refreshMe();
          await renderTransactions();
        } else if (status.status === 'failed') {
          clearInterval(mpesaPollTimer);
          mpesaPollTimer = null;
          setStatus(`M-Pesa failed: ${status.resultDesc || 'Request failed'}`, true);
        }
      } catch {
      }
    }, 4000);
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('aviator-bet-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/aviator/bet', {
      method: 'POST',
      body: JSON.stringify({ stake: document.getElementById('aviator-stake').value })
    });
    setStatus('Aviator bet placed');
    await refreshMe();
    await renderAviator();
    await renderTransactions();
  } catch (err) {
    setStatus(err.message, true);
  }
});

aviatorCashoutBtn.addEventListener('click', async () => {
  try {
    const data = await api('/aviator/cashout', { method: 'POST' });
    setStatus(`Cashed out at ${Number(data.cashoutMultiplier).toFixed(2)}x for KES ${fmtMoney(data.payout)}`);
    await refreshMe();
    await renderAviator();
    await renderTransactions();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: document.getElementById('withdraw-amount').value })
    });
    e.target.reset();
    await refreshMe();
    await renderTransactions();
    setStatus('Withdrawal successful');
  } catch (err) {
    setStatus(err.message, true);
  }
});

safeLoad();
