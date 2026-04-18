-- V1__init.sql
-- Initial schema for the Personal Finance Tracker.
-- Conventions:
--   * Monetary amounts are INTEGER minor units (e.g. cents). Display logic converts.
--   * Timestamps are TEXT ISO-8601 (SQLite CURRENT_TIMESTAMP is UTC "YYYY-MM-DD HH:MM:SS").
--   * Every table carries created_at and updated_at; updated_at is maintained by triggers.
--   * FK enforcement is enabled per connection via spring.datasource.hikari.connection-init-sql.

-- ---------------------------------------------------------------------------
-- Reference / config
-- ---------------------------------------------------------------------------

CREATE TABLE currencies (
    code       TEXT    PRIMARY KEY,
    symbol     TEXT    NOT NULL,
    decimals   INTEGER NOT NULL DEFAULT 2,
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exchange_rates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    from_currency   TEXT    NOT NULL REFERENCES currencies(code),
    to_currency     TEXT    NOT NULL REFERENCES currencies(code),
    rate            NUMERIC NOT NULL CHECK (rate > 0),
    effective_month TEXT    NOT NULL,                                    -- 'YYYY-MM'
    source          TEXT    NOT NULL DEFAULT 'MANUAL'
                        CHECK (source IN ('AUTO', 'MANUAL')),
    fetched_at      TEXT,
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (from_currency, to_currency, effective_month)
);
CREATE INDEX idx_exchange_rates_month ON exchange_rates(effective_month);

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------

CREATE TABLE months (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    year          INTEGER NOT NULL,
    month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    status        TEXT    NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT', 'ACTIVE', 'LOCKED')),
    opened_at     TEXT,
    locked_at     TEXT,
    integrity_ok  INTEGER NOT NULL DEFAULT 0 CHECK (integrity_ok IN (0, 1)),
    notes         TEXT,
    created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (year, month)
);

-- ---------------------------------------------------------------------------
-- Accounts ("Master Roaster" holders)
-- ---------------------------------------------------------------------------

CREATE TABLE accounts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL UNIQUE,
    kind           TEXT    NOT NULL
                       CHECK (kind IN ('BANK', 'CASH', 'CREDIT', 'INVESTMENT')),
    currency       TEXT    NOT NULL REFERENCES currencies(code),
    active         INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    display_order  INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monthly_balance_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id        INTEGER NOT NULL REFERENCES months(id)   ON DELETE CASCADE,
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    opening_amount  INTEGER NOT NULL,
    closing_amount  INTEGER,
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (month_id, account_id)
);
CREATE INDEX idx_balance_snapshots_month ON monthly_balance_snapshots(month_id);

-- ---------------------------------------------------------------------------
-- Budgets & Expenses
-- ---------------------------------------------------------------------------

CREATE TABLE budget_categories (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    code           TEXT    NOT NULL UNIQUE,
    label          TEXT    NOT NULL,
    display_order  INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monthly_budgets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id      INTEGER NOT NULL REFERENCES months(id)            ON DELETE CASCADE,
    category_id   INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE RESTRICT,
    limit_amount  INTEGER NOT NULL CHECK (limit_amount >= 0),
    currency      TEXT    NOT NULL REFERENCES currencies(code),
    created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (month_id, category_id)
);

-- expense_entries references emi_installments(id); installments is created
-- later in this script, so declare FK without inline reference and add it via
-- constraint. SQLite allows forward references inside a single schema, but we
-- keep things clear by defining the column as INTEGER and relying on FK
-- enforcement once the target table exists. (SQLite validates FK targets at
-- connect time with PRAGMA foreign_keys=ON, not at table-create time.)
CREATE TABLE expense_entries (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id           INTEGER NOT NULL REFERENCES months(id)            ON DELETE RESTRICT,
    category_id        INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE RESTRICT,
    account_id         INTEGER NOT NULL REFERENCES accounts(id)          ON DELETE RESTRICT,
    description        TEXT    NOT NULL,
    amount             INTEGER NOT NULL CHECK (amount >= 0),
    currency           TEXT    NOT NULL REFERENCES currencies(code),
    tx_date            TEXT    NOT NULL,                                 -- YYYY-MM-DD
    emi_installment_id INTEGER REFERENCES emi_installments(id) ON DELETE SET NULL,
    created_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_expenses_month_category ON expense_entries(month_id, category_id);
CREATE INDEX idx_expenses_account        ON expense_entries(account_id);
CREATE INDEX idx_expenses_emi            ON expense_entries(emi_installment_id);

-- ---------------------------------------------------------------------------
-- MOMO Business tracker (side-business ledger)
-- ---------------------------------------------------------------------------

CREATE TABLE momo_business_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id    INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
    item        TEXT    NOT NULL,
    amount      INTEGER NOT NULL CHECK (amount >= 0),
    currency    TEXT    NOT NULL REFERENCES currencies(code),
    entry_date  TEXT    NOT NULL,                                         -- YYYY-MM-DD
    entry_type  TEXT    NOT NULL CHECK (entry_type IN ('SALE', 'EXPENSE')),
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_momo_month ON momo_business_entries(month_id);

-- ---------------------------------------------------------------------------
-- Income
-- ---------------------------------------------------------------------------

CREATE TABLE income_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id        INTEGER NOT NULL REFERENCES months(id)   ON DELETE CASCADE,
    account_id      INTEGER          REFERENCES accounts(id) ON DELETE SET NULL,
    source          TEXT    NOT NULL,
    gross_amount    INTEGER NOT NULL CHECK (gross_amount >= 0),
    net_amount      INTEGER NOT NULL CHECK (net_amount >= 0),
    currency        TEXT    NOT NULL REFERENCES currencies(code),
    received_date   TEXT    NOT NULL,                                     -- YYYY-MM-DD
    week_of_month   INTEGER CHECK (week_of_month BETWEEN 1 AND 6),
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_income_month ON income_entries(month_id);

-- ---------------------------------------------------------------------------
-- Investments
-- ---------------------------------------------------------------------------

CREATE TABLE investments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    ticker      TEXT,
    type        TEXT    NOT NULL,                                          -- free-text: ETF/STOCK/MF/CRYPTO/BOND/...
    currency    TEXT    NOT NULL REFERENCES currencies(code),
    account_id  INTEGER          REFERENCES accounts(id) ON DELETE SET NULL,
    active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monthly_investment_snapshots (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id          INTEGER NOT NULL REFERENCES months(id)      ON DELETE CASCADE,
    investment_id     INTEGER NOT NULL REFERENCES investments(id) ON DELETE RESTRICT,
    shares            NUMERIC NOT NULL CHECK (shares >= 0),
    amount_invested   INTEGER NOT NULL CHECK (amount_invested >= 0),       -- cumulative cost basis
    market_value      INTEGER CHECK (market_value IS NULL OR market_value >= 0),
    net_change        INTEGER,                                             -- vs previous month
    created_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (month_id, investment_id)
);
CREATE INDEX idx_investment_snapshots_month ON monthly_investment_snapshots(month_id);

-- ---------------------------------------------------------------------------
-- EMIs (installment plans)
-- ---------------------------------------------------------------------------

CREATE TABLE emi_plans (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    label                TEXT    NOT NULL,
    principal            INTEGER NOT NULL CHECK (principal >= 0),
    installment_amount   INTEGER NOT NULL CHECK (installment_amount >= 0),
    total_installments   INTEGER NOT NULL CHECK (total_installments > 0),
    start_month_id       INTEGER NOT NULL REFERENCES months(id)            ON DELETE RESTRICT,
    account_id           INTEGER NOT NULL REFERENCES accounts(id)          ON DELETE RESTRICT,
    category_id          INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE RESTRICT,
    currency             TEXT    NOT NULL REFERENCES currencies(code),
    active               INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE emi_installments (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id            INTEGER NOT NULL REFERENCES emi_plans(id)        ON DELETE CASCADE,
    seq_no             INTEGER NOT NULL CHECK (seq_no > 0),
    due_month_id       INTEGER NOT NULL REFERENCES months(id)           ON DELETE RESTRICT,
    amount             INTEGER NOT NULL CHECK (amount >= 0),
    status             TEXT    NOT NULL DEFAULT 'PROJECTED'
                           CHECK (status IN ('PROJECTED', 'PAID', 'SKIPPED')),
    expense_entry_id   INTEGER REFERENCES expense_entries(id) ON DELETE SET NULL,
    created_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (plan_id, seq_no)
);
CREATE INDEX idx_emi_installments_due    ON emi_installments(due_month_id, status);
CREATE INDEX idx_emi_installments_plan   ON emi_installments(plan_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_currencies_updated_at
AFTER UPDATE ON currencies FOR EACH ROW
BEGIN
    UPDATE currencies SET updated_at = CURRENT_TIMESTAMP WHERE code = OLD.code;
END;

CREATE TRIGGER trg_exchange_rates_updated_at
AFTER UPDATE ON exchange_rates FOR EACH ROW
BEGIN
    UPDATE exchange_rates SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_months_updated_at
AFTER UPDATE ON months FOR EACH ROW
BEGIN
    UPDATE months SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_accounts_updated_at
AFTER UPDATE ON accounts FOR EACH ROW
BEGIN
    UPDATE accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_monthly_balance_snapshots_updated_at
AFTER UPDATE ON monthly_balance_snapshots FOR EACH ROW
BEGIN
    UPDATE monthly_balance_snapshots SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_budget_categories_updated_at
AFTER UPDATE ON budget_categories FOR EACH ROW
BEGIN
    UPDATE budget_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_monthly_budgets_updated_at
AFTER UPDATE ON monthly_budgets FOR EACH ROW
BEGIN
    UPDATE monthly_budgets SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_expense_entries_updated_at
AFTER UPDATE ON expense_entries FOR EACH ROW
BEGIN
    UPDATE expense_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_momo_business_entries_updated_at
AFTER UPDATE ON momo_business_entries FOR EACH ROW
BEGIN
    UPDATE momo_business_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_income_entries_updated_at
AFTER UPDATE ON income_entries FOR EACH ROW
BEGIN
    UPDATE income_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_investments_updated_at
AFTER UPDATE ON investments FOR EACH ROW
BEGIN
    UPDATE investments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_monthly_investment_snapshots_updated_at
AFTER UPDATE ON monthly_investment_snapshots FOR EACH ROW
BEGIN
    UPDATE monthly_investment_snapshots SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_emi_plans_updated_at
AFTER UPDATE ON emi_plans FOR EACH ROW
BEGIN
    UPDATE emi_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_emi_installments_updated_at
AFTER UPDATE ON emi_installments FOR EACH ROW
BEGIN
    UPDATE emi_installments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
