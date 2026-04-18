import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, HttpError } from "../api/client";
import type { BalanceUpdate, MonthSummaryDto } from "../api/types";
import { Badge, Button, Card, Input, StatusPill } from "../components/ui";
import { formatMoney, fromMinor, monthLabel, toMinor } from "../lib/money";
import { useApp } from "../state/AppContext";

export default function MonthDetailPage() {
  const { id } = useParams<{ id: string }>();
  const monthId = Number(id);
  const app = useApp();
  const { currencies } = app;

  const [summary, setSummary] = useState<MonthSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingClose, setEditingClose] = useState(false);
  const [closing, setClosing] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const s = await api.getMonthSummary(monthId);
      setSummary(s);
      const draft: Record<number, string> = {};
      s.balances.forEach((b) => {
        draft[b.accountId] = fromMinor(b.closingAmount, b.currency, currencies?.currencies);
      });
      setClosing(draft);
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [monthId]);

  async function saveClosing() {
    if (!summary) return;
    setBusy(true);
    try {
      const updates: BalanceUpdate[] = summary.balances.map((b) => ({
        accountId: b.accountId,
        openingAmount: b.openingAmount,
        closingAmount:
          closing[b.accountId] === "" || closing[b.accountId] == null
            ? null
            : toMinor(closing[b.accountId], b.currency, currencies?.currencies),
      }));
      await api.updateBalances(summary.month.id, updates);
      await load();
      setEditingClose(false);
      await app.refresh();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!summary) return;
    setBusy(true);
    try {
      await api.activateMonth(summary.month.id);
      await load();
      await app.refresh();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;
  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3">
        {error}
      </div>
    );
  }
  if (!summary) return null;

  const locked = summary.month.status === "LOCKED";

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-3">
            {monthLabel(summary.month.year, summary.month.month)}
            <StatusPill status={summary.month.status} />
            {summary.integrity.ok ? (
              <Badge variant="success">Integrity OK</Badge>
            ) : (
              <Badge variant="warn">Integrity failed</Badge>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Opened {summary.month.openedAt ? new Date(summary.month.openedAt).toLocaleString() : "—"}
            {summary.month.lockedAt && (
              <> · Locked {new Date(summary.month.lockedAt).toLocaleString()}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {summary.month.status === "DRAFT" && (
            <Button onClick={activate} disabled={busy || !summary.integrity.ok}>
              Activate
            </Button>
          )}
        </div>
      </header>

      <Card
        title="Balances"
        actions={
          !locked && (
            <>
              {editingClose ? (
                <>
                  <Button variant="ghost" onClick={() => setEditingClose(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={saveClosing} disabled={busy}>
                    {busy ? "Saving…" : "Save closing"}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setEditingClose(true)}>
                  Set closing balances
                </Button>
              )}
            </>
          )
        }
      >
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left py-2">Account</th>
              <th className="text-right">Opening</th>
              <th className="text-right">Closing</th>
              <th className="text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {summary.balances.map((b) => {
              const change =
                b.openingAmount != null && b.closingAmount != null
                  ? b.closingAmount - b.openingAmount
                  : null;
              return (
                <tr key={b.accountId} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{b.accountName}</td>
                  <td className="py-2 text-right text-slate-600">
                    {formatMoney(b.openingAmount, b.currency, currencies?.currencies)}
                  </td>
                  <td className="py-2 text-right text-slate-900 w-36">
                    {editingClose ? (
                      <Input
                        className="text-right"
                        inputMode="decimal"
                        value={closing[b.accountId] ?? ""}
                        onChange={(e) =>
                          setClosing({ ...closing, [b.accountId]: e.target.value })
                        }
                      />
                    ) : (
                      formatMoney(b.closingAmount, b.currency, currencies?.currencies)
                    )}
                  </td>
                  <td
                    className={`py-2 text-right ${
                      change == null
                        ? "text-slate-400"
                        : change === 0
                          ? "text-slate-500"
                          : change > 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                    }`}
                  >
                    {change == null
                      ? "—"
                      : (change > 0 ? "+" : "") +
                        formatMoney(change, b.currency, currencies?.currencies)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Budgets" subtitle={`Limits for ${monthLabel(summary.month.year, summary.month.month)}`}>
          {summary.budgets.length === 0 ? (
            <p className="text-sm text-slate-500">No budgets set.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-1.5">Category</th>
                  <th className="text-right">Limit</th>
                </tr>
              </thead>
              <tbody>
                {summary.budgets.map((b) => (
                  <tr key={b.categoryId} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-800">{b.categoryLabel}</td>
                    <td className="py-1.5 text-right">
                      {formatMoney(b.limitAmount, b.currency, currencies?.currencies)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Investments">
          {summary.investments.length === 0 ? (
            <p className="text-sm text-slate-500">No holdings tracked this month.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-1.5">Holding</th>
                  <th className="text-right">Shares</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Market</th>
                </tr>
              </thead>
              <tbody>
                {summary.investments.map((i) => (
                  <tr key={i.investmentId} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-800">{i.investmentName}</td>
                    <td className="py-1.5 text-right text-slate-600">
                      {i.shares != null ? String(i.shares) : "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      {formatMoney(i.amountInvested, i.currency, currencies?.currencies)}
                    </td>
                    <td className="py-1.5 text-right">
                      {formatMoney(i.marketValue, i.currency, currencies?.currencies)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Integrity comparisons" subtitle="Per-account prev.closing vs. curr.opening">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left py-1.5">Account</th>
              <th className="text-right">Prev closing</th>
              <th className="text-right">Opening</th>
              <th className="text-right">Δ</th>
              <th className="text-right">Match</th>
            </tr>
          </thead>
          <tbody>
            {summary.integrity.comparisons.map((c) => (
              <tr key={c.accountId} className="border-b border-slate-100">
                <td className="py-1.5 text-slate-800">{c.accountName}</td>
                <td className="py-1.5 text-right text-slate-600">
                  {formatMoney(c.previousClosing, c.currency, currencies?.currencies)}
                </td>
                <td className="py-1.5 text-right text-slate-900">
                  {formatMoney(c.currentOpening, c.currency, currencies?.currencies)}
                </td>
                <td
                  className={`py-1.5 text-right ${
                    c.delta == null || c.delta === 0 ? "text-slate-500" : "text-rose-600"
                  }`}
                >
                  {c.delta == null ? "—" : (c.delta > 0 ? "+" : "") + formatMoney(c.delta, c.currency, currencies?.currencies)}
                </td>
                <td className="py-1.5 text-right">
                  {c.matches ? <Badge variant="success">✓</Badge> : <Badge variant="danger">✗</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
