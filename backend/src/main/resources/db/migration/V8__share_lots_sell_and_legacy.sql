-- V8: Add lot_type (BUY/SELL) to share_lots, make month_id nullable (for legacy lots),
-- rename buy_price_per_share to price_per_share.

DROP TRIGGER IF EXISTS trg_share_lots_updated_at;

CREATE TABLE share_lots_new (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    investment_id       INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    month_id            INTEGER          REFERENCES months(id)      ON DELETE RESTRICT,
    lot_type            TEXT    NOT NULL  DEFAULT 'BUY' CHECK (lot_type IN ('BUY', 'SELL')),
    shares              NUMERIC NOT NULL  CHECK (shares > 0),
    price_per_share     INTEGER NOT NULL  CHECK (price_per_share > 0),
    purchased_date      TEXT    NOT NULL,
    created_at          TEXT    NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT    NOT NULL  DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO share_lots_new (id, investment_id, month_id, lot_type, shares, price_per_share, purchased_date, created_at, updated_at)
SELECT id, investment_id, month_id, 'BUY', shares, buy_price_per_share, purchased_date, created_at, updated_at
FROM share_lots;

DROP TABLE share_lots;
ALTER TABLE share_lots_new RENAME TO share_lots;

CREATE INDEX idx_share_lots_investment ON share_lots(investment_id);
CREATE INDEX idx_share_lots_month      ON share_lots(month_id);

CREATE TRIGGER trg_share_lots_updated_at
AFTER UPDATE ON share_lots FOR EACH ROW
BEGIN
    UPDATE share_lots SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
