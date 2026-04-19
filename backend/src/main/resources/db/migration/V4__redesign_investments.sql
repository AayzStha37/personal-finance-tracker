-- Redesign investments: drop account_id/active, replace snapshots with share lots.

CREATE TABLE investments_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    ticker      TEXT,
    type        TEXT    NOT NULL,
    currency    TEXT    NOT NULL REFERENCES currencies(code),
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO investments_new (id, name, ticker, type, currency, created_at, updated_at)
SELECT id, name, ticker, type, currency, created_at, updated_at
FROM investments;

DROP TABLE IF EXISTS monthly_investment_snapshots;

DROP TABLE investments;

ALTER TABLE investments_new RENAME TO investments;

CREATE TABLE share_lots (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    investment_id         INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    month_id              INTEGER NOT NULL REFERENCES months(id)      ON DELETE RESTRICT,
    shares                NUMERIC NOT NULL CHECK (shares > 0),
    buy_price_per_share   INTEGER NOT NULL CHECK (buy_price_per_share > 0),
    purchased_date        TEXT    NOT NULL,
    created_at            TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_share_lots_investment ON share_lots(investment_id);
CREATE INDEX idx_share_lots_month      ON share_lots(month_id);

CREATE TRIGGER trg_investments_updated_at
AFTER UPDATE ON investments FOR EACH ROW
BEGIN
    UPDATE investments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER trg_share_lots_updated_at
AFTER UPDATE ON share_lots FOR EACH ROW
BEGIN
    UPDATE share_lots SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
