const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const JsonRepo = require('./repos/json-repo');
const { MemorySessionStore, RedisSessionStore } = require('./stores/session-store');
const { MemoryRateLimitStore, RedisRateLimitStore } = require('./stores/rate-limit-store');

function envNumber(name, fallback) {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const PORT = envNumber('PORT', 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const SESSION_TTL_HOURS = envNumber('SESSION_TTL_HOURS', 24 * 7);
const MAX_STAKE = envNumber('MAX_STAKE', 5000);
const DEFAULT_DAILY_DEPOSIT_LIMIT = envNumber('DEFAULT_DAILY_DEPOSIT_LIMIT', 1000);
const DATABASE_URL = process.env.DATABASE_URL || '';
const REDIS_URL = process.env.REDIS_URL || '';
const MPESA_ENV = (process.env.MPESA_ENV || 'sandbox').toLowerCase();
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || '';
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL || '';
const MPESA_TRANSACTION_TYPE = process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline';

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let repo;
let sessionStore;
let rateLimitStore;
let bootReady = false;
let bootError = null;

const AVIATOR_BETTING_MS = envNumber('AVIATOR_BETTING_MS', 10000);
const AVIATOR_ROUND_GAP_MS = envNumber('AVIATOR_ROUND_GAP_MS', 6000);
const AVIATOR_TICK_MS = envNumber('AVIATOR_TICK_MS', 200);
const AVIATOR_MAX_BET = envNumber('AVIATOR_MAX_BET', 5000);

const aviator = {
  roundId: null,
  phase: 'betting',
  startedAt: null,
  bettingClosesAt: null,
  crashedAt: null,
  crashPoint: 1.5,
  multiplier: 1.0,
  growthFactor: 0.14,
  roundHasBets: false,
  bets: new Map(),
  history: [],
  timer: null,
  signalTimer: null,
  signalQueue: [],
  nextSignalAt: null
};

const mpesaState = {
  token: null,
  tokenExpiresAt: 0,
  pending: new Map()
};

function nowIso() {
  return new Date().toISOString();
}

function roundMoney(amount) {
  return Number(Number(amount).toFixed(2));
}

function roundMultiplier(value) {
  return Number(Number(value).toFixed(2));
}

function randomCrashPoint() {
  const r = Math.random();
  const weighted = 1 + Math.pow(r, 2.6) * 11;
  return roundMultiplier(Math.max(1.01, weighted));
}

function randomSignalValue(hasBets) {
  if (hasBets) {
    // If at least one bet exists, keep odds tight: >1 and <1.98
    return roundMultiplier(1.01 + Math.random() * 0.96);
  }
  // If no bets, push high teaser signals: >8 and <80
  return roundMultiplier(8.01 + Math.random() * 71.8);
}

function refillAviatorSignals() {
  const hasBets = aviator.roundHasBets;
  if (!aviator.signalQueue.length) {
    for (let i = 0; i < 5; i += 1) {
      aviator.signalQueue.push(randomSignalValue(hasBets));
    }
  } else {
    aviator.signalQueue.shift();
    aviator.signalQueue.push(randomSignalValue(hasBets));
  }
  aviator.nextSignalAt = new Date(Date.now() + 5000).toISOString();
}

function startSignalGenerator() {
  if (aviator.signalTimer) clearInterval(aviator.signalTimer);
  refillAviatorSignals();
  aviator.signalTimer = setInterval(() => {
    refillAviatorSignals();
  }, 5000);
}

function aviatorPublicState(user = null) {
  const userId = user?.id || null;
  const userBet = userId ? aviator.bets.get(userId) || null : null;
  const canViewAdminSignal = isAdminUser(user) || isSignalProviderUser(user);

  const payload = {
    roundId: aviator.roundId,
    phase: aviator.phase,
    multiplier: roundMultiplier(aviator.multiplier),
    bettingClosesAt: aviator.bettingClosesAt,
    crashedAt: aviator.crashedAt,
    history: aviator.history,
    userBet: userBet
      ? {
          stake: userBet.stake,
          cashedOut: userBet.cashedOut,
          cashoutMultiplier: userBet.cashoutMultiplier || null,
          payout: userBet.payout || null
        }
      : null,
    signalClient: {
      live: roundMultiplier(aviator.multiplier)
    }
  };

  if (canViewAdminSignal) {
    const upcoming = [...aviator.signalQueue];
    payload.signalAdmin = {
      live: roundMultiplier(aviator.multiplier),
      target: roundMultiplier(upcoming[0] || 2.0),
      upcoming,
      nextSignalAt: aviator.nextSignalAt,
      mode: aviator.roundHasBets ? 'active_bets_low_range' : 'no_bets_high_range'
    };
  } else {
    payload.signalAdmin = null;
  }

  return payload;
}

function startAviatorRound() {
  if (aviator.timer) clearInterval(aviator.timer);

  aviator.roundId = crypto.randomUUID();
  aviator.phase = 'betting';
  aviator.startedAt = null;
  aviator.crashedAt = null;
  aviator.multiplier = 1.0;
  aviator.roundHasBets = false;
  aviator.signalQueue = [];
  refillAviatorSignals();
  aviator.crashPoint = randomCrashPoint();
  aviator.growthFactor = 0.135 + Math.random() * 0.04;
  aviator.bettingClosesAt = new Date(Date.now() + AVIATOR_BETTING_MS).toISOString();
  aviator.bets = new Map();

  setTimeout(() => {
    aviator.phase = 'flying';
    aviator.startedAt = Date.now();
    aviator.timer = setInterval(() => {
      const elapsed = (Date.now() - aviator.startedAt) / 1000;
      aviator.multiplier = 1 + elapsed * aviator.growthFactor + elapsed * elapsed * 0.05;

      if (aviator.multiplier >= aviator.crashPoint) {
        clearInterval(aviator.timer);
        aviator.timer = null;
        aviator.phase = 'crashed';
        aviator.multiplier = aviator.crashPoint;
        aviator.crashedAt = nowIso();

        aviator.history.unshift({
          roundId: aviator.roundId,
          crashPoint: roundMultiplier(aviator.crashPoint),
          crashedAt: aviator.crashedAt
        });
        aviator.history = aviator.history.slice(0, 15);

        setTimeout(() => {
          startAviatorRound();
        }, AVIATOR_ROUND_GAP_MS);
      }
    }, AVIATOR_TICK_MS);
  }, AVIATOR_BETTING_MS);
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
  });
  res.end(JSON.stringify(payload));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = String(stored || '').split(':');
  if (!salt || !originalHash) return false;
  const currentHash = crypto.pbkdf2Sync(String(password || ''), salt, 310000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(currentHash));
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new ApiError(413, 'Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new ApiError(400, 'Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function safePathname(pathname) {
  const normalized = path.normalize(pathname === '/' ? '/index.html' : pathname);
  const target = path.join(PUBLIC_DIR, normalized);
  if (!target.startsWith(PUBLIC_DIR)) return null;
  return target;
}

function sendStaticFile(res, pathname) {
  const target = safePathname(pathname);
  if (!target) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };

    const ext = path.extname(target);
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

async function enforceRateLimit(req, routeKey, maxHits, windowMs) {
  const key = `${routeKey}:${getClientIp(req)}`;
  const count = await rateLimitStore.increment(key, windowMs);
  if (count > maxHits) {
    throw new ApiError(429, 'Too many requests. Try again later.');
  }
}

function trim(value) {
  return String(value || '').trim();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function loginIdentifier(value) {
  return String(value || '').trim();
}

function normalizeKenyaPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
  return null;
}

function mpesaBaseUrl() {
  return MPESA_ENV === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}

function mpesaTimestamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}${hh}${mm}${ss}`;
}

async function getMpesaAccessToken() {
  if (mpesaState.token && mpesaState.tokenExpiresAt > Date.now() + 20_000) {
    return mpesaState.token;
  }

  const creds = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await fetch(`${mpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${creds}`
    }
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new ApiError(502, 'Failed to get M-Pesa access token');
  }

  mpesaState.token = data.access_token;
  mpesaState.tokenExpiresAt = Date.now() + Number(data.expires_in || 3599) * 1000;
  return mpesaState.token;
}

function ensureMpesaConfigured() {
  const missing = [];
  if (!MPESA_CONSUMER_KEY) missing.push('MPESA_CONSUMER_KEY');
  if (!MPESA_CONSUMER_SECRET) missing.push('MPESA_CONSUMER_SECRET');
  if (!MPESA_SHORTCODE) missing.push('MPESA_SHORTCODE');
  if (!MPESA_PASSKEY) missing.push('MPESA_PASSKEY');
  if (!MPESA_CALLBACK_URL) missing.push('MPESA_CALLBACK_URL');
  if (missing.length) {
    throw new ApiError(503, `M-Pesa not configured. Missing: ${missing.join(', ')}`);
  }
}

function parseMoney(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, `${field} must be greater than 0`);
  }
  return roundMoney(parsed);
}

function ageFromDob(dob) {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
  const dayDiff = today.getUTCDate() - birth.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

function isSelfExcluded(user) {
  if (!user.selfExcludedUntil && !user.self_excluded_until) return false;
  const until = user.selfExcludedUntil || user.self_excluded_until;
  return new Date(until).getTime() > Date.now();
}

function normalizeUser(user) {
  if (!user) return null;
  const normalized = {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName ?? user.full_name ?? '',
    phone: user.phone ?? '',
    country: user.country ?? 'KE',
    dateOfBirth: user.dateOfBirth ?? user.date_of_birth ?? null,
    walletBalance: roundMoney(user.walletBalance ?? user.wallet_balance ?? 0),
    kycStatus: user.kycStatus ?? user.kyc_status ?? 'unverified',
    role: user.role || 'user',
    dailyDepositLimit: roundMoney(user.dailyDepositLimit ?? user.daily_deposit_limit ?? DEFAULT_DAILY_DEPOSIT_LIMIT),
    selfExcludedUntil: user.selfExcludedUntil ?? user.self_excluded_until ?? null,
    createdAt: user.createdAt ?? user.created_at ?? nowIso()
  };
  normalized.isAdmin = normalized.role === 'super_admin' || String(normalized.username || '').toLowerCase() === 'caleb';
  return normalized;
}

function requireAdmin(req) {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    throw new ApiError(403, 'Forbidden');
  }
}

function isAdminUser(user) {
  return user?.role === 'super_admin' || String(user?.username || '').toLowerCase() === 'caleb';
}

function isSignalProviderUser(user) {
  return user?.role === 'super_admin' || user?.role === 'signal_provider';
}

function assertCanBet(user) {
  if (isSelfExcluded(user)) throw new ApiError(403, 'Account is currently self-excluded');
  if (user.kycStatus === 'blocked') throw new ApiError(403, 'Account blocked by compliance');
}

async function addAudit(actorType, actorId, action, entityType, entityId, metadata) {
  await repo.addAudit({
    id: crypto.randomUUID(),
    actorType,
    actorId,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: nowIso()
  });
}

async function createSession(userId, req) {
  const exp = Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000;
  const jti = crypto.randomUUID();
  const token = signToken({ sub: userId, exp, jti });
  const ttlSeconds = Math.max(1, Math.floor((exp - Date.now()) / 1000));

  await sessionStore.set(jti, userId, ttlSeconds);
  await repo.createSession({
    userId,
    jti,
    expiresAt: new Date(exp).toISOString(),
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || ''
  });

  return token;
}

async function getSessionUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || !payload.sub || !payload.exp || !payload.jti) return null;
  if (payload.exp < Date.now()) return null;

  const active = await sessionStore.has(payload.jti);
  if (!active) {
    const dbHas = await repo.hasSessionJti(payload.jti);
    if (!dbHas) return null;
  }

  const user = normalizeUser(await repo.getUserById(payload.sub));
  if (!user) return null;
  return { user, token, jti: payload.jti };
}

async function handleApi(req, res, urlObj) {
  const pathname = urlObj.pathname;

  if (req.method === 'POST' && pathname === '/api/register') {
    await enforceRateLimit(req, 'register', 15, 15 * 60_000);

    const body = await parseBody(req);
    const email = trim(body.email).toLowerCase();
    const username = trim(body.username);
    const password = String(body.password || '');
    const dateOfBirth = trim(body.dateOfBirth);
    const phone = normalizePhone(body.phone);

    if (!validateEmail(email)) throw new ApiError(400, 'Valid email is required');
    if (username.length < 3 || username.length > 24) throw new ApiError(400, 'Username must be 3-24 characters');
    if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');
    if (!phone) throw new ApiError(400, 'Valid phone number is required');

    const age = ageFromDob(dateOfBirth);
    if (!age || age < 18) throw new ApiError(400, 'You must be at least 18 years old');

    const existing = await repo.getUserByEmail(email);
    if (existing) throw new ApiError(409, 'Email already exists');
    const existingPhone = await repo.getUserByPhone(phone);
    if (existingPhone) throw new ApiError(409, 'Phone number already exists');

    const user = normalizeUser(
      await repo.createUser({
        id: crypto.randomUUID(),
        email,
        username,
        role: 'user',
        passwordHash: hashPassword(password),
        fullName: trim(body.fullName),
        phone,
        country: trim(body.country || 'KE').toUpperCase(),
        dateOfBirth,
        walletBalance: 0,
        kycStatus: 'unverified',
        dailyDepositLimit: DEFAULT_DAILY_DEPOSIT_LIMIT,
        selfExcludedUntil: null,
        createdAt: nowIso()
      })
    );

    await addAudit('user', user.id, 'register', 'user', user.id, { email: user.email });
    return json(res, 201, { user });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    await enforceRateLimit(req, 'login', 20, 15 * 60_000);

    const body = await parseBody(req);
    const identifier = loginIdentifier(body.identifier || body.phone || body.username || body.email);
    const password = String(body.password || '');
    if (!identifier) throw new ApiError(400, 'Phone, username, or email is required');

    const asPhone = normalizePhone(identifier);
    const asEmail = validateEmail(identifier) ? identifier.toLowerCase() : null;
    const rawUser =
      (asPhone ? await repo.getUserByPhone(asPhone) : null) ||
      (asEmail ? await repo.getUserByEmail(asEmail) : null) ||
      (await repo.getUserByUsername(identifier));
    if (!rawUser || !verifyPassword(password, rawUser.passwordHash || rawUser.password_hash)) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const user = normalizeUser(rawUser);
    const token = await createSession(user.id, req);

    await addAudit('user', user.id, 'login', 'session', null, { ip: getClientIp(req) });
    return json(res, 200, { token, user });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');

    await sessionStore.del(sessionUser.jti);
    await repo.deleteSessionByJti(sessionUser.jti);
    await addAudit('user', sessionUser.user.id, 'logout', 'session', sessionUser.jti, null);

    return json(res, 200, { message: 'Logged out' });
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');
    const events = await repo.listOpenEvents();
    return json(res, 200, { events });
  }

  if (req.method === 'GET' && pathname === '/api/aviator/state') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');
    return json(res, 200, aviatorPublicState(sessionUser.user));
  }

  if (req.method === 'POST' && pathname === '/api/payments/mpesa/stkpush') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');
    assertCanBet(sessionUser.user);
    ensureMpesaConfigured();

    const body = await parseBody(req);
    const amount = parseMoney(body.amount, 'amount');
    const phone = normalizeKenyaPhone(body.phone || sessionUser.user.phone);
    if (!phone) throw new ApiError(400, 'Valid Kenya phone required (e.g. 2547XXXXXXXX)');

    const used = await repo.depositsToday(sessionUser.user.id);
    if (used + amount > sessionUser.user.dailyDepositLimit) {
      throw new ApiError(400, `Daily deposit limit exceeded. Limit ${sessionUser.user.dailyDepositLimit}`);
    }
    if (sessionUser.user.kycStatus !== 'verified' && amount > 200) {
      throw new ApiError(400, 'Unverified accounts can deposit up to 200 per transaction');
    }

    const timestamp = mpesaTimestamp();
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
    const accessToken = await getMpesaAccessToken();

    const stkPayload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: MPESA_TRANSACTION_TYPE,
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: `BETPESA-${sessionUser.user.id.slice(0, 8)}`,
      TransactionDesc: 'BetPesa wallet deposit'
    };

    const res = await fetch(`${mpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPayload)
    });
    const data = await res.json();

    if (!res.ok || data.ResponseCode !== '0') {
      throw new ApiError(502, data.errorMessage || data.ResponseDescription || 'STK push failed');
    }

    const checkoutRequestId = data.CheckoutRequestID;
    mpesaState.pending.set(checkoutRequestId, {
      userId: sessionUser.user.id,
      amount: Math.round(amount),
      phone,
      status: 'pending',
      createdAt: nowIso(),
      merchantRequestId: data.MerchantRequestID
    });

    await addAudit('user', sessionUser.user.id, 'mpesa_stk_push_requested', 'payment', checkoutRequestId, {
      amount: Math.round(amount),
      phone
    });

    return json(res, 201, {
      message: 'STK push sent. Enter your M-Pesa PIN on phone.',
      checkoutRequestId,
      customerMessage: data.CustomerMessage || 'Check your phone and enter PIN'
    });
  }

  if (req.method === 'GET' && pathname === '/api/payments/mpesa/stkpush/status') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');
    const checkoutRequestId = trim(urlObj.searchParams.get('checkoutRequestId'));
    if (!checkoutRequestId) throw new ApiError(400, 'checkoutRequestId is required');

    const pending = mpesaState.pending.get(checkoutRequestId);
    if (pending && pending.userId === sessionUser.user.id) {
      return json(res, 200, {
        checkoutRequestId,
        status: pending.status,
        resultDesc: pending.resultDesc || null
      });
    }

    const exists = await repo.hasTransactionReference(`STK-${checkoutRequestId}`);
    return json(res, 200, {
      checkoutRequestId,
      status: exists ? 'completed' : 'unknown',
      resultDesc: exists ? 'Wallet credited' : 'No final status yet'
    });
  }

  if (req.method === 'POST' && pathname === '/api/payments/mpesa/callback') {
    const body = await parseBody(req);
    const callback = body?.Body?.stkCallback;
    const checkoutRequestId = trim(callback?.CheckoutRequestID);
    const resultCode = Number(callback?.ResultCode);
    const resultDesc = trim(callback?.ResultDesc);

    if (checkoutRequestId) {
      const pending = mpesaState.pending.get(checkoutRequestId);
      if (pending) {
        pending.status = resultCode === 0 ? 'completed' : 'failed';
        pending.resultDesc = resultDesc;
      }

      if (resultCode === 0 && pending) {
        const reference = `STK-${checkoutRequestId}`;
        const alreadyCredited = await repo.hasTransactionReference(reference);

        if (!alreadyCredited) {
          await repo.adjustBalance(pending.userId, pending.amount, 'deposit', 'credit', reference);
          await addAudit('system', null, 'mpesa_stk_settled', 'payment', checkoutRequestId, {
            amount: pending.amount,
            resultDesc
          });
        }
      }
    }

    return json(res, 200, { ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (req.method === 'POST' && pathname === '/api/aviator/bet') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');
    assertCanBet(sessionUser.user);

    if (aviator.phase !== 'betting') {
      throw new ApiError(400, 'Betting window closed for this round');
    }

    const body = await parseBody(req);
    const stake = parseMoney(body.stake, 'stake');
    if (stake > AVIATOR_MAX_BET) throw new ApiError(400, `Aviator max bet is ${AVIATOR_MAX_BET}`);
    if (aviator.bets.has(sessionUser.user.id)) throw new ApiError(400, 'You already placed a bet this round');

    let walletBalance;
    try {
      walletBalance = await repo.adjustBalance(
        sessionUser.user.id,
        -stake,
        'stake_debit',
        'debit',
        `AVB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
      );
    } catch (error) {
      if (error.message.includes('Insufficient')) throw new ApiError(400, 'Insufficient wallet balance');
      throw error;
    }

    aviator.bets.set(sessionUser.user.id, {
      userId: sessionUser.user.id,
      stake,
      cashedOut: false,
      payout: null,
      cashoutMultiplier: null
    });
    aviator.roundHasBets = true;
    // Switch signal stream to low-odds range immediately once bets exist.
    aviator.signalQueue = [];
    refillAviatorSignals();

    await addAudit('user', sessionUser.user.id, 'aviator_bet', 'aviator_round', aviator.roundId, { stake });
    return json(res, 201, {
      message: 'Aviator bet accepted',
      walletBalance,
      roundId: aviator.roundId
    });
  }

  if (req.method === 'POST' && pathname === '/api/aviator/cashout') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');

    const currentBet = aviator.bets.get(sessionUser.user.id);
    if (!currentBet) throw new ApiError(400, 'No active Aviator bet');
    if (currentBet.cashedOut) throw new ApiError(400, 'Bet already cashed out');
    if (aviator.phase !== 'flying') throw new ApiError(400, 'Cashout not available right now');

    const payout = roundMoney(currentBet.stake * aviator.multiplier);
    const cashoutMultiplier = roundMultiplier(aviator.multiplier);
    currentBet.cashedOut = true;
    currentBet.payout = payout;
    currentBet.cashoutMultiplier = cashoutMultiplier;

    const walletBalance = await repo.adjustBalance(
      sessionUser.user.id,
      payout,
      'payout_credit',
      'credit',
      `AVP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    );

    await addAudit('user', sessionUser.user.id, 'aviator_cashout', 'aviator_round', aviator.roundId, {
      stake: currentBet.stake,
      payout,
      cashoutMultiplier
    });

    return json(res, 200, {
      payout,
      cashoutMultiplier,
      walletBalance
    });
  }

  if (req.method === 'GET' && pathname === '/api/signals') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');
    const limit = Math.min(Number(urlObj.searchParams.get('limit') || 50), 100);
    const signals = await repo.listSignals({ status: 'approved', limit });
    return json(res, 200, { signals });
  }

  if (req.method === 'GET' && pathname === '/api/signals/mine') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');
    if (!isSignalProviderUser(sessionUser.user)) throw new ApiError(403, 'Signal provider access required');
    const limit = Math.min(Number(urlObj.searchParams.get('limit') || 100), 200);
    const signals = await repo.listSignals({ createdBy: sessionUser.user.id, limit });
    return json(res, 200, { signals });
  }

  if (req.method === 'POST' && pathname === '/api/signals') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');
    if (!isSignalProviderUser(sessionUser.user)) throw new ApiError(403, 'Signal provider access required');

    const body = await parseBody(req);
    const game = trim(body.game);
    const prediction = trim(body.prediction);
    const confidence = trim(body.confidence || 'medium').toLowerCase();
    const startsAt = trim(body.startsAt);
    const odds = Number(body.odds);

    if (!game || !prediction || !startsAt) throw new ApiError(400, 'game, prediction and startsAt are required');
    if (!Number.isFinite(odds) || odds <= 1) throw new ApiError(400, 'odds must be greater than 1');
    if (new Date(startsAt).getTime() <= Date.now()) throw new ApiError(400, 'startsAt must be in the future');

    const signal = await repo.createSignal({
      game,
      prediction,
      odds,
      confidence: ['low', 'medium', 'high'].includes(confidence) ? confidence : 'medium',
      startsAt,
      createdBy: sessionUser.user.id,
      status: sessionUser.user.role === 'super_admin' ? 'approved' : 'pending'
    });

    await addAudit('user', sessionUser.user.id, 'signal_create', 'signal', signal.id, { game, odds });
    return json(res, 201, { signal });
  }

  if (req.method === 'GET' && pathname === '/api/me') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');
    return json(res, 200, { user: sessionUser.user });
  }

  if (req.method === 'POST' && pathname === '/api/profile') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');

    const body = await parseBody(req);
    const patch = {};

    if (body.fullName !== undefined) patch.fullName = trim(body.fullName).slice(0, 80);
    if (body.phone !== undefined) {
      const phone = normalizePhone(body.phone);
      if (!phone) throw new ApiError(400, 'Valid phone number is required');
      const existing = await repo.getUserByPhone(phone);
      if (existing && existing.id !== sessionUser.user.id) throw new ApiError(409, 'Phone number already exists');
      patch.phone = phone;
    }
    if (body.country !== undefined) patch.country = trim(body.country).toUpperCase().slice(0, 2);

    if (body.dailyDepositLimit !== undefined) {
      const limit = parseMoney(body.dailyDepositLimit, 'dailyDepositLimit');
      if (limit > 25000) throw new ApiError(400, 'dailyDepositLimit exceeds allowed maximum');
      patch.dailyDepositLimit = limit;
    }

    if (body.selfExcludeDays !== undefined) {
      const days = Number(body.selfExcludeDays);
      if (!Number.isInteger(days) || days < 0 || days > 365) {
        throw new ApiError(400, 'selfExcludeDays must be 0-365');
      }
      patch.selfExcludedUntil = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
    }

    const user = normalizeUser(await repo.updateUser(sessionUser.user.id, patch));
    await addAudit('user', user.id, 'profile_update', 'user', user.id, patch);

    return json(res, 200, { user });
  }

  if (req.method === 'POST' && pathname === '/api/kyc/submit') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');

    const body = await parseBody(req);
    const idNumber = trim(body.idNumber);
    if (idNumber.length < 4) throw new ApiError(400, 'idNumber is required');

    const user = normalizeUser(await repo.updateUser(sessionUser.user.id, { kycStatus: 'pending' }));
    await addAudit('user', user.id, 'kyc_submit', 'user', user.id, { idNumberLast4: idNumber.slice(-4) });

    return json(res, 200, { message: 'KYC submitted and pending review', kycStatus: user.kycStatus });
  }

  if (req.method === 'POST' && pathname === '/api/deposit') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');

    assertCanBet(sessionUser.user);

    const body = await parseBody(req);
    const amount = parseMoney(body.amount, 'amount');

    const used = await repo.depositsToday(sessionUser.user.id);
    if (used + amount > sessionUser.user.dailyDepositLimit) {
      throw new ApiError(400, `Daily deposit limit exceeded. Limit ${sessionUser.user.dailyDepositLimit}`);
    }

    if (sessionUser.user.kycStatus !== 'verified' && amount > 200) {
      throw new ApiError(400, 'Unverified accounts can deposit up to 200 per transaction');
    }

    const walletBalance = await repo.deposit(sessionUser.user.id, amount);
    await addAudit('user', sessionUser.user.id, 'deposit', 'transaction', null, { amount });

    return json(res, 200, {
      walletBalance,
      dailyDeposited: roundMoney(used + amount),
      dailyLimit: sessionUser.user.dailyDepositLimit
    });
  }

  if (req.method === 'POST' && pathname === '/api/withdraw') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');

    assertCanBet(sessionUser.user);
    if (sessionUser.user.kycStatus !== 'verified') throw new ApiError(403, 'Complete KYC verification before withdrawals');

    const body = await parseBody(req);
    const amount = parseMoney(body.amount, 'amount');

    let walletBalance;
    try {
      walletBalance = await repo.withdraw(sessionUser.user.id, amount);
    } catch (error) {
      if (error.message.includes('Insufficient')) throw new ApiError(400, 'Insufficient wallet balance');
      throw error;
    }

    await addAudit('user', sessionUser.user.id, 'withdrawal', 'transaction', null, { amount });
    return json(res, 200, { walletBalance });
  }

  if (req.method === 'POST' && pathname === '/api/bets') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');

    assertCanBet(sessionUser.user);

    const body = await parseBody(req);
    const eventId = trim(body.eventId);
    const market = trim(body.market);
    const stake = parseMoney(body.stake, 'stake');

    if (stake > MAX_STAKE) throw new ApiError(400, `Max stake per bet is ${MAX_STAKE}`);

    const event = await repo.findEventById(eventId);
    if (!event || event.status !== 'open') throw new ApiError(404, 'Event not available');
    if (new Date(event.startsAt).getTime() <= Date.now()) throw new ApiError(400, 'Event has already started');

    const odds = Number(event.markets[market]);
    if (!Number.isFinite(odds) || odds <= 1) throw new ApiError(400, 'Invalid market');

    let placed;
    try {
      placed = await repo.placeBet({ userId: sessionUser.user.id, eventId, market, odds, stake });
    } catch (error) {
      if (error.message.includes('Insufficient')) throw new ApiError(400, 'Insufficient wallet balance');
      throw error;
    }

    await addAudit('user', sessionUser.user.id, 'place_bet', 'bet', placed.bet.id, {
      eventId,
      market,
      stake,
      odds
    });

    return json(res, 201, placed);
  }

  if (req.method === 'GET' && pathname === '/api/bets') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');

    const limit = Math.min(Number(urlObj.searchParams.get('limit') || 50), 100);
    const bets = await repo.listUserBets(sessionUser.user.id, limit);
    return json(res, 200, { bets });
  }

  if (req.method === 'GET' && pathname === '/api/transactions') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) throw new ApiError(401, 'Unauthorized');

    const limit = Math.min(Number(urlObj.searchParams.get('limit') || 50), 100);
    const transactions = await repo.listUserTransactions(sessionUser.user.id, limit);
    return json(res, 200, { transactions });
  }

  if (req.method === 'GET' && pathname === '/api/admin/overview') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');
    return json(res, 200, await repo.overview());
  }

  if (req.method === 'GET' && pathname === '/api/admin/users') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');
    const users = (await repo.listUsers()).map(normalizeUser);
    return json(res, 200, { users });
  }

  if (req.method === 'POST' && pathname === '/api/admin/users/role') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');

    const body = await parseBody(req);
    const userId = trim(body.userId);
    const role = trim(body.role);
    if (!['user', 'signal_provider', 'super_admin'].includes(role)) {
      throw new ApiError(400, 'role must be user, signal_provider or super_admin');
    }
    const user = normalizeUser(await repo.updateUser(userId, { role }));
    if (!user) throw new ApiError(404, 'User not found');
    await addAudit('admin', sessionUser.user.id, 'user_role_update', 'user', user.id, { role });
    return json(res, 200, { user });
  }

  if (req.method === 'GET' && pathname === '/api/admin/bets') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');
    return json(res, 200, { bets: await repo.listBets() });
  }

  if (req.method === 'GET' && pathname === '/api/admin/live') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');

    const [overview, bets, transactions] = await Promise.all([repo.overview(), repo.listBets(), repo.listAllTransactions(10000)]);
    const recentBets = bets.slice(0, 15);
    const totalStaked = recentBets.reduce((sum, b) => sum + Number(b.stake || 0), 0);

    const finance = transactions.reduce(
      (acc, tx) => {
        const type = String(tx.walletTxnType || '');
        const amt = Number(tx.amount || 0);
        if (type === 'deposit') acc.deposits += amt;
        if (type === 'withdrawal') acc.withdrawals += amt;
        if (type === 'stake_debit') acc.stakes += amt;
        if (type === 'payout_credit') acc.payouts += amt;
        if (type === 'refund_credit') acc.refunds += amt;
        return acc;
      },
      { deposits: 0, withdrawals: 0, stakes: 0, payouts: 0, refunds: 0 }
    );
    finance.ggr = roundMoney(finance.stakes - finance.payouts - finance.refunds);
    finance.netCashflow = roundMoney(finance.deposits - finance.withdrawals);

    return json(res, 200, {
      overview,
      recentBets,
      totalStaked: roundMoney(totalStaked),
      finance: {
        deposits: roundMoney(finance.deposits),
        withdrawals: roundMoney(finance.withdrawals),
        stakes: roundMoney(finance.stakes),
        payouts: roundMoney(finance.payouts),
        refunds: roundMoney(finance.refunds),
        ggr: finance.ggr,
        netCashflow: finance.netCashflow
      },
      aviator: aviatorPublicState(sessionUser.user)
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/kyc') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');

    const body = await parseBody(req);
    const userId = trim(body.userId);
    const status = trim(body.status);

    if (!['verified', 'blocked', 'unverified'].includes(status)) {
      throw new ApiError(400, 'status must be verified, blocked or unverified');
    }

    const user = normalizeUser(await repo.updateUser(userId, { kycStatus: status }));
    if (!user) throw new ApiError(404, 'User not found');

    await addAudit('admin', null, 'kyc_review', 'user', user.id, { status });
    return json(res, 200, { user });
  }

  if (req.method === 'GET' && pathname === '/api/admin/signals') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');
    const status = trim(urlObj.searchParams.get('status') || '');
    const signals = await repo.listSignals({ status: status || undefined, limit: 200 });
    return json(res, 200, { signals });
  }

  if (req.method === 'POST' && pathname === '/api/admin/signals/status') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');

    const body = await parseBody(req);
    const signalId = trim(body.signalId);
    const status = trim(body.status);
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      throw new ApiError(400, 'status must be approved, rejected or pending');
    }

    const signal = await repo.updateSignal(signalId, { status });
    if (!signal) throw new ApiError(404, 'Signal not found');
    await addAudit('admin', sessionUser.user.id, 'signal_status_update', 'signal', signal.id, { status });
    return json(res, 200, { signal });
  }

  if (req.method === 'POST' && pathname === '/api/admin/events') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');

    const body = await parseBody(req);
    const league = trim(body.league);
    const homeTeam = trim(body.homeTeam);
    const awayTeam = trim(body.awayTeam);
    const startsAt = trim(body.startsAt);
    const markets = body.markets || {};

    if (!league || !homeTeam || !awayTeam || !startsAt) {
      throw new ApiError(400, 'league, homeTeam, awayTeam, startsAt are required');
    }
    if (new Date(startsAt).getTime() <= Date.now()) {
      throw new ApiError(400, 'startsAt must be in the future');
    }

    const event = await repo.createEvent({
      league,
      homeTeam,
      awayTeam,
      startsAt,
      markets: {
        homeWin: Number(markets.homeWin || 2),
        draw: Number(markets.draw || 3),
        awayWin: Number(markets.awayWin || 2)
      }
    });

    await addAudit('admin', null, 'event_create', 'event', event.id, null);
    return json(res, 201, { event });
  }

  if (req.method === 'POST' && pathname === '/api/admin/events/odds') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');

    const body = await parseBody(req);
    const eventId = trim(body.eventId);
    const patch = {};

    if (body.status) {
      if (!['open', 'settled'].includes(body.status)) {
        throw new ApiError(400, 'status must be open or settled');
      }
      patch.status = body.status;
    }

    if (body.markets && typeof body.markets === 'object') {
      const nextMarkets = {
        homeWin: Number(body.markets.homeWin),
        draw: Number(body.markets.draw),
        awayWin: Number(body.markets.awayWin)
      };

      if (!Object.values(nextMarkets).every((v) => Number.isFinite(v) && v > 1)) {
        throw new ApiError(400, 'All odds must be numbers above 1.0');
      }
      patch.markets = nextMarkets;
    }

    const event = await repo.updateEvent(eventId, patch);
    if (!event) throw new ApiError(404, 'Event not found');

    await addAudit('admin', null, 'event_update', 'event', event.id, patch);
    return json(res, 200, { event });
  }

  if (req.method === 'POST' && pathname === '/api/admin/settle') {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser || !isAdminUser(sessionUser.user)) throw new ApiError(403, 'Admin access required');

    const body = await parseBody(req);
    const betId = trim(body.betId);
    const result = trim(body.result);

    if (!['won', 'lost', 'void'].includes(result)) {
      throw new ApiError(400, 'result must be won, lost, or void');
    }

    const settled = await repo.settleBet({ betId, result });
    if (!settled) throw new ApiError(404, 'Bet not found');

    await addAudit('admin', null, 'bet_settle', 'bet', betId, { result });
    return json(res, 200, settled);
  }

  throw new ApiError(404, 'Not found');
}

async function createStorage() {
  if (DATABASE_URL) {
    try {
      const PostgresRepo = require('./repos/postgres-repo');
      const pgRepo = new PostgresRepo(DATABASE_URL);
      await pgRepo.init();
      return pgRepo;
    } catch (error) {
      console.warn('PostgreSQL unavailable, falling back to JSON storage:', error.message);
    }
  }
  const jsonRepo = new JsonRepo();
  await jsonRepo.init();
  return jsonRepo;
}

async function createRedisClient() {
  if (!REDIS_URL) return null;
  try {
    const { createClient } = require('redis');
    const client = createClient({ url: REDIS_URL });
    client.on('error', (err) => {
      console.warn('Redis error:', err.message);
    });
    await client.connect();
    return client;
  } catch (error) {
    console.warn('Redis unavailable, using in-memory stores:', error.message);
    return null;
  }
}

async function upsertSystemUser({ username, email, phone, role, fullName, password }) {
  const normalizedPhone = normalizePhone(phone);
  const existingByUsername = await repo.getUserByUsername(username);
  const existingByPhone = normalizedPhone ? await repo.getUserByPhone(normalizedPhone) : null;
  const rawExisting = existingByUsername || existingByPhone;
  const existing = normalizeUser(rawExisting);

  const patch = {
    username,
    fullName,
    role,
    phone: normalizedPhone
  };

  if (!existing) {
    await repo.createUser({
      id: crypto.randomUUID(),
      email,
      username,
      role,
      passwordHash: hashPassword(password),
      fullName,
      phone: normalizedPhone,
      country: 'KE',
      dateOfBirth: '1995-01-01',
      walletBalance: 0,
      kycStatus: 'verified',
      dailyDepositLimit: 100000,
      selfExcludedUntil: null,
      createdAt: nowIso()
    });
    return;
  }

  const storedHash = rawExisting?.passwordHash || rawExisting?.password_hash || '';
  if (!verifyPassword(password, storedHash)) {
    patch.passwordHash = hashPassword(password);
  }
  if (existing.kycStatus !== 'verified') {
    patch.kycStatus = 'verified';
  }
  await repo.updateUser(existing.id, patch);
}

async function ensureSystemUsers() {
  await upsertSystemUser({
    username: 'admin.dolazetu.com',
    email: 'admin@dolazetu.com',
    phone: '0702249813',
    role: 'super_admin',
    fullName: 'Dolazetu Super Admin',
    password: 'belac.ke05'
  });

  await upsertSystemUser({
    username: 'signal-admin.dolazetu.com',
    email: 'signals@dolazetu.com',
    phone: '0702249814',
    role: 'signal_provider',
    fullName: 'Dolazetu Signal Admin',
    password: 'belac.ke05'
  });
}

async function bootstrap() {
  sessionStore = new MemorySessionStore();
  rateLimitStore = new MemoryRateLimitStore();

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
      });
      res.end();
      return;
    }

    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      if (urlObj.pathname === '/api/health') {
        return json(res, 200, {
          ok: true,
          ready: bootReady,
          error: bootError ? String(bootError.message || bootError) : null
        });
      }

      if (urlObj.pathname.startsWith('/api/')) {
        if (!bootReady) {
          return json(res, 503, { error: 'Server booting, try again in a few seconds' });
        }
        await handleApi(req, res, urlObj);
        return;
      }
      if (urlObj.pathname === '/' || urlObj.pathname === '/login') {
        sendStaticFile(res, '/login.html');
        return;
      }
      if (urlObj.pathname === '/dashboard') {
        sendStaticFile(res, '/dashboard.html');
        return;
      }
      if (urlObj.pathname === '/admin') {
        sendStaticFile(res, '/admin.html');
        return;
      }
      if (urlObj.pathname === '/signals-admin' || urlObj.pathname === '/signal') {
        sendStaticFile(res, '/signals-admin.html');
        return;
      }
      sendStaticFile(res, urlObj.pathname);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      const message = error instanceof ApiError ? error.message : 'Internal server error';
      json(res, status, { error: message });
    }
  });

  server.listen(PORT, HOST, () => {
    const mode = DATABASE_URL ? 'postgres-preferred' : 'json';
    const cache = REDIS_URL ? 'redis-preferred' : 'memory';
    console.log(`BetPesa API running on http://${HOST}:${PORT} | storage=${mode} | cache=${cache}`);
  });

  // Keep the HTTP port open quickly (for Render health detection), then initialize dependencies.
  try {
    repo = await createStorage();
    await ensureSystemUsers();
    const redis = await createRedisClient();

    if (redis) {
      sessionStore = new RedisSessionStore(redis);
      rateLimitStore = new RedisRateLimitStore(redis);
    }

    startAviatorRound();
    startSignalGenerator();
    bootReady = true;
    console.log('BetPesa bootstrap complete');
  } catch (error) {
    bootError = error;
    console.error('Bootstrap dependency init failed:', error);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap server:', error);
  process.exit(1);
});
