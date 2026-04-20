import { useEffect, useState } from "react";
import { api, HttpError } from "../api/client";
import type { InvestmentDto, ShareLotDto } from "../api/types";
import { Badge, Button, Card, Input, Label, Modal, Select } from "../components/ui";
import { formatMoney, toMinor } from "../lib/money";
import { useApp } from "../state/AppContext";

const INVESTMENT_TYPES = ["OTHER", "ETF", "STOCK", "MF", "CRYPTO", "BOND", "PPF", "RRSP", "FHSA"];

interface InvestmentRow extends InvestmentDto {
  lots: ShareLotDto[];
  totalShares: number;
  totalInvested: number; // net cost basis (buys - sell proceeds), minor units
  currentPrice: number | null;
  currentValue: number | null;
  profitLoss: number | null;
}

export default function InvestmentsPage() {
  const { currencies } = useApp();

  const [rows, setRows] = useState<InvestmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InvestmentDto | null>(null);
  const [addingLot, setAddingLot] = useState<InvestmentDto | null>(null);
  const [sellingFrom, setSellingFrom] = useState<InvestmentRow | null>(null);
  const [addingPriorHolding, setAddingPriorHolding] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const investments = await api.listInvestments();

      const lotsMap = new Map<number, ShareLotDto[]>();
      await Promise.all(
        investments.map(async (inv) => {
          const lots = await api.listInvestmentLots(inv.id);
          lotsMap.set(inv.id, lots);
        }),
      );

      const tickerMap = new Map<string, number[]>();
      for (const inv of investments) {
        if (inv.ticker) {
          const ids = tickerMap.get(inv.ticker) ?? [];
          ids.push(inv.id);
          tickerMap.set(inv.ticker, ids);
        }
      }

      let prices: Record<string, number> = {};
      if (tickerMap.size > 0) {
        try {
          const tickers = [...tickerMap.keys()].join(",");
          const res = await fetch(`/api/quotes?tickers=${encodeURIComponent(tickers)}`);
          if (res.ok) prices = await res.json();
        } catch {
          // Best-effort
        }
      }

      const built: InvestmentRow[] = investments.map((inv) => {
        const lots = lotsMap.get(inv.id) ?? [];
        const decimals = currencies?.currencies.find((c) => c.code === inv.currency)?.decimals ?? 2;
        const factor = Math.pow(10, decimals);

        let totalShares = 0;
        let totalBuyCost = 0;
        let totalSellProceeds = 0;
        for (const lot of lots) {
          const s = Number(lot.shares);
          if (lot.lotType === "SELL") {
            totalShares -= s;
            totalSellProceeds += Math.round(s * lot.pricePerShare);
          } else {
            totalShares += s;
            totalBuyCost += Math.round(s * lot.pricePerShare);
          }
        }
        const totalInvested = totalBuyCost - totalSellProceeds;

        const currentPrice = inv.ticker ? (prices[inv.ticker] ?? null) : null;
        const currentValue = currentPrice != null
          ? Math.round(totalShares * currentPrice * factor)
          : null;
        const profitLoss = currentValue != null ? currentValue - totalInvested : null;

        return { ...inv, lots, totalShares, totalInvested, currentPrice, currentValue, profitLoss };
      });

      setRows(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const netInvested = rows.reduce((s, r) => s + r.totalInvested, 0);
  const netValue = rows.every((r) => r.currentValue != null)
    ? rows.reduce((s, r) => s + (r.currentValue ?? 0), 0)
    : null;
  const netPL = netValue != null ? netValue - netInvested : null;

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-slate-900">Investments</h1>
        <Button onClick={() => setAddingPriorHolding(true)}>+ Add holding</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total invested</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">
            {formatMoney(netInvested, "CAD", currencies?.currencies)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current value</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">
            {netValue != null ? formatMoney(netValue, "CAD", currencies?.currencies) : "—"}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Profit / Loss</p>
          <p className={`text-xl font-semibold mt-1 ${netPL == null ? "text-slate-400" : netPL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {netPL != null
              ? (netPL >= 0 ? "+" : "") + formatMoney(netPL, "CAD", currencies?.currencies)
              : "—"}
          </p>
        </div>
      </div>

      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No investments yet. Add holdings from each month&apos;s page or use &quot;+ Shares&quot;.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2">Name</th>
                <th className="text-left">Ticker</th>
                <th className="text-left">Type</th>
                <th className="text-right">Shares</th>
                <th className="text-right">Total invested</th>
                <th className="text-right">Current price</th>
                <th className="text-right">Current value</th>
                <th className="text-right">P/L</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{r.name}</td>
                  <td className="py-2 text-slate-600">{r.ticker ?? "—"}</td>
                  <td className="py-2">
                    <Badge variant="default">{r.type}</Badge>
                  </td>
                  <td className="py-2 text-right text-slate-600">
                    {r.totalShares > 0 ? r.totalShares.toFixed(4).replace(/\.?0+$/, "") : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {formatMoney(r.totalInvested, r.currency, currencies?.currencies)}
                  </td>
                  <td className="py-2 text-right text-slate-600">
                    {r.currentPrice != null ? r.currentPrice.toFixed(2) : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {r.currentValue != null
                      ? formatMoney(r.currentValue, r.currency, currencies?.currencies)
                      : "—"}
                  </td>
                  <td
                    className={`py-2 text-right font-medium ${
                      r.profitLoss == null
                        ? "text-slate-400"
                        : r.profitLoss >= 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                    }`}
                  >
                    {r.profitLoss != null
                      ? (r.profitLoss >= 0 ? "+" : "") +
                        formatMoney(r.profitLoss, r.currency, currencies?.currencies)
                      : "—"}
                  </td>
                  <td className="py-2 text-right space-x-2">
                    <button
                      className="text-slate-700 hover:text-slate-900 text-sm font-medium"
                      onClick={() => setEditing(r)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      onClick={() => setAddingLot(r)}
                    >
                      + Shares
                    </button>
                    {r.totalShares > 0 && (
                      <button
                        className="text-amber-600 hover:text-amber-800 text-sm font-medium"
                        onClick={() => setSellingFrom(r)}
                      >
                        Sell
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <InvestmentEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadAll();
          }}
        />
      )}

      {addingLot && (
        <AddSharesModal
          investment={addingLot}
          onClose={() => setAddingLot(null)}
          onSaved={async () => {
            setAddingLot(null);
            await loadAll();
          }}
        />
      )}

      {sellingFrom && (
        <SellSharesModal
          investment={sellingFrom}
          onClose={() => setSellingFrom(null)}
          onSaved={async () => {
            setSellingFrom(null);
            await loadAll();
          }}
        />
      )}

      {addingPriorHolding && (
        <AddPriorHoldingModal
          investments={rows}
          onClose={() => setAddingPriorHolding(false)}
          onSaved={async () => {
            setAddingPriorHolding(false);
            await loadAll();
          }}
        />
      )}
    </div>
  );
}

function InvestmentEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: InvestmentDto;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { currencies } = useApp();
  const [name, setName] = useState(initial.name);
  const [ticker, setTicker] = useState(initial.ticker ?? "");
  const [type, setType] = useState(initial.type);
  const [currency, setCurrency] = useState(initial.currency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.updateInvestment(initial.id, {
        name,
        ticker: ticker.trim() || null,
        type,
        currency,
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${initial.name}? All share lots will also be deleted.`)) return;
    setBusy(true);
    try {
      await api.deleteInvestment(initial.id);
      await onSaved();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit — ${initial.name}`}>
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Ticker</Label>
            <Input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="VFV.TO" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {INVESTMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {(currencies?.currencies ?? []).map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </Select>
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex justify-between mt-6 pt-4 border-t border-slate-200">
        <Button variant="danger" onClick={remove} disabled={busy}>Delete</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddSharesModal({
  investment,
  onClose,
  onSaved,
}: {
  investment: InvestmentDto;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { currencies, months } = useApp();
  const today = new Date().toISOString().slice(0, 10);

  const [prior, setPrior] = useState(false);
  const [monthId, setMonthId] = useState<number>(months[0]?.id ?? 0);
  const [shares, setShares] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [purchasedDate, setPurchasedDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const writableMonths = months.filter((m) => m.status !== "LOCKED");

  async function submit() {
    if (!shares || !buyPrice) {
      setError("Shares and buy price are required.");
      return;
    }
    const sharesNum = Number(shares);
    if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
      setError("Shares must be a positive number.");
      return;
    }
    const buyMinor = toMinor(buyPrice, investment.currency, currencies?.currencies);
    if (buyMinor == null || buyMinor <= 0) {
      setError("Buy price must be a positive number.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (prior) {
        await api.createLegacyShareLot({
          investmentId: investment.id,
          lotType: "BUY",
          shares: sharesNum,
          pricePerShare: buyMinor,
          purchasedDate,
        });
      } else {
        await api.createShareLot(monthId, {
          investmentId: investment.id,
          lotType: "BUY",
          shares: sharesNum,
          pricePerShare: buyMinor,
          purchasedDate,
        });
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Add shares — ${investment.name}`} size="md">
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={prior}
            onChange={(e) => setPrior(e.target.checked)}
            className="rounded border-slate-300"
          />
          Prior holding (purchased before using tracker)
        </label>

        {!prior && (
          <div>
            <Label>Month</Label>
            <Select value={monthId} onChange={(e) => setMonthId(Number(e.target.value))}>
              {writableMonths.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.year}-{String(m.month).padStart(2, "0")} ({m.status})
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Shares</Label>
            <Input inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} />
          </div>
          <div>
            <Label>Buy price / share ({investment.currency})</Label>
            <Input inputMode="decimal" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
          </div>
          <div>
            <Label>Purchase date</Label>
            <Input type="date" value={purchasedDate} onChange={(e) => setPurchasedDate(e.target.value)} />
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy || (!prior && writableMonths.length === 0)}>
          {busy ? "Saving…" : "Add shares"}
        </Button>
      </div>
    </Modal>
  );
}

function SellSharesModal({
  investment,
  onClose,
  onSaved,
}: {
  investment: InvestmentRow;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { currencies, months } = useApp();
  const today = new Date().toISOString().slice(0, 10);

  const [prior, setPrior] = useState(false);
  const [monthId, setMonthId] = useState<number>(months[0]?.id ?? 0);
  const [shares, setShares] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellDate, setSellDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const writableMonths = months.filter((m) => m.status !== "LOCKED");

  async function submit() {
    if (!shares || !sellPrice) {
      setError("Shares and sell price are required.");
      return;
    }
    const sharesNum = Number(shares);
    if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
      setError("Shares must be a positive number.");
      return;
    }
    if (sharesNum > investment.totalShares) {
      setError(`Cannot sell more than ${investment.totalShares} shares.`);
      return;
    }
    const sellMinor = toMinor(sellPrice, investment.currency, currencies?.currencies);
    if (sellMinor == null || sellMinor <= 0) {
      setError("Sell price must be a positive number.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const req = {
        investmentId: investment.id,
        lotType: "SELL" as const,
        shares: sharesNum,
        pricePerShare: sellMinor,
        purchasedDate: sellDate,
      };
      if (prior) {
        await api.createLegacyShareLot(req);
      } else {
        await api.createShareLot(monthId, req);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Sell shares — ${investment.name}`} size="md">
      <p className="text-sm text-slate-500 mb-4">
        Available: {investment.totalShares.toFixed(4).replace(/\.?0+$/, "")} shares
      </p>
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={prior}
            onChange={(e) => setPrior(e.target.checked)}
            className="rounded border-slate-300"
          />
          Prior sale (sold before using tracker)
        </label>

        {!prior && (
          <div>
            <Label>Month</Label>
            <Select value={monthId} onChange={(e) => setMonthId(Number(e.target.value))}>
              {writableMonths.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.year}-{String(m.month).padStart(2, "0")} ({m.status})
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Shares to sell</Label>
            <Input inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} />
          </div>
          <div>
            <Label>Sell price / share ({investment.currency})</Label>
            <Input inputMode="decimal" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
          </div>
          <div>
            <Label>Sell date</Label>
            <Input type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} />
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy || (!prior && writableMonths.length === 0)}>
          {busy ? "Selling…" : "Sell shares"}
        </Button>
      </div>
    </Modal>
  );
}

function AddPriorHoldingModal({
  investments,
  onClose,
  onSaved,
}: {
  investments: InvestmentDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { currencies } = useApp();
  const today = new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<"existing" | "new">(investments.length > 0 ? "existing" : "new");
  const [investmentId, setInvestmentId] = useState<number>(investments[0]?.id ?? 0);

  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState(INVESTMENT_TYPES[0]);
  const [currency, setCurrency] = useState(currencies?.currencies[0]?.code ?? "CAD");

  const [shares, setShares] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [purchasedDate, setPurchasedDate] = useState(today);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!shares || !buyPrice) {
      setError("Shares and buy price are required.");
      return;
    }
    const sharesNum = Number(shares);
    if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
      setError("Shares must be a positive number.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let targetId = investmentId;

      if (mode === "new") {
        if (!name.trim()) {
          setError("Name is required for a new investment.");
          setBusy(false);
          return;
        }
        const inv = await api.createInvestment({
          name: name.trim(),
          ticker: ticker.trim() || null,
          type,
          currency,
        });
        targetId = inv.id;
      }

      const lotCurrency = mode === "new"
        ? currency
        : investments.find((i) => i.id === targetId)?.currency ?? "CAD";
      const buyMinor = toMinor(buyPrice, lotCurrency, currencies?.currencies);
      if (buyMinor == null || buyMinor <= 0) {
        setError("Buy price must be a positive number.");
        setBusy(false);
        return;
      }

      await api.createLegacyShareLot({
        investmentId: targetId,
        lotType: "BUY",
        shares: sharesNum,
        pricePerShare: buyMinor,
        purchasedDate,
      });

      await onSaved();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add holding" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Investments prior to tracker use
        </p>
        {investments.length > 0 && (
          <div className="flex gap-2">
            <button
              className={`text-sm px-3 py-1 rounded-full ${mode === "existing" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
              onClick={() => setMode("existing")}
            >
              Existing investment
            </button>
            <button
              className={`text-sm px-3 py-1 rounded-full ${mode === "new" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
              onClick={() => setMode("new")}
            >
              New investment
            </button>
          </div>
        )}

        {mode === "existing" ? (
          <div>
            <Label>Investment</Label>
            <Select value={investmentId} onChange={(e) => setInvestmentId(Number(e.target.value))}>
              {investments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} {i.ticker ? `(${i.ticker})` : ""} — {i.currency}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. XEQT" />
            </div>
            <div>
              <Label>Ticker</Label>
              <Input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {INVESTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Currency</Label>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {(currencies?.currencies ?? []).map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Shares</Label>
            <Input inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} />
          </div>
          <div>
            <Label>Buy price / share</Label>
            <Input inputMode="decimal" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
          </div>
          <div>
            <Label>Purchase date</Label>
            <Input type="date" value={purchasedDate} onChange={(e) => setPurchasedDate(e.target.value)} />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Add holding"}
        </Button>
      </div>
    </Modal>
  );
}
