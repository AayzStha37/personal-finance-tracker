-- V9__subscriptions.sql
-- Adds subscription plans + two new budget categories (SUBSCRIPTION, BUSINESS).

-- New budget categories
INSERT OR IGNORE INTO budget_categories (code, label, display_order) VALUES
    ('SUBSCRIPTION', 'Subscriptions', 75),
    ('BUSINESS',     'Business',      80);

-- Subscription plans table
CREATE TABLE subscription_plans (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    label          TEXT    NOT NULL,
    amount         INTEGER NOT NULL CHECK (amount >= 0),
    category_id    INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE RESTRICT,
    account_id     INTEGER NOT NULL REFERENCES accounts(id)          ON DELETE RESTRICT,
    currency       TEXT    NOT NULL REFERENCES currencies(code)       ON DELETE RESTRICT,
    start_month_id INTEGER NOT NULL REFERENCES months(id)            ON DELETE RESTRICT,
    active         INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TRIGGER trg_subscription_plans_updated_at
AFTER UPDATE ON subscription_plans FOR EACH ROW
BEGIN
    UPDATE subscription_plans
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = NEW.id;
END;

-- Back-link from expense entries to the subscription that generated them
ALTER TABLE expense_entries
    ADD COLUMN subscription_plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL;

CREATE INDEX idx_expense_entries_subscription ON expense_entries(subscription_plan_id);
