-- V7: Drop FX (exchange rates) feature.

DROP TRIGGER IF EXISTS trg_exchange_rates_updated_at;
DROP TABLE IF EXISTS exchange_rates;
