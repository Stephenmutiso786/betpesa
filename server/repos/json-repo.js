'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'db.json');

function nowIso() {
  return new Date().toISOString();
}

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          users: [],
          sessions: [],
          events: [],
          bets: [],
          transactions: [],
          auditLogs: [],
          signals: []
        },
        null,
        2
      )
    );
  }
}

function readDb() {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  db.users ||= [];
  db.sessions ||= [];
  db.events ||= [];
  db.bets ||= [];
  db.transactions ||= [];
  db.auditLogs ||= [];
  db.signals ||= [];
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

class JsonRepo {
  async init() {
    const db = readDb();
    db.users = db.users.map((u) => ({ role: u.role || 'user', ...u }));
    if (!db.events.length) {
      db.events.push(
        {
          id: 'evt_001',
          league: 'Premier League',
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          startsAt: '2026-03-08T17:00:00Z',
          status: 'open',
          markets: { homeWin: 1.95, draw: 3.4, awayWin: 4.1 }
        },
        {
          id: 'evt_002',
          league: 'La Liga',
          homeTeam: 'Barcelona',
          awayTeam: 'Sevilla',
          startsAt: '2026-03-08T20:00:00Z',
          status: 'open',
          markets: { homeWin: 1.62, draw: 3.9, awayWin: 5.5 }
        }
      );
    }
    writeDb(db);
  }

  async getUserByEmail(email) {
    const db = readDb();
    return db.users.find((u) => u.email === email) || null;
  }

  async getUserByUsername(username) {
    const db = readDb();
    return db.users.find((u) => u.username === username) || null;
  }

  async getUserByPhone(phone) {
    const db = readDb();
    return db.users.find((u) => u.phone === phone) || null;
  }

  async getUserById(id) {
    const db = readDb();
    return db.users.find((u) => u.id === id) || null;
  }

  async createUser(user) {
    const db = readDb();
    db.users.push(user);
    writeDb(db);
    return user;
  }

  async updateUser(userId, patch) {
    const db = readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return null;
    Object.assign(user, patch);
    writeDb(db);
    return user;
  }

  async createSession(session) {
    const db = readDb();
    db.sessions.push(session);
    writeDb(db);
  }

  async deleteSessionByJti(jti) {
    const db = readDb();
    db.sessions = db.sessions.filter((s) => s.jti !== jti);
    writeDb(db);
  }

  async hasSessionJti(jti) {
    const db = readDb();
    return db.sessions.some((s) => s.jti === jti && new Date(s.expiresAt).getTime() > Date.now());
  }

  async listOpenEvents() {
    const db = readDb();
    return db.events.filter((e) => e.status === 'open').sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  }

  async findEventById(eventId) {
    const db = readDb();
    return db.events.find((e) => e.id === eventId) || null;
  }

  async createEvent(payload) {
    const db = readDb();
    const event = {
      id: `evt_${crypto.randomUUID().slice(0, 8)}`,
      league: payload.league,
      homeTeam: payload.homeTeam,
      awayTeam: payload.awayTeam,
      startsAt: payload.startsAt,
      status: 'open',
      markets: payload.markets
    };
    db.events.push(event);
    writeDb(db);
    return event;
  }

  async updateEvent(eventId, patch) {
    const db = readDb();
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return null;
    if (patch.status) event.status = patch.status;
    if (patch.markets) event.markets = { ...event.markets, ...patch.markets };
    writeDb(db);
    return event;
  }

  async placeBet({ userId, eventId, market, odds, stake }) {
    const db = readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    if (user.walletBalance < stake) throw new Error('Insufficient wallet balance');

    user.walletBalance = roundMoney(user.walletBalance - stake);

    const bet = {
      id: crypto.randomUUID(),
      userId,
      eventId,
      market,
      odds,
      stake,
      potentialPayout: roundMoney(stake * odds),
      status: 'open',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    db.bets.push(bet);
    db.transactions.push({
      id: crypto.randomUUID(),
      userId,
      walletTxnType: 'stake_debit',
      direction: 'debit',
      amount: stake,
      currency: 'KES',
      status: 'completed',
      reference: `BET-${bet.id.slice(0, 8).toUpperCase()}`,
      createdAt: nowIso()
    });

    writeDb(db);
    return { bet, walletBalance: user.walletBalance };
  }

  async settleBet({ betId, result }) {
    const db = readDb();
    const bet = db.bets.find((b) => b.id === betId);
    if (!bet) return null;
    if (bet.status !== 'open') throw new Error('Bet already settled');

    const user = db.users.find((u) => u.id === bet.userId);
    if (!user) throw new Error('User not found');

    bet.status = result;
    bet.settledAt = nowIso();
    bet.updatedAt = nowIso();

    let creditAmount = 0;
    let txnType = 'refund_credit';
    if (result === 'won') {
      creditAmount = bet.potentialPayout;
      txnType = 'payout_credit';
    } else if (result === 'void') {
      creditAmount = bet.stake;
      txnType = 'refund_credit';
    }

    if (creditAmount > 0) {
      user.walletBalance = roundMoney(user.walletBalance + creditAmount);
      db.transactions.push({
        id: crypto.randomUUID(),
        userId: user.id,
        walletTxnType: txnType,
        direction: 'credit',
        amount: creditAmount,
        currency: 'KES',
        status: 'completed',
        reference: `STL-${bet.id.slice(0, 8).toUpperCase()}`,
        createdAt: nowIso()
      });
    }

    writeDb(db);
    return { bet, user };
  }

  async listUserBets(userId, limit = 50) {
    const db = readDb();
    return db.bets
      .filter((b) => b.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async deposit(userId, amount) {
    const db = readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');

    user.walletBalance = roundMoney(user.walletBalance + amount);
    db.transactions.push({
      id: crypto.randomUUID(),
      userId,
      walletTxnType: 'deposit',
      direction: 'credit',
      amount,
      currency: 'KES',
      status: 'completed',
      reference: `DEP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: nowIso()
    });

    writeDb(db);
    return user.walletBalance;
  }

  async withdraw(userId, amount) {
    const db = readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    if (user.walletBalance < amount) throw new Error('Insufficient wallet balance');

    user.walletBalance = roundMoney(user.walletBalance - amount);
    db.transactions.push({
      id: crypto.randomUUID(),
      userId,
      walletTxnType: 'withdrawal',
      direction: 'debit',
      amount,
      currency: 'KES',
      status: 'completed',
      reference: `WDR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: nowIso()
    });

    writeDb(db);
    return user.walletBalance;
  }

  async adjustBalance(userId, amountDelta, walletTxnType, direction, reference) {
    const db = readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');

    const next = roundMoney(user.walletBalance + amountDelta);
    if (next < 0) throw new Error('Insufficient wallet balance');
    user.walletBalance = next;

    db.transactions.push({
      id: crypto.randomUUID(),
      userId,
      walletTxnType,
      direction,
      amount: Math.abs(amountDelta),
      currency: 'KES',
      status: 'completed',
      reference: reference || `${walletTxnType}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: nowIso()
    });

    writeDb(db);
    return user.walletBalance;
  }

  async listUserTransactions(userId, limit = 50) {
    const db = readDb();
    return db.transactions
      .filter((t) => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async listAllTransactions(limit = 5000) {
    const db = readDb();
    return db.transactions
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async hasTransactionReference(reference) {
    const db = readDb();
    return db.transactions.some((t) => t.reference === reference);
  }

  async depositsToday(userId) {
    const db = readDb();
    const dayKey = nowIso().slice(0, 10);
    return db.transactions
      .filter((t) => t.userId === userId && t.walletTxnType === 'deposit' && String(t.createdAt).startsWith(dayKey))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }

  async listUsers() {
    const db = readDb();
    return db.users;
  }

  async listBets() {
    const db = readDb();
    return db.bets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async overview() {
    const db = readDb();
    return {
      users: db.users.length,
      openBets: db.bets.filter((b) => b.status === 'open').length,
      pendingKyc: db.users.filter((u) => u.kycStatus === 'pending').length,
      events: db.events.length,
      transactions: db.transactions.length
    };
  }

  async createSignal(payload) {
    const db = readDb();
    const signal = {
      id: crypto.randomUUID(),
      game: payload.game,
      prediction: payload.prediction,
      odds: Number(payload.odds),
      confidence: payload.confidence || 'medium',
      startsAt: payload.startsAt,
      createdBy: payload.createdBy,
      status: payload.status || 'pending',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    db.signals.push(signal);
    writeDb(db);
    return signal;
  }

  async listSignals({ status, createdBy, limit = 100 } = {}) {
    const db = readDb();
    let rows = [...db.signals];
    if (status) rows = rows.filter((s) => s.status === status);
    if (createdBy) rows = rows.filter((s) => s.createdBy === createdBy);
    return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
  }

  async updateSignal(signalId, patch) {
    const db = readDb();
    const signal = db.signals.find((s) => s.id === signalId);
    if (!signal) return null;
    Object.assign(signal, patch, { updatedAt: nowIso() });
    writeDb(db);
    return signal;
  }

  async addAudit(log) {
    const db = readDb();
    db.auditLogs.push(log);
    writeDb(db);
  }
}

module.exports = JsonRepo;
