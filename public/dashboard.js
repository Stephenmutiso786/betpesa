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
const aviatorAutoBtn = document.getElementById('aviator-auto-btn');
const aviatorCashModeBtn = document.getElementById('aviator-cash-mode-btn');
const aviatorCashTargetInput = document.getElementById('aviator-cash-target');
const joinNowBtn = document.getElementById('join-now-btn');
const clientMenuBtn = document.getElementById('client-menu-btn');
const clientMenuPanel = document.getElementById('client-menu-panel');
const clientMenuClose = document.getElementById('client-menu-close');

let me = null;
let aviatorTimer = null;
let aviatorState = null;
let aviatorFrame = null;
let flightStartMs = Date.now();
let mpesaPollTimer = null;
let autoCashoutArmed = false;
let autoCashoutInFlight = false;

function setBusy(el, busy, busyText = 'Processing...') {
  if (!el) return;
  if (!el.dataset.idleText) el.dataset.idleText = el.textContent || '';
  el.disabled = !!busy;
  el.textContent = busy ? busyText : el.dataset.idleText;
}

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

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  if (
    autoCashoutArmed &&
    !autoCashoutInFlight &&
    state.phase === 'flying' &&
    state.userBet &&
    !state.userBet.cashedOut &&
    Number(state.multiplier || 1) >= Number(aviatorCashTargetInput.value || 2)
  ) {
    autoCashoutInFlight = true;
    try {
      const data = await api('/aviator/cashout', { method: 'POST' });
      setStatus(`Auto cashout at ${Number(data.cashoutMultiplier).toFixed(2)}x for KES ${fmtMoney(data.payout)}`);
      await refreshMe();
      await renderTransactions();
    } catch (err) {
      setStatus(`Auto cashout failed: ${err.message}`, true);
    } finally {
      autoCashoutInFlight = false;
    }
  }
}

function drawAviator() {
  if (!aviatorCanvas) return;
  const ctx = aviatorCanvas.getContext('2d');
  const w = aviatorCanvas.width;
  const h = aviatorCanvas.height;

  ctx.clearRect(0, 0, w, h);
  const grd = ctx.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, '#111827');
  grd.addColorStop(0.45, '#0a101c');
  grd.addColorStop(1, '#05080f');
  ctx.fillRect(0, 0, w, h);

  // Draw spotlight rays from bottom-left to match classic aviator look.
  const ox = -40;
  const oy = h + 18;
  for (let i = 0; i < 20; i += 1) {
    const a1 = -1.55 + i * 0.12;
    const a2 = a1 + 0.07;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(a1) * (w * 2), oy + Math.sin(a1) * (w * 2));
    ctx.lineTo(ox + Math.cos(a2) * (w * 2), oy + Math.sin(a2) * (w * 2));
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.18)';
    ctx.fill();
  }

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
    // Fill area below the curve for the classic aviator look.
    ctx.save();
    const fill = ctx.createLinearGradient(0, h, 0, h * 0.25);
    fill.addColorStop(0, 'rgba(209, 12, 54, 0.52)');
    fill.addColorStop(1, 'rgba(209, 12, 54, 0.08)');
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, h - 2);
    points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(points[points.length - 1].x, h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#ff214f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    if (phase === 'flying') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,95,109,0.32)';
      ctx.setLineDash([10, 6]);
      ctx.lineWidth = 2;
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

    // Draw a side-view red propeller plane silhouette.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    // Subtle shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 7, 16, 4, 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f30f44';
    // Fuselage + tail
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(10, -4);
    ctx.lineTo(-2, -4);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-9, -2);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-9, 2);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-2, 4);
    ctx.lineTo(10, 4);
    ctx.closePath();
    ctx.fill();

    // Top wing
    ctx.fillStyle = '#cf0c39';
    ctx.beginPath();
    ctx.moveTo(8, -1);
    ctx.lineTo(-3, -10);
    ctx.lineTo(6, -6);
    ctx.lineTo(13, -2);
    ctx.closePath();
    ctx.fill();

    // Bottom wing
    ctx.beginPath();
    ctx.moveTo(8, 1);
    ctx.lineTo(-3, 10);
    ctx.lineTo(6, 6);
    ctx.lineTo(13, 2);
    ctx.closePath();
    ctx.fill();

    // Cockpit / X mark
    ctx.fillStyle = '#820a24';
    ctx.fillRect(4, -2, 4, 4);
    ctx.strokeStyle = '#ff6e8c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(9, -3);
    ctx.lineTo(13, 1);
    ctx.moveTo(13, -3);
    ctx.lineTo(9, 1);
    ctx.stroke();

    // Tail fin
    ctx.fillStyle = '#ff567a';
    ctx.beginPath();
    ctx.moveTo(-11, -2);
    ctx.lineTo(-14, -9);
    ctx.lineTo(-9, -5);
    ctx.closePath();
    ctx.fill();

    // Propeller
    ctx.strokeStyle = '#ff8ea7';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(22, 0, 4.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, -4.3);
    ctx.lineTo(22, 4.3);
    ctx.moveTo(17.7, 0);
    ctx.lineTo(26.3, 0);
    ctx.stroke();

    ctx.restore();

    if (phase === 'flying') {
      ctx.fillStyle = 'rgba(255, 70, 90, 0.6)';
      ctx.beginPath();
      ctx.arc(p.x - 8, p.y + 1, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Intentionally keep HUD clean (only center multiplier in page UI).

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

joinNowBtn.addEventListener('click', () => {
  scrollToSection('client-wallet-section');
  document.getElementById('mpesa-amount')?.focus();
  setStatus('Open wallet section and deposit to join referral campaign');
});

aviatorAutoBtn.addEventListener('click', () => {
  autoCashoutArmed = !autoCashoutArmed;
  aviatorAutoBtn.classList.toggle('active', autoCashoutArmed);
  setStatus(autoCashoutArmed ? 'Auto cashout armed' : 'Auto cashout disabled');
});

aviatorCashModeBtn.addEventListener('click', () => {
  const editable = aviatorCashTargetInput.hasAttribute('readonly');
  if (editable) {
    aviatorCashTargetInput.removeAttribute('readonly');
    aviatorCashModeBtn.classList.add('active');
    setStatus('Cash target editable');
  } else {
    aviatorCashTargetInput.setAttribute('readonly', 'readonly');
    aviatorCashModeBtn.classList.remove('active');
    setStatus('Cash target locked');
  }
});

aviatorCashTargetInput.addEventListener('change', () => {
  const val = Number(aviatorCashTargetInput.value || 2);
  if (!Number.isFinite(val) || val < 1.1) {
    aviatorCashTargetInput.value = '2.00';
    setStatus('Cash target reset to 2.00x', true);
    return;
  }
  aviatorCashTargetInput.value = val.toFixed(2);
});

document.querySelectorAll('[data-nav-target]').forEach((btn) => {
  btn.addEventListener('click', () => {
    scrollToSection(btn.dataset.navTarget);
    clientMenuPanel?.classList.add('hidden');
  });
});

clientMenuBtn.addEventListener('click', () => {
  clientMenuPanel.classList.toggle('hidden');
});

clientMenuClose.addEventListener('click', () => {
  clientMenuPanel.classList.add('hidden');
});

document.getElementById('mpesa-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  try {
    setBusy(submitBtn, true, 'Sending STK...');
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
  } finally {
    setBusy(submitBtn, false);
  }
});

document.getElementById('aviator-bet-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  try {
    setBusy(submitBtn, true, 'Placing...');
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
  } finally {
    setBusy(submitBtn, false);
  }
});

aviatorCashoutBtn.addEventListener('click', async () => {
  if (aviatorCashoutBtn.disabled) return;
  try {
    setBusy(aviatorCashoutBtn, true, 'Cashing out...');
    const data = await api('/aviator/cashout', { method: 'POST' });
    setStatus(`Cashed out at ${Number(data.cashoutMultiplier).toFixed(2)}x for KES ${fmtMoney(data.payout)}`);
    await refreshMe();
    await renderAviator();
    await renderTransactions();
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    setBusy(aviatorCashoutBtn, false);
  }
});

document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  try {
    setBusy(submitBtn, true, 'Withdrawing...');
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
  } finally {
    setBusy(submitBtn, false);
  }
});

safeLoad();
