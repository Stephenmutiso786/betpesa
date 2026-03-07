const API = '/api';
let authToken = localStorage.getItem('betpesa_token') || '';

const statusEl = document.getElementById('status');
const walletBalanceEl = document.getElementById('wallet-balance');
const meLineEl = document.getElementById('me-line');
const eventsEl = document.getElementById('events');
const betsEl = document.getElementById('bets');
const transactionsEl = document.getElementById('transactions');
const adminOutputEl = document.getElementById('admin-output');

let me = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b42318' : '#006e4e';
}

function fmtMoney(value) {
  return Number(value || 0).toFixed(2);
}

function adminHeaders() {
  const secret = document.getElementById('admin-secret').value.trim();
  return secret ? { 'x-admin-secret': secret } : {};
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

async function refreshMe() {
  if (!authToken) {
    me = null;
    meLineEl.textContent = 'Not logged in';
    walletBalanceEl.textContent = '0.00';
    return;
  }

  try {
    const data = await api('/me');
    me = data.user;
    meLineEl.textContent = `${me.username} | KYC: ${me.kycStatus} | Limit: ${fmtMoney(me.dailyDepositLimit)} | Self-excluded until: ${me.selfExcludedUntil || 'none'}`;
    walletBalanceEl.textContent = fmtMoney(me.walletBalance);

    document.getElementById('profile-fullname').value = me.fullName || '';
    document.getElementById('profile-phone').value = me.phone || '';
    document.getElementById('profile-country').value = me.country || '';
    document.getElementById('profile-limit').value = me.dailyDepositLimit || '';
  } catch {
    authToken = '';
    me = null;
    localStorage.removeItem('betpesa_token');
    meLineEl.textContent = 'Session expired. Login again.';
    walletBalanceEl.textContent = '0.00';
  }
}

async function renderEvents() {
  eventsEl.textContent = 'Loading events...';
  try {
    const { events } = await api('/events', { method: 'GET' });
    if (!events.length) {
      eventsEl.textContent = 'No open events available';
      return;
    }

    eventsEl.innerHTML = '';
    events.forEach((event) => {
      const div = document.createElement('div');
      div.className = 'event';
      div.innerHTML = `
        <h3>${event.homeTeam} vs ${event.awayTeam}</h3>
        <small>${event.league} | Starts ${new Date(event.startsAt).toLocaleString()}</small>
        <label>Stake (KES)
          <input id="stake-${event.id}" type="number" min="1" step="0.01" value="10" />
        </label>
        <div class="markets">
          <button data-event="${event.id}" data-market="homeWin">Home @ ${event.markets.homeWin}</button>
          <button data-event="${event.id}" data-market="draw">Draw @ ${event.markets.draw}</button>
          <button data-event="${event.id}" data-market="awayWin">Away @ ${event.markets.awayWin}</button>
        </div>
      `;

      div.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', async () => {
          if (!authToken) {
            setStatus('Login first', true);
            return;
          }

          const stake = Number(document.getElementById(`stake-${event.id}`).value);
          try {
            await api('/bets', {
              method: 'POST',
              body: JSON.stringify({
                eventId: button.dataset.event,
                market: button.dataset.market,
                stake
              })
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

      eventsEl.appendChild(div);
    });
  } catch (err) {
    eventsEl.textContent = err.message;
  }
}

async function renderBets() {
  if (!authToken) {
    betsEl.textContent = 'Login to see your bets';
    return;
  }

  try {
    const { bets } = await api('/bets?limit=40', { method: 'GET' });
    if (!bets.length) {
      betsEl.textContent = 'No bets yet';
      return;
    }

    betsEl.innerHTML = '';
    bets.forEach((bet) => {
      const div = document.createElement('div');
      div.className = `bet ${bet.status}`;
      div.innerHTML = `${bet.id}<br>${bet.eventId} ${bet.market} | Stake ${fmtMoney(bet.stake)} | Potential ${fmtMoney(bet.potentialPayout)} | ${bet.status}`;
      betsEl.appendChild(div);
    });
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function renderTransactions() {
  if (!authToken) {
    transactionsEl.textContent = 'Login to see transactions';
    return;
  }

  try {
    const { transactions } = await api('/transactions?limit=40', { method: 'GET' });
    if (!transactions.length) {
      transactionsEl.textContent = 'No transactions yet';
      return;
    }

    transactionsEl.innerHTML = '';
    transactions.forEach((tx) => {
      const div = document.createElement('div');
      div.className = 'txn';
      const label = String(tx.type || tx.walletTxnType || 'transaction').toUpperCase();
      div.textContent = `${label} ${fmtMoney(tx.amount)} (${tx.reference}) ${new Date(tx.createdAt).toLocaleString()}`;
      transactionsEl.appendChild(div);
    });
  } catch (err) {
    setStatus(err.message, true);
  }
}

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/register', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('reg-username').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        dateOfBirth: document.getElementById('reg-dob').value,
        fullName: document.getElementById('reg-fullname').value,
        phone: document.getElementById('reg-phone').value,
        country: 'KE'
      })
    });
    e.target.reset();
    setStatus('Registration completed. Login now.');
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      })
    });
    authToken = data.token;
    localStorage.setItem('betpesa_token', authToken);
    e.target.reset();
    setStatus('Login successful');
    await refreshMe();
    await renderBets();
    await renderTransactions();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  if (!authToken) return;
  try {
    await api('/logout', { method: 'POST' });
  } catch {
  }
  authToken = '';
  localStorage.removeItem('betpesa_token');
  setStatus('Logged out');
  await refreshMe();
  await renderBets();
  await renderTransactions();
});

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!authToken) {
    setStatus('Login first', true);
    return;
  }

  try {
    await api('/profile', {
      method: 'POST',
      body: JSON.stringify({
        fullName: document.getElementById('profile-fullname').value,
        phone: document.getElementById('profile-phone').value,
        country: document.getElementById('profile-country').value,
        dailyDepositLimit: document.getElementById('profile-limit').value,
        selfExcludeDays: Number(document.getElementById('profile-self-exclude').value)
      })
    });
    setStatus('Profile settings saved');
    await refreshMe();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('kyc-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!authToken) {
    setStatus('Login first', true);
    return;
  }
  try {
    await api('/kyc/submit', {
      method: 'POST',
      body: JSON.stringify({ idNumber: document.getElementById('kyc-id').value })
    });
    e.target.reset();
    setStatus('KYC submitted. Wait for admin review.');
    await refreshMe();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('deposit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!authToken) {
    setStatus('Login first', true);
    return;
  }
  try {
    await api('/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount: document.getElementById('deposit-amount').value })
    });
    e.target.reset();
    setStatus('Deposit successful');
    await refreshMe();
    await renderTransactions();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!authToken) {
    setStatus('Login first', true);
    return;
  }
  try {
    await api('/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: document.getElementById('withdraw-amount').value })
    });
    e.target.reset();
    setStatus('Withdrawal successful');
    await refreshMe();
    await renderTransactions();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('admin-event-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const startsLocal = document.getElementById('admin-starts').value;
    const startsAt = new Date(startsLocal).toISOString();
    const data = await api('/admin/events', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        league: document.getElementById('admin-league').value,
        homeTeam: document.getElementById('admin-home').value,
        awayTeam: document.getElementById('admin-away').value,
        startsAt,
        markets: {
          homeWin: Number(document.getElementById('admin-odd-home').value),
          draw: Number(document.getElementById('admin-odd-draw').value),
          awayWin: Number(document.getElementById('admin-odd-away').value)
        }
      })
    });
    adminOutputEl.textContent = JSON.stringify(data, null, 2);
    setStatus('Event created');
    await renderEvents();
    e.target.reset();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('admin-settle-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/admin/settle', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        betId: document.getElementById('admin-bet-id').value,
        result: document.getElementById('admin-result').value
      })
    });
    adminOutputEl.textContent = JSON.stringify(data, null, 2);
    setStatus('Bet settled');
    await renderBets();
    await refreshMe();
    await renderTransactions();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('admin-kyc-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/admin/kyc', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        userId: document.getElementById('admin-kyc-user').value,
        status: document.getElementById('admin-kyc-status').value
      })
    });
    adminOutputEl.textContent = JSON.stringify(data, null, 2);
    setStatus('KYC updated');
    await refreshMe();
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('admin-overview-btn').addEventListener('click', async () => {
  try {
    const data = await api('/admin/overview', {
      method: 'GET',
      headers: adminHeaders()
    });
    adminOutputEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    setStatus(err.message, true);
  }
});

(async function init() {
  await renderEvents();
  await refreshMe();
  await renderBets();
  await renderTransactions();
})();
