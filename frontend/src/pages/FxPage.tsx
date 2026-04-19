import { useEffect, useMemo, useState } from "react";
import { api, HttpError } from "../api/client";
import type { CurrencyDto, ExchangeRateDto } from "../api/types";
import { Badge, Button, Card, EmptyState, Input, Label, Modal, Select } from "../components/ui";

const BASE_FALLBACK = "CAD";

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function FxPage() {
  const [base, setBase] = useState<string>(BASE_FALLBACK);
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [month, setMonth] = useState<string>(thisMonth());
  const [rates, setRates] = useState<ExchangeRateDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const nonBaseCodes = useMemo(
    () => currencies.map((c) => c.code).filter((c) => c !== base),
    [currencies, base],
  );

  async function load() {
    setError(null);
    try {
      const [cur, rs] = await Promise.all([
        api.listCurrencies(),
        api.listExchangeRates(month),
      ]);
      setBase(cur.base);
      setCurrencies(cur.currencies);
      setRates(rs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function autoFetch(to: string) {
    setBusy(to);
    setError(null);
    try {
      await api.autoFetchExchangeRate(base, to, month);
      await load();
    } catch (e) {
      setError(
        e instanceof HttpError
          ? `${to}: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setBusy(null);
    }
  }

  async function autoFetchAll() {
    for (const to of nonBaseCodes) {
      await autoFetch(to);
    }
  }

  const rateFor = (to: string) =>
    rates.find((r) => r.fromCurrency === base && r.toCurrency === to);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Exchange rates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Base currency <span className="font-medium text-slate-700">{base}</span>. Auto-fetch
            pulls the current spot rate from open.er-api.com (free, no key).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label>Effective month</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-40"
            />
          </div>
          <Button variant="secondary" onClick={() => setManualOpen(true)}>
            Manual entry
          </Button>
          <Button onClick={autoFetchAll} disabled={busy !== null || nonBaseCodes.length === 0}>
            {busy ? `Fetching ${busy}…` : "Fetch all"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <Card title={`Rates for ${month}`}>
        {nonBaseCodes.length === 0 ? (
          <EmptyState title="No other currencies configured" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 pr-4">Pair</th>
                  <th className="py-2 pr-4">Rate</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Fetched</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {nonBaseCodes.map((to) => {
                  const r = rateFor(to);
                  return (
                    <tr key={to} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-slate-800">
                        {base} → {to}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {r ? Number(r.rate).toFixed(6) : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        {r ? (
                          <Badge variant={r.source === "AUTO" ? "info" : "default"}>
                            {r.source}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-slate-500">
                        {r?.fetchedAt ? new Date(r.fetchedAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <Button
                          variant="secondary"
                          disabled={busy !== null}
                          onClick={() => autoFetch(to)}
                        >
                          {busy === to ? "Fetching…" : "Fetch"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ManualRateModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        base={base}
        month={month}
        codes={currencies.map((c) => c.code)}
        onSaved={async () => {
          setManualOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function ManualRateModal({
  open,
  onClose,
  base,
  month,
  codes,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  base: string;
  month: string;
  codes: string[];
  onSaved: () => void | Promise<void>;
}) {
  const nonBase = codes.filter((c) => c !== base);
  const [to, setTo] = useState<string>(nonBase[0] ?? "");
  const [rate, setRate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTo(nonBase[0] ?? "");
      setRate("");
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save() {
    setErr(null);
    const n = Number(rate);
    if (!to || !Number.isFinite(n) || n <= 0) {
      setErr("Enter a positive rate and select a target currency.");
      return;
    }
    setSaving(true);
    try {
      await api.upsertExchangeRate({
        fromCurrency: base,
        toCurrency: to,
        rate: n,
        effectiveMonth: month,
      });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manual exchange rate">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Overrides the auto-fetched rate for {base} → target in {month}. Saved with source
          MANUAL.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>From</Label>
            <Input value={base} disabled />
          </div>
          <div>
            <Label>To</Label>
            <Select value={to} onChange={(e) => setTo(e.target.value)}>
              {nonBase.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Rate (1 {base} = ? {to || "—"})</Label>
          <Input
            type="number"
            step="0.000001"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="e.g. 0.735"
          />
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
