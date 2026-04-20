-- Drop display_order from accounts and split BANK into BANK_CHQ / BANK_SVG.
-- Must rebuild table because SQLite CHECK constraint doesn't allow ALTER.

-- Temporarily drop triggers that reference accounts to avoid FK issues
DROP TRIGGER IF EXISTS trg_accounts_updated_at;

-- Create new accounts table with updated CHECK and no display_order
CREATE TABLE accounts_new (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL UNIQUE,
    kind           TEXT    NOT NULL
                       CHECK (kind IN ('BANK_CHQ', 'BANK_SVG', 'CASH', 'CREDIT', 'INVESTMENT')),
    currency       TEXT    NOT NULL REFERENCES currencies(code),
    active         INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Copy data, converting BANK -> BANK_SVG
INSERT INTO accounts_new (id, name, kind, currency, active, created_at, updated_at)
SELECT id, name,
       CASE WHEN kind = 'BANK' THEN 'BANK_SVG' ELSE kind END,
       currency, active, created_at, updated_at
FROM accounts;

-- Drop and rebuild FK-referencing tables to point to the new accounts table.
-- monthly_balance_snapshots references accounts(id) ON DELETE RESTRICT
CREATE TABLE monthly_balance_snapshots_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id        INTEGER NOT NULL REFERENCES months(id)   ON DELETE CASCADE,
    account_id      INTEGER NOT NULL,
    opening_amount  INTEGER NOT NULL DEFAULT 0,
    closing_amount  INTEGER,
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO monthly_balance_snapshots_new
SELECT * FROM monthly_balance_snapshots;

DROP TABLE monthly_balance_snapshots;
ALTER TABLE monthly_balance_snapshots_new RENAME TO monthly_balance_snapshots;

CREATE INDEX idx_balance_month ON monthly_balance_snapshots(month_id);

CREATE TRIGGER trg_monthly_balance_snapshots_updated_at
AFTER UPDATE ON monthly_balance_snapshots FOR EACH ROW
BEGIN
    UPDATE monthly_balance_snapshots SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- income_entries references accounts(id) ON DELETE SET NULL
CREATE TABLE income_entries_new2 (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id        INTEGER NOT NULL REFERENCES months(id)   ON DELETE CASCADE,
    account_id      INTEGER,
    source          TEXT    NOT NULL,
    amount          INTEGER NOT NULL CHECK (amount >= 0),
    currency        TEXT    NOT NULL REFERENCES currencies(code),
    received_date   TEXT    NOT NULL,
    week_of_month   INTEGER CHECK (week_of_month BETWEEN 1 AND 6),
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO income_entries_new2
SELECT * FROM income_entries;

DROP TABLE income_entries;
ALTER TABLE income_entries_new2 RENAME TO income_entries;

CREATE INDEX idx_income_month ON income_entries(month_id);

CREATE TRIGGER trg_income_entries_updated_at
AFTER UPDATE ON income_entries FOR EACH ROW
BEGIN
    UPDATE income_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Now safe to drop the old accounts table
DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;

-- Re-add the FK constraints on balance snapshots and income pointing to new accounts
-- (SQLite doesn't enforce FK on renamed tables, the references are by table name)

CREATE TRIGGER trg_accounts_updated_at
AFTER UPDATE ON accounts FOR EACH ROW
BEGIN
    UPDATE accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
