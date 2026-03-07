-- BetPesa core schema (PostgreSQL 15+)

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username varchar(24) not null unique,
  role varchar(20) not null default 'user',
  full_name varchar(120),
  email varchar(160) not null unique,
  phone varchar(32),
  password_hash text not null,
  country char(2) not null default 'KE',
  date_of_birth date not null,
  kyc_status varchar(16) not null default 'unverified' check (kyc_status in ('unverified', 'pending', 'verified', 'blocked')),
  daily_deposit_limit numeric(14,2) not null default 1000.00,
  self_excluded_until timestamptz,
  status varchar(16) not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_jti uuid not null unique,
  expires_at timestamptz not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists sports (
  id bigserial primary key,
  name varchar(64) not null unique,
  created_at timestamptz not null default now()
);

create table if not exists leagues (
  id bigserial primary key,
  sport_id bigint not null references sports(id) on delete cascade,
  provider_external_id varchar(80),
  name varchar(120) not null,
  country varchar(80),
  created_at timestamptz not null default now(),
  unique (sport_id, name)
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  league_id bigint not null references leagues(id) on delete cascade,
  provider_external_id varchar(80),
  team_home varchar(120) not null,
  team_away varchar(120) not null,
  start_time timestamptz not null,
  status varchar(16) not null default 'scheduled' check (status in ('scheduled', 'live', 'finished', 'cancelled')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists odds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  market_type varchar(40) not null,
  selection varchar(64) not null,
  odd_value numeric(10,4) not null check (odd_value > 1.0),
  source varchar(40) not null default 'manual',
  is_active boolean not null default true,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (match_id, market_type, selection, version)
);

create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  bet_type varchar(16) not null default 'single' check (bet_type in ('single', 'multi', 'system')),
  stake numeric(14,2) not null check (stake > 0),
  total_odds numeric(12,4) not null check (total_odds > 1.0),
  potential_win numeric(14,2) not null check (potential_win >= 0),
  status varchar(16) not null default 'open' check (status in ('open', 'won', 'lost', 'void', 'cashout')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bet_selections (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references bets(id) on delete cascade,
  match_id uuid not null references matches(id),
  market_type varchar(40) not null,
  selection varchar(64) not null,
  odd_value numeric(10,4) not null check (odd_value > 1.0),
  result varchar(16) not null default 'pending' check (result in ('pending', 'won', 'lost', 'void')),
  created_at timestamptz not null default now()
);

create table if not exists wallets (
  user_id uuid primary key references users(id) on delete cascade,
  available_balance numeric(14,2) not null default 0,
  locked_balance numeric(14,2) not null default 0,
  currency char(3) not null default 'KES',
  updated_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wallet_txn_type varchar(24) not null check (wallet_txn_type in ('deposit', 'withdrawal', 'stake_debit', 'payout_credit', 'refund_credit', 'adjustment', 'aviator_bet', 'aviator_payout')),
  direction varchar(8) not null check (direction in ('credit', 'debit')),
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'KES',
  status varchar(16) not null check (status in ('pending', 'completed', 'failed', 'reversed')),
  reference varchar(80) unique,
  provider varchar(32),
  provider_reference varchar(120),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  method_type varchar(24) not null check (method_type in ('mpesa', 'card', 'bank', 'crypto')),
  masked_account varchar(80) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  channel varchar(12) not null check (channel in ('email', 'sms', 'push')),
  subject varchar(120),
  body text not null,
  status varchar(16) not null check (status in ('queued', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists kyc_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider varchar(40) not null,
  provider_case_id varchar(120),
  status varchar(16) not null check (status in ('pending', 'approved', 'rejected')),
  details jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type varchar(16) not null check (actor_type in ('user', 'admin', 'system')),
  actor_id uuid,
  action varchar(80) not null,
  entity_type varchar(40),
  entity_id varchar(80),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  game varchar(60) not null,
  prediction text not null,
  odds numeric(10,4) not null check (odds > 1.0),
  confidence varchar(20) not null default 'medium',
  starts_at timestamptz not null,
  created_by uuid not null references users(id) on delete cascade,
  status varchar(20) not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_email on users(email);
create unique index if not exists idx_users_phone_unique on users(phone) where phone is not null;
create index if not exists idx_users_kyc_status on users(kyc_status);
create index if not exists idx_matches_start_time on matches(start_time);
create index if not exists idx_matches_status on matches(status);
create index if not exists idx_odds_match_active on odds(match_id, is_active);
create index if not exists idx_bets_user_created on bets(user_id, created_at desc);
create index if not exists idx_bets_status on bets(status);
create index if not exists idx_transactions_user_created on transactions(user_id, created_at desc);
create index if not exists idx_transactions_reference on transactions(reference);
create index if not exists idx_notifications_status on notifications(status);
create index if not exists idx_audit_created on audit_logs(created_at desc);
create index if not exists idx_signals_status_starts on signals(status, starts_at);
