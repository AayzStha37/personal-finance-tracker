CREATE TABLE expense_entries_new (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id           INTEGER NOT NULL REFERENCES months(id)            ON DELETE RESTRICT,
    category_id        INTEGER NOT NULL REFERENCES budget_categories(id) ON DELETE RESTRICT,
    description        TEXT    NOT NULL,
    amount             INTEGER NOT NULL CHECK (amount >= 0),
    currency           TEXT    NOT NULL REFERENCES currencies(code),
    tx_date            TEXT    NOT NULL,
    emi_installment_id INTEGER REFERENCES emi_installments(id) ON DELETE SET NULL,
    created_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO expense_entries_new
       (id, month_id, category_id, description, amount, currency, tx_date, emi_installment_id, created_at, updated_at)
SELECT  id, month_id, category_id, description, amount, currency, tx_date, emi_installment_id, created_at, updated_at
FROM expense_entries;

DROP TABLE expense_entries;

ALTER TABLE expense_entries_new RENAME TO expense_entries;

CREATE INDEX idx_expenses_month_category ON expense_entries(month_id, category_id);
CREATE INDEX idx_expenses_emi            ON expense_entries(emi_installment_id);

CREATE TRIGGER trg_expense_entries_updated_at
AFTER UPDATE ON expense_entries FOR EACH ROW
BEGIN
    UPDATE expense_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
