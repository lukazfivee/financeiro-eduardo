PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 120000,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida','ambos')),
  icon TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS categories_user_idx ON categories(user_id, name);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'carteira' CHECK (type IN ('carteira','conta_corrente','poupanca','cartao','dinheiro','investimento')),
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts(user_id, name);
CREATE INDEX IF NOT EXISTS accounts_user_active_idx ON accounts(user_id, archived_at, name);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  transaction_date TEXT NOT NULL,
  category_id TEXT,
  account_id TEXT,
  transfer_group_id TEXT,
  payment_method TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('pendente','pago','recebido','atrasado')),
  recurring_type TEXT NOT NULL DEFAULT 'nenhuma' CHECK (recurring_type IN ('nenhuma','mensal')),
  installment_count INTEGER NOT NULL DEFAULT 1 CHECK (installment_count >= 1),
  installment_number INTEGER NOT NULL DEFAULT 1 CHECK (installment_number >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_category_idx ON transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS transactions_user_status_date_idx ON transactions(user_id, status, transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_user_account_idx ON transactions(user_id, account_id);

CREATE TABLE IF NOT EXISTS service_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  client_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida')),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  transaction_date TEXT NOT NULL,
  category TEXT,
  payment_method TEXT,
  notes TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pendente' CHECK (payment_status IN ('pendente','pago','recebido','atrasado')),
  service_status TEXT NOT NULL DEFAULT 'em_execucao' CHECK (service_status IN ('orcamento','aprovado','em_execucao','em_andamento','aguardando_pagamento','concluido','recebido','cancelado')),
  contracted_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (contracted_amount_cents >= 0),
  received_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (received_amount_cents >= 0),
  expected_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (expected_cost_cents >= 0),
  actual_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (actual_cost_cents >= 0),
  recurring_type TEXT NOT NULL DEFAULT 'nenhuma' CHECK (recurring_type IN ('nenhuma','mensal')),
  installment_count INTEGER NOT NULL DEFAULT 1 CHECK (installment_count >= 1),
  installment_number INTEGER NOT NULL DEFAULT 1 CHECK (installment_number >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS service_transactions_user_date_idx ON service_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS service_transactions_user_service_idx ON service_transactions(user_id, service_name);
CREATE INDEX IF NOT EXISTS service_transactions_user_status_date_idx ON service_transactions(user_id, payment_status, transaction_date DESC);
CREATE INDEX IF NOT EXISTS service_transactions_user_category_date_idx ON service_transactions(user_id, category, transaction_date DESC);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT,
  month TEXT NOT NULL,
  limit_cents INTEGER NOT NULL DEFAULT 0 CHECK (limit_cents >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS budgets_user_month_idx ON budgets(user_id, month);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_user_idx ON audit_log(user_id, id DESC);
