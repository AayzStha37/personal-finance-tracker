-- Replace gross_amount/net_amount with a single amount column on income_entries.
-- Migrate net_amount as the canonical value.

CREATE TABLE income_entries_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id        INTEGER NOT NULL REFERENCES months(id)   ON DELETE CASCADE,
    account_id      INTEGER          REFERENCES accounts(id) ON DELETE SET NULL,
    source          TEXT    NOT NULL,
    amount          INTEGER NOT NULL CHECK (amount >= 0),
    currency        TEXT    NOT NULL REFERENCES currencies(code),
    received_date   TEXT    NOT NULL,
    week_of_month   INTEGER CHECK (week_of_month BETWEEN 1 AND 6),
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO income_entries_new (id, month_id, account_id, source, amount, currency, received_date, week_of_month, created_at, updated_at)
SELECT id, month_id, account_id, source, net_amount, currency, received_date, week_of_month, created_at, updated_at
FROM income_entries;

DROP TABLE income_entries;

ALTER TABLE income_entries_new RENAME TO income_entries;

CREATE INDEX idx_income_month ON income_entries(month_id);

CREATE TRIGGER trg_income_entries_updated_at
AFTER UPDATE ON income_entries FOR EACH ROW
BEGIN
    UPDATE income_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
