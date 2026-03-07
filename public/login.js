const API = '/api';

const token = localStorage.getItem('betpesa_token');
if (token) {
  fetch('/api/me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        localStorage.removeItem('betpesa_token');
        return;
      }
      if (data.user?.isAdmin) {
        window.location.replace('/admin');
      } else if (data.user?.role === 'signal_provider') {
        window.location.replace('/signals-admin');
      } else {
        window.location.replace('/dashboard');
      }
    })
    .catch(() => {
      localStorage.removeItem('betpesa_token');
    });
}

const statusEl = document.getElementById('status');
const registerForm = document.getElementById('register-form');

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.style.color = error ? '#d93535' : '#1db954';
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('phone').value;
  const password = document.getElementById('password').value;

  try {
    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: phone, password })
    });
    localStorage.setItem('betpesa_token', data.token);
    setStatus('Login successful. Redirecting...');
    if (data.user?.isAdmin) {
      window.location.replace('/admin');
    } else if (data.user?.role === 'signal_provider') {
      window.location.replace('/signals-admin');
    } else {
      window.location.replace('/dashboard');
    }
  } catch (err) {
    setStatus(err.message, true);
  }
});

document.getElementById('show-register-btn').addEventListener('click', () => {
  registerForm.classList.toggle('hidden');
});

document.getElementById('forgot-btn').addEventListener('click', () => {
  setStatus('Forgot password flow not implemented yet.', true);
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    await api('/register', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('reg-username').value,
        fullName: document.getElementById('reg-fullname').value,
        email: document.getElementById('reg-email').value,
        phone: document.getElementById('reg-phone').value,
        password: document.getElementById('reg-password').value,
        dateOfBirth: document.getElementById('reg-dob').value,
        country: 'KE'
      })
    });

    registerForm.reset();
    registerForm.classList.add('hidden');
    setStatus('Registration successful. Login now.');
  } catch (err) {
    setStatus(err.message, true);
  }
});
