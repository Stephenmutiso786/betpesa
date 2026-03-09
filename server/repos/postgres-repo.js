'use strict';

const crypto = require('crypto');
const { Pool } = require('pg');

function nowIso() {
  return new Date().toISOString();
}

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

class PostgresRepo {
  constructor(databaseUrl) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async init() {
    await this.pool.query('select 1');
    await this.pool.query(`alter table users add column if not exists role varchar(20) not null default 'user'`);
    await this.pool.query(`
      create table if not exists signals (
        id uuid primary key,
        game varchar(60) not null,
        prediction text not null,
        odds numeric(10,4) not null,
        confidence varchar(20) not null default 'medium',
        starts_at timestamptz not null,
        created_by uuid not null references users(id) on delete cascade,
        status varchar(20) not null default 'pending',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
    await this.pool.query(`
      create table if not exists admin_settings (
        key text primary key,
        value jsonb not null,
        updated_at timestamptz not null default now()
      )
    `);
  }

  async close() {
    await this.pool.end();
  }

  async getUserByEmail(email) {
    const { rows } = await this.pool.query(
      `select u.*, coalesce(w.available_balance, 0) as wallet_balance
       from users u
       left join wallets w on w.user_id = u.id
       where u.email = $1
       limit 1`,
      [email]
    );
    return rows[0] || null;
  }

  async getUserByUsername(username) {
    const { rows } = await this.pool.query(
      `select u.*, coalesce(w.available_balance, 0) as wallet_balance
       from users u
       left join wallets w on w.user_id = u.id
       where u.username = $1
       limit 1`,
      [username]
    );
    return rows[0] || null;
  }

  async getUserByPhone(phone) {
    const { rows } = await this.pool.query(
      `select u.*, coalesce(w.available_balance, 0) as wallet_balance
       from users u
       left join wallets w on w.user_id = u.id
       where u.phone = $1
       limit 1`,
      [phone]
    );
    return rows[0] || null;
  }

  async getUserById(id) {
    const { rows } = await this.pool.query(
      `select u.*, coalesce(w.available_balance, 0) as wallet_balance
       from users u
       left join wallets w on w.user_id = u.id
       where u.id = $1
       limit 1`,
      [id]
    );
    return rows[0] || null;
  }

  async createUser(user) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        `insert into users
          (id, username, full_name, email, phone, password_hash, country, date_of_birth, kyc_status, daily_deposit_limit, self_excluded_until, status, role)
         values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12)
         returning *`,
        [
          user.id,
          user.username,
          user.fullName,
          user.email,
          user.phone,
          user.passwordHash,
          user.country,
          user.dateOfBirth,
          user.kycStatus,
          user.dailyDepositLimit,
          user.selfExcludedUntil,
          user.role || 'user'
        ]
      );

      await client.query(
        `insert into wallets (user_id, available_balance, locked_balance, currency)
         values ($1, 0, 0, 'KES')
         on conflict (user_id) do nothing`,
        [user.id]
      );

      await client.query('commit');
      return { ...rows[0], wallet_balance: 0 };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateUser(userId, patch) {
    const fields = [];
    const values = [];
    let idx = 1;

    const mapper = {
      username: 'username',
      fullName: 'full_name',
      phone: 'phone',
      passwordHash: 'password_hash',
      country: 'country',
      dateOfBirth: 'date_of_birth',
      role: 'role',
      kycStatus: 'kyc_status',
      dailyDepositLimit: 'daily_deposit_limit',
      selfExcludedUntil: 'self_excluded_until',
      status: 'status'
    };

    for (const [key, column] of Object.entries(mapper)) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        fields.push(`${column} = $${idx++}`);
        values.push(patch[key]);
      }
    }

    if (!fields.length) {
      return this.getUserById(userId);
    }

    values.push(userId);
    await this.pool.query(
      `update users set ${fields.join(', ')}, updated_at = now() where id = $${idx}`,
      values
    );

    return this.getUserById(userId);
  }

  async createSession(session) {
    await this.pool.query(
      `insert into sessions (user_id, token_jti, expires_at, ip_address, user_agent)
       values ($1, $2, $3, $4, $5)`,
      [session.userId, session.jti, session.expiresAt, session.ipAddress || null, session.userAgent || null]
    );
  }

  async deleteSessionByJti(jti) {
    await this.pool.query('delete from sessions where token_jti = $1', [jti]);
  }

  async hasSessionJti(jti) {
    const { rows } = await this.pool.query(
      'select 1 from sessions where token_jti = $1 and expires_at > now() limit 1',
      [jti]
    );
    return rows.length > 0;
  }

  async listOpenEvents() {
    const { rows } = await this.pool.query(
      `with latest_odds as (
         select distinct on (o.match_id, o.selection)
           o.match_id,
           o.selection,
           o.odd_value
         from odds o
         where o.market_type = '1X2' and o.is_active = true
         order by o.match_id, o.selection, o.version desc, o.updated_at desc
       )
       select
         m.id,
         l.name as league,
         m.team_home as "homeTeam",
         m.team_away as "awayTeam",
         m.start_time as "startsAt",
         case when m.status in ('scheduled', 'live') then 'open' else 'settled' end as status,
         max(case when lo.selection = 'homeWin' then lo.odd_value end) as home_win,
         max(case when lo.selection = 'draw' then lo.odd_value end) as draw,
         max(case when lo.selection = 'awayWin' then lo.odd_value end) as away_win
       from matches m
       join leagues l on l.id = m.league_id
       left join latest_odds lo on lo.match_id = m.id
       where m.status in ('scheduled', 'live')
       group by m.id, l.name, m.team_home, m.team_away, m.start_time, m.status
       order by m.start_time asc`
    );

    return rows.map((row) => ({
      id: row.id,
      league: row.league,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      startsAt: row.startsAt,
      status: row.status,
      markets: {
        homeWin: Number(row.home_win),
        draw: Number(row.draw),
        awayWin: Number(row.away_win)
      }
    }));
  }

  async findEventById(eventId) {
    const rows = await this.listOpenEvents();
    return rows.find((e) => e.id === eventId) || null;
  }

  async createEvent(payload) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      const sport = await client.query(
        `insert into sports (name)
         values ('Football')
         on conflict (name) do update set name = excluded.name
         returning id`
      );

      const league = await client.query(
        `insert into leagues (sport_id, name, country)
         values ($1, $2, $3)
         on conflict (sport_id, name)
         do update set country = excluded.country
         returning id`,
        [sport.rows[0].id, payload.league, 'Unknown']
      );

      const matchId = crypto.randomUUID();
      await client.query(
        `insert into matches (id, league_id, team_home, team_away, start_time, status)
         values ($1, $2, $3, $4, $5, 'scheduled')`,
        [matchId, league.rows[0].id, payload.homeTeam, payload.awayTeam, payload.startsAt]
      );

      const selections = ['homeWin', 'draw', 'awayWin'];
      for (const selection of selections) {
        await client.query(
          `insert into odds (match_id, market_type, selection, odd_value, source, is_active, version)
           values ($1, '1X2', $2, $3, 'manual', true, 1)`,
          [matchId, selection, Number(payload.markets[selection])]
        );
      }

      await client.query('commit');

      return {
        id: matchId,
        league: payload.league,
        homeTeam: payload.homeTeam,
        awayTeam: payload.awayTeam,
        startsAt: payload.startsAt,
        status: 'open',
        markets: payload.markets
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateEvent(eventId, patch) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      if (patch.status) {
        const next = patch.status === 'open' ? 'scheduled' : 'finished';
        await client.query('update matches set status = $1, updated_at = now() where id = $2', [next, eventId]);
      }

      if (patch.markets) {
        const { rows } = await client.query(
          `select selection, coalesce(max(version), 1) as max_version
           from odds
           where match_id = $1 and market_type = '1X2'
           group by selection`,
          [eventId]
        );

        const versionMap = new Map(rows.map((r) => [r.selection, Number(r.max_version) + 1]));

        await client.query(
          `update odds set is_active = false
           where match_id = $1 and market_type = '1X2' and is_active = true`,
          [eventId]
        );

        for (const [selection, oddValue] of Object.entries(patch.markets)) {
          await client.query(
            `insert into odds (match_id, market_type, selection, odd_value, source, is_active, version)
             values ($1, '1X2', $2, $3, 'manual', true, $4)`,
            [eventId, selection, Number(oddValue), versionMap.get(selection) || 1]
          );
        }
      }

      await client.query('commit');
      return this.findEventById(eventId);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async placeBet({ userId, eventId, market, odds, stake }) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      await client.query(
        `insert into wallets (user_id, available_balance, locked_balance, currency)
         values ($1, 0, 0, 'KES')
         on conflict (user_id) do nothing`,
        [userId]
      );

      const walletRes = await client.query(
        'select available_balance from wallets where user_id = $1 for update',
        [userId]
      );

      const balance = Number(walletRes.rows[0]?.available_balance || 0);
      if (balance < stake) {
        throw new Error('Insufficient wallet balance');
      }

      const betId = crypto.randomUUID();
      const potentialWin = roundMoney(stake * odds);

      await client.query(
        `update wallets
         set available_balance = available_balance - $2,
             updated_at = now()
         where user_id = $1`,
        [userId, stake]
      );

      await client.query(
        `insert into bets (id, user_id, bet_type, stake, total_odds, potential_win, status)
         values ($1, $2, 'single', $3, $4, $5, 'open')`,
        [betId, userId, stake, odds, potentialWin]
      );

      await client.query(
        `insert into bet_selections (bet_id, match_id, market_type, selection, odd_value, result)
         values ($1, $2, '1X2', $3, $4, 'pending')`,
        [betId, eventId, market, odds]
      );

      await client.query(
        `insert into transactions
          (user_id, wallet_txn_type, direction, amount, currency, status, reference)
         values
          ($1, 'stake_debit', 'debit', $2, 'KES', 'completed', $3)`,
        [userId, stake, `BET-${betId.slice(0, 8).toUpperCase()}`]
      );

      const newWallet = await client.query('select available_balance from wallets where user_id = $1', [userId]);

      await client.query('commit');

      return {
        bet: {
          id: betId,
          userId,
          eventId,
          market,
          odds,
          stake,
          potentialPayout: potentialWin,
          status: 'open',
          createdAt: nowIso()
        },
        walletBalance: roundMoney(newWallet.rows[0].available_balance)
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async settleBet({ betId, result }) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      const betRes = await client.query('select * from bets where id = $1 for update', [betId]);
      const bet = betRes.rows[0];
      if (!bet) {
        await client.query('rollback');
        return null;
      }
      if (bet.status !== 'open') throw new Error('Bet already settled');

      await client.query('update bets set status = $1, settled_at = now(), updated_at = now() where id = $2', [result, betId]);

      await client.query('update bet_selections set result = $1 where bet_id = $2', [result === 'won' ? 'won' : result === 'lost' ? 'lost' : 'void', betId]);

      let creditAmount = 0;
      let walletTxnType = 'refund_credit';
      if (result === 'won') {
        creditAmount = Number(bet.potential_win);
        walletTxnType = 'payout_credit';
      } else if (result === 'void') {
        creditAmount = Number(bet.stake);
      }

      if (creditAmount > 0) {
        await client.query('update wallets set available_balance = available_balance + $2, updated_at = now() where user_id = $1', [bet.user_id, creditAmount]);

        await client.query(
          `insert into transactions
            (user_id, wallet_txn_type, direction, amount, currency, status, reference)
           values
            ($1, $2, 'credit', $3, 'KES', 'completed', $4)`,
          [bet.user_id, walletTxnType, creditAmount, `STL-${String(betId).slice(0, 8).toUpperCase()}`]
        );
      }

      const user = await this.getUserById(bet.user_id);

      await client.query('commit');

      return {
        bet: {
          id: bet.id,
          userId: bet.user_id,
          status: result,
          stake: Number(bet.stake),
          potentialPayout: Number(bet.potential_win),
          settledAt: nowIso()
        },
        user
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async listUserBets(userId, limit = 50) {
    const { rows } = await this.pool.query(
      `select
         b.id,
         b.user_id as "userId",
         b.stake,
         b.total_odds as odds,
         b.potential_win as "potentialPayout",
         b.status,
         b.created_at as "createdAt",
         bs.match_id as "eventId",
         bs.selection as market
       from bets b
       left join bet_selections bs on bs.bet_id = b.id
       where b.user_id = $1
       order by b.created_at desc
       limit $2`,
      [userId, limit]
    );
    return rows.map((row) => ({
      ...row,
      stake: Number(row.stake),
      odds: Number(row.odds),
      potentialPayout: Number(row.potentialPayout)
    }));
  }

  async deposit(userId, amount) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into wallets (user_id, available_balance, locked_balance, currency)
         values ($1, 0, 0, 'KES')
         on conflict (user_id) do nothing`,
        [userId]
      );

      await client.query('update wallets set available_balance = available_balance + $2, updated_at = now() where user_id = $1', [userId, amount]);
      await client.query(
        `insert into transactions
          (user_id, wallet_txn_type, direction, amount, currency, status, reference)
         values
          ($1, 'deposit', 'credit', $2, 'KES', 'completed', $3)`,
        [userId, amount, `DEP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`]
      );

      const walletRes = await client.query('select available_balance from wallets where user_id = $1', [userId]);
      await client.query('commit');
      return roundMoney(walletRes.rows[0].available_balance);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async withdraw(userId, amount) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const walletRes = await client.query('select available_balance from wallets where user_id = $1 for update', [userId]);
      const balance = Number(walletRes.rows[0]?.available_balance || 0);
      if (balance < amount) throw new Error('Insufficient wallet balance');

      await client.query('update wallets set available_balance = available_balance - $2, updated_at = now() where user_id = $1', [userId, amount]);
      await client.query(
        `insert into transactions
          (user_id, wallet_txn_type, direction, amount, currency, status, reference)
         values
          ($1, 'withdrawal', 'debit', $2, 'KES', 'completed', $3)`,
        [userId, amount, `WDR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`]
      );

      const nextWallet = await client.query('select available_balance from wallets where user_id = $1', [userId]);
      await client.query('commit');
      return roundMoney(nextWallet.rows[0].available_balance);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async adjustBalance(userId, amountDelta, walletTxnType, direction, reference) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      await client.query(
        `insert into wallets (user_id, available_balance, locked_balance, currency)
         values ($1, 0, 0, 'KES')
         on conflict (user_id) do nothing`,
        [userId]
      );

      const lock = await client.query('select available_balance from wallets where user_id = $1 for update', [userId]);
      const current = Number(lock.rows[0]?.available_balance || 0);
      const next = roundMoney(current + amountDelta);
      if (next < 0) throw new Error('Insufficient wallet balance');

      await client.query('update wallets set available_balance = $2, updated_at = now() where user_id = $1', [
        userId,
        next
      ]);

      await client.query(
        `insert into transactions
          (user_id, wallet_txn_type, direction, amount, currency, status, reference)
         values
          ($1, $2, $3, $4, 'KES', 'completed', $5)`,
        [userId, walletTxnType, direction, Math.abs(amountDelta), reference]
      );

      await client.query('commit');
      return next;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async listUserTransactions(userId, limit = 50) {
    const { rows } = await this.pool.query(
      `select
         id,
         wallet_txn_type as "walletTxnType",
         direction,
         amount,
         currency,
         status,
         reference,
         created_at as "createdAt"
       from transactions
       where user_id = $1
       order by created_at desc
       limit $2`,
      [userId, limit]
    );
    return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
  }

  async listAllTransactions(limit = 5000) {
    const { rows } = await this.pool.query(
      `select
         id,
         user_id as "userId",
         wallet_txn_type as "walletTxnType",
         direction,
         amount,
         currency,
         status,
         reference,
         created_at as "createdAt"
       from transactions
       order by created_at desc
       limit $1`,
      [limit]
    );
    return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
  }

  async hasTransactionReference(reference) {
    const { rows } = await this.pool.query('select 1 from transactions where reference = $1 limit 1', [reference]);
    return rows.length > 0;
  }

  async depositsToday(userId) {
    const { rows } = await this.pool.query(
      `select coalesce(sum(amount),0) as total
       from transactions
       where user_id = $1 and wallet_txn_type = 'deposit' and status = 'completed' and created_at::date = now()::date`,
      [userId]
    );
    return Number(rows[0].total || 0);
  }

  async listUsers() {
    const { rows } = await this.pool.query(
      `select u.*, coalesce(w.available_balance, 0) as wallet_balance
       from users u
       left join wallets w on w.user_id = u.id
       order by u.created_at desc`
    );
    return rows;
  }

  async listBets() {
    const { rows } = await this.pool.query(
      `select
         b.id,
         b.user_id as "userId",
         b.stake,
         b.total_odds as odds,
         b.potential_win as "potentialPayout",
         b.status,
         b.created_at as "createdAt",
         bs.match_id as "eventId",
         bs.selection as market
       from bets b
       left join bet_selections bs on bs.bet_id = b.id
       order by b.created_at desc`
    );
    return rows.map((row) => ({
      ...row,
      stake: Number(row.stake),
      odds: Number(row.odds),
      potentialPayout: Number(row.potentialPayout)
    }));
  }

  async overview() {
    const [users, openBets, pendingKyc, events, txs] = await Promise.all([
      this.pool.query('select count(*)::int as count from users'),
      this.pool.query(`select count(*)::int as count from bets where status = 'open'`),
      this.pool.query(`select count(*)::int as count from users where kyc_status = 'pending'`),
      this.pool.query(`select count(*)::int as count from matches`),
      this.pool.query(`select count(*)::int as count from transactions`)
    ]);

    return {
      users: users.rows[0].count,
      openBets: openBets.rows[0].count,
      pendingKyc: pendingKyc.rows[0].count,
      events: events.rows[0].count,
      transactions: txs.rows[0].count
    };
  }

  async createSignal(payload) {
    const id = crypto.randomUUID();
    const { rows } = await this.pool.query(
      `insert into signals (id, game, prediction, odds, confidence, starts_at, created_by, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning
         id,
         game,
         prediction,
         odds,
         confidence,
         starts_at as "startsAt",
         created_by as "createdBy",
         status,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        id,
        payload.game,
        payload.prediction,
        Number(payload.odds),
        payload.confidence || 'medium',
        payload.startsAt,
        payload.createdBy,
        payload.status || 'pending'
      ]
    );
    return { ...rows[0], odds: Number(rows[0].odds) };
  }

  async listSignals({ status, createdBy, limit = 100 } = {}) {
    const params = [];
    const where = [];

    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (createdBy) {
      params.push(createdBy);
      where.push(`created_by = $${params.length}`);
    }
    params.push(limit);

    const { rows } = await this.pool.query(
      `select
         id,
         game,
         prediction,
         odds,
         confidence,
         starts_at as "startsAt",
         created_by as "createdBy",
         status,
         created_at as "createdAt",
         updated_at as "updatedAt"
       from signals
       ${where.length ? `where ${where.join(' and ')}` : ''}
       order by created_at desc
       limit $${params.length}`,
      params
    );
    return rows.map((r) => ({ ...r, odds: Number(r.odds) }));
  }

  async updateSignal(signalId, patch) {
    const fields = [];
    const values = [];
    let idx = 1;
    const map = {
      game: 'game',
      prediction: 'prediction',
      odds: 'odds',
      confidence: 'confidence',
      startsAt: 'starts_at',
      status: 'status'
    };

    Object.entries(map).forEach(([k, col]) => {
      if (Object.prototype.hasOwnProperty.call(patch, k)) {
        fields.push(`${col} = $${idx++}`);
        values.push(k === 'odds' ? Number(patch[k]) : patch[k]);
      }
    });
    if (!fields.length) return null;

    values.push(signalId);
    const { rows } = await this.pool.query(
      `update signals set ${fields.join(', ')}, updated_at = now()
       where id = $${idx}
       returning
         id,
         game,
         prediction,
         odds,
         confidence,
         starts_at as "startsAt",
         created_by as "createdBy",
         status,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      values
    );
    if (!rows[0]) return null;
    return { ...rows[0], odds: Number(rows[0].odds) };
  }

  async getAdminSettings() {
    const { rows } = await this.pool.query(
      `select value
       from admin_settings
       where key = 'global'
       limit 1`
    );
    return rows[0]?.value || null;
  }

  async updateAdminSettings(settings) {
    const { rows } = await this.pool.query(
      `insert into admin_settings (key, value, updated_at)
       values ('global', $1::jsonb, now())
       on conflict (key)
       do update set value = excluded.value, updated_at = now()
       returning value`,
      [JSON.stringify(settings)]
    );
    return rows[0]?.value || settings;
  }

  async addAudit(log) {
    await this.pool.query(
      `insert into audit_logs (actor_type, actor_id, action, entity_type, entity_id, metadata)
       values ($1, $2, $3, $4, $5, $6)`,
      [log.actorType, log.actorId || null, log.action, log.entityType || null, log.entityId || null, log.metadata || null]
    );
  }
}

module.exports = PostgresRepo;
