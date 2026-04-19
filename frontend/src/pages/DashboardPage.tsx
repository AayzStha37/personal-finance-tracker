import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import type { MonthSummaryDto } from "../api/types";
import { Button, Card, EmptyState, StatusPill } from "../components/ui";
import { formatMoney, monthLabel, signedMoney } from "../lib/money";
import NewMonthWizard from "../features/newMonth/NewMonthWizard";
import { useApp } from "../state/AppContext";

export default function DashboardPage() {
  const app = useApp();
  const [summary, setSummary] = useState<MonthSummaryDto | null>(null);
  const [prev, setPrev] = useState<MonthSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  async function loadLatest() {
    setLoading(true);
    setError(null);
    try {
      const months = await api.listMonths();
      if (months.length === 0) {
        setSummary(null);
        setPrev(null);
        return;
      }
      const latest = months[0]; // sorted desc by year/month
      const s = await api.getMonthSummary(latest.id);
      setSummary(s);
      if (s.previousMonthId != null) {
        const p = await api.getMonthSummary(s.previousMonthId);
        setPrev(p);
      } else {
        setPrev(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLatest();
  }, [app.months.length]);

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;
  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3">
        {error}
      </div>
    );
  }

  if (!summary) {
    return (
      <>
        <Card>
          <EmptyState
            title="No months yet"
            description="Create your first month to start tracking balances, budgets, and investments."
            action={<Button onClick={() => setWizardOpen(true)}>Create first month</Button>}
          />
        </Card>
        <NewMonthWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onCreated={async () => {
            await app.refresh();
            await loadLatest();
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Latest month</p>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-3">
            {monthLabel(summary.month.year, summary.month.month)}
            <StatusPill status={summary.month.status} />
          </h1>
        </div>
        <Button onClick={() => setWizardOpen(true)}>+ New month</Button>
      </div>

      <OverviewCards summary={summary} prev={prev} />

      <div className="grid md:grid-cols-2 gap-6">
        <BalanceComparisonCard summary={summary} prev={prev} />
        <BudgetCard summary={summary} />
      </div>

      <NewMonthWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={async () => {
          await app.refresh();
          await loadLatest();
        }}
      />
    </div>
  );

  // --- Sub-components close over outer state via props ----------------------
}

function OverviewCards({
  summary,
  prev,
}: {
  summary: MonthSummaryDto;
  prev: MonthSummaryDto | null;
}) {
  const { currencies } = useApp();
  const base = currencies?.base ?? "CAD";

  const totalOpening = sumBy(summary.balances, (b) => b.openingAmount ?? 0);
  const totalClosing = sumBy(summary.balances, (b) => b.closingAmount ?? 0);
  const totalBudget = sumBy(summary.budgets, (b) => b.limitAmount ?? 0);
  const prevClosing = prev ? sumBy(prev.balances, (b) => b.closingAmount ?? 0) : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat
        label="Total opening"
        value={formatMoney(totalOpening, base, currencies?.currencies)}
        hint={prevClosing != null ? `prev closing ${formatMoney(prevClosing, base, currencies?.currencies)}` : undefined}
      />
      <Stat
        label="Total closing"
        value={formatMoney(totalClosing, base, currencies?.currencies)}
        hint={
          totalClosing - totalOpening !== 0
            ? `Δ ${signedMoney(totalClosing - totalOpening, base, currencies?.currencies)}`
            : "no movement yet"
        }
        deltaTone={totalClosing - totalOpening >= 0 ? "pos" : "neg"}
      />
      <Stat
        label="Total budget"
        value={formatMoney(totalBudget, base, currencies?.currencies)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  deltaTone,
}: {
  label: string;
  value: string;
  hint?: string;
  deltaTone?: "pos" | "neg";
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
      {hint && (
        <p
          className={`text-xs mt-1 ${
            deltaTone === "pos"
              ? "text-emerald-600"
              : deltaTone === "neg"
                ? "text-rose-600"
                : "text-slate-500"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function BalanceComparisonCard({
  summary,
  prev,
}: {
  summary: MonthSummaryDto;
  prev: MonthSummaryDto | null;
}) {
  const { currencies } = useApp();

  const prevClosingByAcct = new Map(
    (prev?.balances ?? []).map((b) => [b.accountId, b.closingAmount ?? null] as const),
  );

  const rows = summary.balances.map((b) => {
    const prevClose = prevClosingByAcct.get(b.accountId) ?? null;
    const delta =
      prevClose != null && b.closingAmount != null ? b.closingAmount - prevClose : null;
    return { ...b, prevClose, delta };
  });

  const chartData = rows.map((r) => {
    const decimals = currencies?.currencies.find((c) => c.code === r.currency)?.decimals ?? 2;
    const factor = Math.pow(10, decimals);
    return {
      name: r.accountName,
      previous: r.prevClose != null ? r.prevClose / factor : 0,
      current: r.closingAmount != null ? r.closingAmount / factor : (r.openingAmount ?? 0) / factor,
    };
  });

  return (
    <Card
      title="Balances — change from previous month"
      subtitle="Prev closing vs. current closing (falls back to opening if not yet closed)."
    >
      {rows.length === 0 ? (
        <EmptyState title="No balances yet" description="Create accounts and run the wizard." />
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="previous" fill="#cbd5e1" name="Previous closing" />
                <Bar dataKey="current" fill="#0f172a" name="Current" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="w-full text-sm mt-3">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5">Account</th>
                <th className="text-right">Prev close</th>
                <th className="text-right">Now</th>
                <th className="text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.accountId} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{r.accountName}</td>
                  <td className="py-1.5 text-right text-slate-600">
                    {formatMoney(r.prevClose, r.currency, currencies?.currencies)}
                  </td>
                  <td className="py-1.5 text-right text-slate-900">
                    {formatMoney(
                      r.closingAmount ?? r.openingAmount,
                      r.currency,
                      currencies?.currencies,
                    )}
                  </td>
                  <td
                    className={`py-1.5 text-right ${
                      r.delta == null
                        ? "text-slate-400"
                        : r.delta === 0
                          ? "text-slate-500"
                          : r.delta > 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                    }`}
                  >
                    {signedMoney(r.delta, r.currency, currencies?.currencies)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

function BudgetCard({ summary }: { summary: MonthSummaryDto }) {
  const { currencies } = useApp();
  const base = currencies?.base ?? "CAD";

  const pie = summary.budgets
    .filter((b) => (b.limitAmount ?? 0) > 0)
    .map((b) => {
      const decimals =
        currencies?.currencies.find((c) => c.code === (b.currency ?? base))?.decimals ?? 2;
      return {
        name: b.categoryLabel,
        value: (b.limitAmount ?? 0) / Math.pow(10, decimals),
      };
    });

  const colors = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#0891b2", "#0ea5e9", "#f59e0b"];

  return (
    <Card title="Budget allocation" subtitle={`Limits for this month (${base}).`}>
      {pie.length === 0 ? (
        <EmptyState title="No budgets set" description="Run the wizard step 3 to set limits." />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pie}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                innerRadius={44}
                paddingAngle={2}
              >
                {pie.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v.toFixed(2)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function sumBy<T>(xs: T[], sel: (x: T) => number): number {
  return xs.reduce((acc, x) => acc + (sel(x) || 0), 0);
}
