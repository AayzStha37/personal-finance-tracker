import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import type {
  ExpenseEntryDto,
  IncomeEntryDto,
  MonthSummaryDto,
  ShareLotDto,
} from "../api/types";
import { Card, EmptyState, StatusPill } from "../components/ui";
import { formatMoney, monthLabel, signedMoney } from "../lib/money";
import { useApp } from "../state/AppContext";

interface DashboardData {
  summary: MonthSummaryDto;
  prev: MonthSummaryDto | null;
  expenses: ExpenseEntryDto[];
  incomes: IncomeEntryDto[];
  shareLots: ShareLotDto[];
  prevShareLots: ShareLotDto[];
}

export default function DashboardPage() {
  const app = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLatest() {
    setLoading(true);
    setError(null);
    try {
      const months = await api.listMonths();
      // Find latest ACTIVE month
      const active = months.find((m) => m.status === "ACTIVE");
      if (!active) {
        setData(null);
        return;
      }
      const summary = await api.getMonthSummary(active.id);

      let prev: MonthSummaryDto | null = null;
      let prevShareLots: ShareLotDto[] = [];
      if (summary.previousMonthId != null) {
        prev = await api.getMonthSummary(summary.previousMonthId);
        prevShareLots = await api.listShareLots(summary.previousMonthId);
      }

      const [expenses, incomes, shareLots] = await Promise.all([
        api.listExpenses(active.id),
        api.listIncomes(active.id),
        api.listShareLots(active.id),
      ]);

      setData({ summary, prev, expenses, incomes, shareLots, prevShareLots });
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

  if (!data) {
    return (
      <Card>
        <EmptyState
          title="No active month"
          description="Create and activate a month to see your dashboard."
        />
      </Card>
    );
  }

  const { summary, prev, expenses, incomes, shareLots, prevShareLots } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Active month</p>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-3">
            {monthLabel(summary.month.year, summary.month.month)}
            <StatusPill status={summary.month.status} />
          </h1>
        </div>
        <button
          onClick={() => navigate(`/months/${summary.month.id}`)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors"
        >
          Edit Details →
        </button>
      </div>

      <OverviewCards
        summary={summary}
        prev={prev}
        expenses={expenses}
        incomes={incomes}
        shareLots={shareLots}
        prevShareLots={prevShareLots}
      />

      <div className="grid md:grid-cols-2 gap-6">
        <SavingsChart summary={summary} prev={prev} />
        <BudgetCard summary={summary} expenses={expenses} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <IncomeCard incomes={incomes} />
        <ExpenseCard expenses={expenses} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview stat cards
// ---------------------------------------------------------------------------

function OverviewCards({
  summary,
  prev,
  expenses,
  incomes,
  shareLots,
  prevShareLots,
}: {
  summary: MonthSummaryDto;
  prev: MonthSummaryDto | null;
  expenses: ExpenseEntryDto[];
  incomes: IncomeEntryDto[];
  shareLots: ShareLotDto[];
  prevShareLots: ShareLotDto[];
}) {
  const { currencies } = useApp();
  const base = currencies?.base ?? "CAD";

  const totalOpening = sumBy(summary.balances, (b) => b.openingAmount ?? 0);
  const prevOpening = prev ? sumBy(prev.balances, (b) => b.openingAmount ?? 0) : null;
  const openingDelta = prevOpening != null ? totalOpening - prevOpening : null;

  const totalBudget = sumBy(summary.budgets, (b) => b.limitAmount ?? 0);
  const totalSpent = sumBy(expenses, (e) => e.amount);
  const budgetDiff = totalBudget - totalSpent;

  const totalInvested = sumBy(shareLots, (l) => Math.round(Number(l.shares) * l.buyPricePerShare));
  const prevInvested = sumBy(prevShareLots, (l) => Math.round(Number(l.shares) * l.buyPricePerShare));
  const investDelta = totalInvested - prevInvested;

  const totalIncome = sumBy(incomes, (i) => i.netAmount);
  const totalExpense = sumBy(expenses, (e) => e.amount);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* Total Opening */}
      <Stat
        label="Total Opening"
        value={formatMoney(totalOpening, base, currencies?.currencies)}
        delta={openingDelta}
        currency={base}
      />

      {/* Budget */}
      <Stat
        label="Budget"
        value={formatMoney(totalBudget, base, currencies?.currencies)}
        budgetStatus={
          totalBudget === 0
            ? null
            : budgetDiff > 0
              ? { tone: "pos" as const, label: `${formatMoney(budgetDiff, base, currencies?.currencies)} under` }
              : budgetDiff === 0
                ? { tone: "neutral" as const, label: "On par" }
                : { tone: "neg" as const, label: `${formatMoney(Math.abs(budgetDiff), base, currencies?.currencies)} over` }
        }
      />

      {/* Investments */}
      <Stat
        label="Investments"
        value={formatMoney(totalInvested, base, currencies?.currencies)}
        delta={prevOpening != null ? investDelta : null}
        currency={base}
      />

      {/* Income */}
      <Stat
        label="Income"
        value={formatMoney(totalIncome, base, currencies?.currencies)}
      />

      {/* Expenses */}
      <Stat
        label="Expenses"
        value={formatMoney(totalExpense, base, currencies?.currencies)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  currency,
  budgetStatus,
}: {
  label: string;
  value: string;
  delta?: number | null;
  currency?: string;
  budgetStatus?: { tone: "pos" | "neutral" | "neg"; label: string } | null;
}) {
  const { currencies } = useApp();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>

      {delta != null && (
        <p
          className={`text-xs mt-1 font-medium flex items-center gap-1 ${
            delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-slate-500"
          }`}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : ""}
          {signedMoney(delta, currency ?? null, currencies?.currencies)}
        </p>
      )}

      {budgetStatus && (
        <p
          className={`text-xs mt-1 font-medium ${
            budgetStatus.tone === "pos"
              ? "text-emerald-600"
              : budgetStatus.tone === "neg"
                ? "text-rose-600"
                : "text-amber-600"
          }`}
        >
          {budgetStatus.label}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Savings chart — BANK (active) + CASH only, comparing opening balances
// ---------------------------------------------------------------------------

function SavingsChart({
  summary,
  prev,
}: {
  summary: MonthSummaryDto;
  prev: MonthSummaryDto | null;
}) {
  const { accounts, currencies } = useApp();

  // Filter to active BANK + CASH accounts
  const eligibleIds = new Set(
    accounts
      .filter((a) => a.active && (a.kind === "BANK" || a.kind === "CASH"))
      .map((a) => a.id),
  );

  const rows = summary.balances
    .filter((b) => eligibleIds.has(b.accountId))
    .map((b) => {
      const prevBal = prev?.balances.find((p) => p.accountId === b.accountId);
      const prevOpen = prevBal?.openingAmount ?? null;
      const curOpen = b.openingAmount ?? 0;
      const delta = prevOpen != null ? curOpen - prevOpen : null;
      return { ...b, prevOpen, curOpen, delta };
    });

  const chartData = rows.map((r) => {
    const decimals = currencies?.currencies.find((c) => c.code === r.currency)?.decimals ?? 2;
    const factor = Math.pow(10, decimals);
    return {
      name: r.accountName,
      previous: r.prevOpen != null ? r.prevOpen / factor : 0,
      current: r.curOpen / factor,
    };
  });

  return (
    <Card
      title="Savings — opening balance trend"
      subtitle="Active bank & cash accounts: previous vs. current opening."
    >
      {rows.length === 0 ? (
        <EmptyState title="No savings accounts" description="Add active bank or cash accounts." />
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
                <Bar dataKey="previous" fill="#cbd5e1" name="Prev opening" />
                <Bar dataKey="current" fill="#0f172a" name="Current opening" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="w-full text-sm mt-3">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5">Account</th>
                <th className="text-right">Prev opening</th>
                <th className="text-right">Current opening</th>
                <th className="text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.accountId} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{r.accountName}</td>
                  <td className="py-1.5 text-right text-slate-600">
                    {formatMoney(r.prevOpen, r.currency, currencies?.currencies)}
                  </td>
                  <td className="py-1.5 text-right text-slate-900">
                    {formatMoney(r.curOpen, r.currency, currencies?.currencies)}
                  </td>
                  <td
                    className={`py-1.5 text-right font-medium ${
                      r.delta == null
                        ? "text-slate-400"
                        : r.delta > 0
                          ? "text-emerald-600"
                          : r.delta < 0
                            ? "text-rose-600"
                            : "text-slate-500"
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

// ---------------------------------------------------------------------------
// Budget card — pie chart + under/par/over status per category
// ---------------------------------------------------------------------------

function BudgetCard({
  summary,
  expenses,
}: {
  summary: MonthSummaryDto;
  expenses: ExpenseEntryDto[];
}) {
  const { currencies } = useApp();
  const base = currencies?.base ?? "CAD";

  // Sum expenses by category
  const spentByCategory = new Map<number, number>();
  for (const e of expenses) {
    spentByCategory.set(e.categoryId, (spentByCategory.get(e.categoryId) ?? 0) + e.amount);
  }

  const budgetRows = summary.budgets
    .filter((b) => (b.limitAmount ?? 0) > 0)
    .map((b) => {
      const limit = b.limitAmount ?? 0;
      const spent = spentByCategory.get(b.categoryId) ?? 0;
      const diff = limit - spent;
      return { ...b, spent, diff };
    });

  const pie = budgetRows.map((b) => {
    const decimals =
      currencies?.currencies.find((c) => c.code === (b.currency ?? base))?.decimals ?? 2;
    return {
      name: b.categoryLabel,
      value: (b.limitAmount ?? 0) / Math.pow(10, decimals),
    };
  });

  const colors = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#0891b2", "#0ea5e9", "#f59e0b"];

  return (
    <Card title="Budget" subtitle={`Limits vs. spending (${base}).`}>
      {budgetRows.length === 0 ? (
        <EmptyState title="No budgets set" description="Set budget limits for this month." />
      ) : (
        <>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={72}
                  innerRadius={40}
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
          <table className="w-full text-sm mt-2">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5">Category</th>
                <th className="text-right">Limit</th>
                <th className="text-right">Spent</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {budgetRows.map((b) => (
                <tr key={b.categoryId} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{b.categoryLabel}</td>
                  <td className="py-1.5 text-right text-slate-600">
                    {formatMoney(b.limitAmount, b.currency ?? base, currencies?.currencies)}
                  </td>
                  <td className="py-1.5 text-right text-slate-600">
                    {formatMoney(b.spent, b.currency ?? base, currencies?.currencies)}
                  </td>
                  <td
                    className={`py-1.5 text-right text-xs font-medium ${
                      b.diff > 0
                        ? "text-emerald-600"
                        : b.diff === 0
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                  >
                    {b.diff > 0
                      ? `${formatMoney(b.diff, b.currency ?? base, currencies?.currencies)} under`
                      : b.diff === 0
                        ? "On par"
                        : `${formatMoney(Math.abs(b.diff), b.currency ?? base, currencies?.currencies)} over`}
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

// ---------------------------------------------------------------------------
// Income snapshot
// ---------------------------------------------------------------------------

function IncomeCard({ incomes }: { incomes: IncomeEntryDto[] }) {
  const { currencies } = useApp();
  const base = currencies?.base ?? "CAD";
  const total = sumBy(incomes, (i) => i.netAmount);

  return (
    <Card title="Income" subtitle="Net income received this month.">
      {incomes.length === 0 ? (
        <EmptyState title="No income" description="Add income entries from the month page." />
      ) : (
        <>
          <p className="text-2xl font-semibold text-slate-900 mb-3">
            {formatMoney(total, base, currencies?.currencies)}
          </p>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5">Source</th>
                <th className="text-right">Date</th>
                <th className="text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {incomes.map((i) => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{i.source}</td>
                  <td className="py-1.5 text-right text-slate-500 text-xs">{i.receivedDate}</td>
                  <td className="py-1.5 text-right text-emerald-700 font-medium">
                    {formatMoney(i.netAmount, i.currency, currencies?.currencies)}
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

// ---------------------------------------------------------------------------
// Expense snapshot
// ---------------------------------------------------------------------------

function ExpenseCard({ expenses }: { expenses: ExpenseEntryDto[] }) {
  const { currencies, categories } = useApp();
  const base = currencies?.base ?? "CAD";
  const total = sumBy(expenses, (e) => e.amount);

  // Group by category
  const byCat = new Map<number, { label: string; total: number; count: number }>();
  for (const e of expenses) {
    const entry = byCat.get(e.categoryId) ?? {
      label: categories.find((c) => c.id === e.categoryId)?.label ?? "Other",
      total: 0,
      count: 0,
    };
    entry.total += e.amount;
    entry.count += 1;
    byCat.set(e.categoryId, entry);
  }

  return (
    <Card title="Expenses" subtitle="Total spending this month.">
      {expenses.length === 0 ? (
        <EmptyState title="No expenses" description="Add expense entries from the month page." />
      ) : (
        <>
          <p className="text-2xl font-semibold text-slate-900 mb-3">
            {formatMoney(total, base, currencies?.currencies)}
          </p>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5">Category</th>
                <th className="text-right">Items</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...byCat.entries()].map(([catId, { label, total: catTotal, count }]) => (
                <tr key={catId} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{label}</td>
                  <td className="py-1.5 text-right text-slate-500">{count}</td>
                  <td className="py-1.5 text-right text-rose-700 font-medium">
                    {formatMoney(catTotal, base, currencies?.currencies)}
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

// ---------------------------------------------------------------------------

function sumBy<T>(xs: T[], sel: (x: T) => number): number {
  return xs.reduce((acc, x) => acc + (sel(x) || 0), 0);
}
