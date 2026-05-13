-- V10__subscription_drop_account.sql
-- Remove account_id from subscription_plans (not needed; category is auto-assigned).
-- SQLite does not support DROP COLUMN before 3.35, so we recreate the table.

CREATE TABLE subscription_plans_new (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    label          TEXT    NOT NULL,
    amount         INTEGER NOT NULL CHECK (amount >= 0),
    category_id    INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE RESTRICT,
    currency       TEXT    NOT NULL REFERENCES currencies(code)       ON DELETE RESTRICT,
    start_month_id INTEGER NOT NULL REFERENCES months(id)            ON DELETE RESTRICT,
    active         INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

INSERT INTO subscription_plans_new
    SELECT id, label, amount, category_id, currency, start_month_id, active, created_at, updated_at
    FROM subscription_plans;

DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at;
DROP TABLE subscription_plans;
ALTER TABLE subscription_plans_new RENAME TO subscription_plans;

CREATE TRIGGER trg_subscription_plans_updated_at
AFTER UPDATE ON subscription_plans FOR EACH ROW
BEGIN
    UPDATE subscription_plans
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;
