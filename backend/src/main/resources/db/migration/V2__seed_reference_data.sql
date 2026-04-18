-- V2__seed_reference_data.sql
-- Seed reference data: currencies and budget categories.
-- Uses INSERT OR IGNORE so the migration is re-runnable without clobbering edits.

-- Currencies ----------------------------------------------------------------
INSERT OR IGNORE INTO currencies (code, symbol, decimals) VALUES
    ('CAD', '$',  2),
    ('USD', '$',  2),
    ('INR', '₹',  2),
    ('NPR', 'रू', 2);

-- Budget categories ---------------------------------------------------------
-- Codes, labels, and display order. Budget amounts live in monthly_budgets
-- and are set per-month via the Month Initialization wizard.
INSERT OR IGNORE INTO budget_categories (code, label, display_order) VALUES
    ('MANDATORY',         'Mandatory Expenses', 10),
    ('GROCERY',           'Grocery',            20),
    ('HOUSEHOLD',         'Household Items',    30),
    ('DINE_OUT',          'Dine-out / Ordering',40),
    ('PERSONAL_SHOPPING', 'Personal Shopping',  50),
    ('UNPLANNED',         'Unplanned Expenses', 60),
    ('MISC',              'Miscellaneous',      70);
