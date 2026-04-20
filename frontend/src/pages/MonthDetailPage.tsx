import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, HttpError } from "../api/client";
import type {
  EmiInstallmentDto,
  ExpenseEntryDto,
  ExpenseEntryRequest,
  IncomeEntryDto,
  IncomeEntryRequest,
  InvestmentDto,
  MonthSummaryDto,
  ShareLotDto,
} from "../api/types";
import { Badge, Button, Card, Input, Label, Modal, Select, StatusPill } from "../components/ui";
import { formatMoney, fromMinor, monthLabel, toMinor } from "../lib/money";
import { useApp } from "../state/AppContext";



export default function MonthDetailPage() {
  const { id } = useParams<{ id: string }>();
  const monthId = Number(id);
  const app = useApp();
  const { currencies, categories } = app;

  const [summary, setSummary] = useState<MonthSummaryDto | null>(null);
  const [installments, setInstallments] = useState<EmiInstallmentDto[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntryDto[]>([]);
  const [incomes, setIncomes] = useState<IncomeEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntryDto | "new" | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntryDto | "new" | null>(null);
  const [shareLots, setShareLots] = useState<ShareLotDto[]>([]);
  const [investments, setInvestments] = useState<InvestmentDto[]>([]);
  const [addingHolding, setAddingHolding] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, inst, xs, ins, lots, invs] = await Promise.all([
        api.getMonthSummary(monthId),
        api.listMonthEmiInstallments(monthId),
        api.listExpenses(monthId),
        api.listIncomes(monthId),
        api.listShareLots(monthId),
        api.listInvestments(),
      ]);
      setSummary(s);
      setInstallments(inst);
      setExpenses(xs);
      setIncomes(ins);
      setShareLots(lots);
      setInvestments(invs);
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [monthId]);

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

  async function lockMonth() {
    if (!summary) return;
    setBusy(true);
    try {
      await api.lockMonth(summary.month.id);
      setConfirmLock(false);
      await load();
      await app.refresh();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteExpense(expId: number) {
    if (!confirm("Delete this expense?")) return;
    setBusy(true);
    try {
      await api.deleteExpense(expId);
      await load();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteIncome(incId: number) {
    if (!confirm("Delete this income entry?")) return;
    setBusy(true);
    try {
      await api.deleteIncome(incId);
      await load();
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
  const base = currencies?.base ?? "CAD";
  const categoryLabel = (cid: number) =>
    categories.find((c) => c.id === cid)?.label ?? `Category #${cid}`;

  // Group expenses by category (sorted by category displayOrder)
  const expensesByCategory = (() => {
    const grouped = new Map<number, ExpenseEntryDto[]>();
    for (const x of expenses) {
      const list = grouped.get(x.categoryId) ?? [];
      list.push(x);
      grouped.set(x.categoryId, list);
    }
    return [...grouped.entries()]
      .map(([cid, items]) => ({
        categoryId: cid,
        label: categoryLabel(cid),
        displayOrder: categories.find((c) => c.id === cid)?.displayOrder ?? 999,
        items,
        total: items.reduce((s, x) => s + x.amount, 0),
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  })();

  const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
  const totalIncome = incomes.reduce((s, i) => i.amount + s, 0);
  const totalInvested = shareLots.reduce(
    (s, l) => s + Math.round(Number(l.shares) * l.pricePerShare),
    0,
  );
  const totalBudget = summary.budgets.reduce((s, b) => s + (b.limitAmount ?? 0), 0);
  const budgetDiff = totalBudget - totalExpenses;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-3">
            {monthLabel(summary.month.year, summary.month.month)}
            <StatusPill status={summary.month.status} />
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
            <Button onClick={activate} disabled={busy}>
              Activate
            </Button>
          )}
          {summary.month.status === "ACTIVE" && (
            <Button
              variant="danger"
              onClick={() => setConfirmLock(true)}
              disabled={busy}
            >
              Lock month
            </Button>
          )}
        </div>
      </header>

      {/* Lock confirmation modal */}
      <Modal
        open={confirmLock}
        onClose={() => setConfirmLock(false)}
        title="Lock this month?"
        size="sm"
      >
        <p className="text-sm text-slate-700">
          Locking finalises <strong>{monthLabel(summary.month.year, summary.month.month)}</strong>.
          All balances, budgets, investments, expenses and income for this month
          will become <strong>read-only</strong> and cannot be edited.
        </p>
        <p className="text-sm text-slate-500 mt-2">This action cannot be undone.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setConfirmLock(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={lockMonth} disabled={busy}>
            {busy ? "Locking…" : "Yes, lock month"}
          </Button>
        </div>
      </Modal>

      {/* Balances — opening only */}
      <Card title="Balances">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left py-2">Account</th>
              <th className="text-right">Currency</th>
              <th className="text-right">Opening balance</th>
            </tr>
          </thead>
          <tbody>
            {summary.balances.map((b) => (
              <tr key={b.accountId} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-800">{b.accountName}</td>
                <td className="py-2 text-right text-slate-500">{b.currency}</td>
                <td className="py-2 text-right text-slate-900">
                  {formatMoney(b.openingAmount, b.currency, currencies?.currencies)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Budgets — with under/par/over status */}
        <Card
          title="Budgets"
          subtitle={
            totalBudget > 0
              ? undefined
              : `Limits for ${monthLabel(summary.month.year, summary.month.month)}`
          }
        >
          {summary.budgets.length === 0 ? (
            <p className="text-sm text-slate-500">No budgets set.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-lg font-semibold text-slate-900">
                  {formatMoney(totalBudget, base, currencies?.currencies)}
                </p>
                {totalBudget > 0 && (
                  <span
                    className={`text-sm font-medium ${budgetDiff > 0
                        ? "text-emerald-600"
                        : budgetDiff === 0
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                  >
                    {budgetDiff > 0
                      ? `${formatMoney(budgetDiff, base, currencies?.currencies)} under budget`
                      : budgetDiff === 0
                        ? "On par"
                        : `${formatMoney(Math.abs(budgetDiff), base, currencies?.currencies)} over budget`}
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1.5">Category</th>
                    <th className="text-right">Limit</th>
                    <th className="text-right">Spent</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.budgets.map((b) => {
                    const spent = expenses
                      .filter((e) => e.categoryId === b.categoryId)
                      .reduce((s, e) => s + e.amount, 0);
                    const diff = (b.limitAmount ?? 0) - spent;
                    return (
                      <tr key={b.categoryId} className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-800">{b.categoryLabel}</td>
                        <td className="py-1.5 text-right text-slate-600">
                          {formatMoney(b.limitAmount, b.currency ?? base, currencies?.currencies)}
                        </td>
                        <td className="py-1.5 text-right text-slate-600">
                          {formatMoney(spent, b.currency ?? base, currencies?.currencies)}
                        </td>
                        <td
                          className={`py-1.5 text-right text-xs font-medium ${diff > 0
                              ? "text-emerald-600"
                              : diff === 0
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                        >
                          {(b.limitAmount ?? 0) === 0
                            ? "—"
                            : diff > 0
                              ? `${formatMoney(diff, b.currency ?? base, currencies?.currencies)} under`
                              : diff === 0
                                ? "On par"
                                : `${formatMoney(Math.abs(diff), b.currency ?? base, currencies?.currencies)} over`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </Card>

        {/* Investments — share lots this month + total */}
        <Card
          title="Investments"
          subtitle="Share lots purchased this month"
          actions={
            !locked && (
              <Button variant="secondary" onClick={() => setAddingHolding(true)}>
                + Add holding
              </Button>
            )
          }
        >
          {shareLots.length === 0 ? (
            <p className="text-sm text-slate-500">No holdings added this month.</p>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-lg font-semibold text-slate-900">
                  Total: {formatMoney(totalInvested, base, currencies?.currencies)}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1.5">Holding</th>
                    <th className="text-right">Shares</th>
                    <th className="text-right">Buy price</th>
                    <th className="text-right">Total cost</th>
                    <th className="text-left pl-2">Date</th>
                    {!locked && <th className="text-right">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {shareLots.map((lot) => {
                    const inv = investments.find((i) => i.id === lot.investmentId);
                    const shares = Number(lot.shares);
                    const totalCost = Math.round(shares * lot.pricePerShare);
                    return (
                      <tr key={lot.id} className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-800">
                          {inv?.name ?? `#${lot.investmentId}`}
                          {inv?.ticker && (
                            <span className="ml-1 text-xs text-slate-500">{inv.ticker}</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right text-slate-600">{String(lot.shares)}</td>
                        <td className="py-1.5 text-right text-slate-600">
                          {formatMoney(lot.pricePerShare, inv?.currency ?? "CAD", currencies?.currencies)}
                        </td>
                        <td className="py-1.5 text-right font-medium">
                          {formatMoney(totalCost, inv?.currency ?? "CAD", currencies?.currencies)}
                        </td>
                        <td className="py-1.5 pl-2 text-slate-500 text-xs">{lot.purchasedDate}</td>
                        {!locked && (
                          <td className="py-1.5 text-right">
                            <button
                              className="text-rose-600 hover:text-rose-800 text-sm font-medium"
                              onClick={async () => {
                                if (!confirm("Delete this share lot?")) return;
                                setBusy(true);
                                try {
                                  await api.deleteShareLot(lot.id);
                                  await load();
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              disabled={busy}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </Card>
      </div>

      {/* Expenses — grouped by category with totals */}
      <Card
        title="Expenses"
        subtitle={
          totalExpenses > 0
            ? `Total: ${formatMoney(totalExpenses, base, currencies?.currencies)}`
            : "Expenses logged this month"
        }
        actions={
          !locked && (
            <Button variant="secondary" onClick={() => setEditingExpense("new")}>
              + Add expense
            </Button>
          )
        }
      >
        {expenses.length === 0 ? (
          <p className="text-sm text-slate-500">No expenses logged this month.</p>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-2">
            {expensesByCategory.map((group) => (
              <div key={group.categoryId} className="min-w-[280px] flex-shrink-0">
                <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 mb-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-indigo-700">{group.label}</span>
                  <span className="text-xs font-medium text-indigo-600">
                    {formatMoney(group.total, base, currencies?.currencies)}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.items.map((x) => (
                    <div
                      key={x.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {x.description}
                            {x.emiInstallmentId != null && (
                              <Badge variant="info">
                                <span className="ml-1">EMI</span>
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{x.txDate}</p>
                        </div>
                        <span className="font-semibold text-slate-900 whitespace-nowrap">
                          {formatMoney(x.amount, x.currency, currencies?.currencies)}
                        </span>
                      </div>
                      {!locked && x.emiInstallmentId == null && (
                        <div className="flex gap-3 mt-2 pt-2 border-t border-slate-200">
                          <button
                            className="text-xs font-medium text-slate-600 hover:text-slate-900"
                            onClick={() => setEditingExpense(x)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-xs font-medium text-rose-600 hover:text-rose-800"
                            onClick={() => deleteExpense(x.id)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Income — simplified with single amount */}
      <Card
        title="Income"
        subtitle={
          totalIncome > 0
            ? `Total: ${formatMoney(totalIncome, base, currencies?.currencies)}`
            : "Money received this month"
        }
        actions={
          !locked && (
            <Button variant="secondary" onClick={() => setEditingIncome("new")}>
              + Add income
            </Button>
          )
        }
      >
        {incomes.length === 0 ? (
          <p className="text-sm text-slate-500">No income logged this month.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5">Date</th>
                <th className="text-left">Source</th>
                <th className="text-right">Amount</th>
                {!locked && <th className="text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {incomes.map((i) => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-700">{i.receivedDate}</td>
                  <td className="py-1.5 text-slate-800">{i.source}</td>
                  <td className="py-1.5 text-right font-medium text-emerald-700">
                    {formatMoney(i.amount, i.currency, currencies?.currencies)}
                  </td>
                  {!locked && (
                    <td className="py-1.5 text-right">
                      <button
                        className="text-slate-700 hover:text-slate-900 text-sm font-medium mr-3"
                        onClick={() => setEditingIncome(i)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-rose-600 hover:text-rose-800 text-sm font-medium"
                        onClick={() => deleteIncome(i.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* EMIs due this month */}
      {installments.length > 0 && (
        <Card title="EMIs due this month" subtitle="Installments scheduled for this month">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-1.5">Plan</th>
                <th className="text-left">Seq</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((i) => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{i.planLabel ?? `Plan #${i.planId}`}</td>
                  <td className="py-1.5 text-slate-600">
                    {i.seqNo}/{i.totalInstallments}
                  </td>
                  <td className="py-1.5 text-right">
                    {formatMoney(i.amount, i.currency, currencies?.currencies)}
                  </td>
                  <td className="py-1.5 text-center">
                    <Badge
                      variant={
                        i.status === "PAID"
                          ? "success"
                          : i.status === "SKIPPED"
                            ? "warn"
                            : "info"
                      }
                    >
                      {i.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editingExpense && (
        <ExpenseEditor
          initial={editingExpense === "new" ? null : editingExpense}
          monthId={monthId}
          onClose={() => setEditingExpense(null)}
          onSaved={async () => {
            setEditingExpense(null);
            await load();
          }}
        />
      )}

      {editingIncome && (
        <IncomeEditor
          initial={editingIncome === "new" ? null : editingIncome}
          monthId={monthId}
          onClose={() => setEditingIncome(null)}
          onSaved={async () => {
            setEditingIncome(null);
            await load();
          }}
        />
      )}

      {addingHolding && (
        <AddHoldingModal
          monthId={monthId}
          investments={investments}
          onClose={() => setAddingHolding(false)}
          onSaved={async () => {
            setAddingHolding(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ExpenseEditor({
  initial,
  monthId,
  onClose,
  onSaved,
}: {
  initial: ExpenseEntryDto | null;
  monthId: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { categories, currencies } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const [categoryId, setCategoryId] = useState<number>(
    initial?.categoryId ?? categories[0]?.id ?? 0,
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [currency, setCurrency] = useState(
    initial?.currency ?? currencies?.currencies[0]?.code ?? "CAD",
  );
  const [amount, setAmount] = useState(
    initial ? fromMinor(initial.amount, initial.currency, currencies?.currencies) : "",
  );
  const [txDate, setTxDate] = useState(initial?.txDate ?? today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!description.trim() || !amount) {
      setError("Description and amount are required.");
      return;
    }
    const amountMinor = toMinor(amount, currency, currencies?.currencies);
    if (amountMinor == null) {
      setError("Amount must be a valid number.");
      return;
    }
    const body: ExpenseEntryRequest = {
      categoryId,
      description: description.trim(),
      amount: amountMinor,
      currency,
      txDate,
    };
    setBusy(true);
    setError(null);
    try {
      if (initial) {
        await api.updateExpense(initial.id, body);
      } else {
        await api.createExpense(monthId, body);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={initial ? "Edit expense" : "New expense"} size="md">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>Amount</Label>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {(currencies?.currencies ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Transaction date</Label>
          <Input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving…" : initial ? "Update" : "Create"}
        </Button>
      </div>
    </Modal>
  );
}

function IncomeEditor({
  initial,
  monthId,
  onClose,
  onSaved,
}: {
  initial: IncomeEntryDto | null;
  monthId: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { currencies } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const [source, setSource] = useState(initial?.source ?? "");
  const [currency, setCurrency] = useState(
    initial?.currency ?? currencies?.currencies[0]?.code ?? "CAD",
  );
  const [amount, setAmount] = useState(
    initial ? fromMinor(initial.amount, initial.currency, currencies?.currencies) : "",
  );
  const [receivedDate, setReceivedDate] = useState(initial?.receivedDate ?? today);
  const [weekOfMonth, setWeekOfMonth] = useState<string>(
    initial?.weekOfMonth != null ? String(initial.weekOfMonth) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!source.trim() || !amount) {
      setError("Source and amount are required.");
      return;
    }
    const amountMinor = toMinor(amount, currency, currencies?.currencies);
    if (amountMinor == null) {
      setError("Amount must be a valid number.");
      return;
    }
    const body: IncomeEntryRequest = {
      source: source.trim(),
      amount: amountMinor,
      currency,
      receivedDate,
      weekOfMonth: weekOfMonth ? Number(weekOfMonth) : null,
    };
    setBusy(true);
    setError(null);
    try {
      if (initial) {
        await api.updateIncome(initial.id, body);
      } else {
        await api.createIncome(monthId, body);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={initial ? "Edit income" : "New income"} size="md">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Source</Label>
          <Input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. Salary, Bonus, etc."
          />
        </div>
        <div>
          <Label>Amount</Label>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {(currencies?.currencies ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Received date</Label>
          <Input
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Week of month (optional)</Label>
          <Input
            inputMode="numeric"
            value={weekOfMonth}
            onChange={(e) => setWeekOfMonth(e.target.value)}
            placeholder="1–6"
          />
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving…" : initial ? "Update" : "Create"}
        </Button>
      </div>
    </Modal>
  );
}

const INVESTMENT_TYPES = ["OTHER", "ETF", "STOCK", "MF", "CRYPTO", "BOND", "PPF", "RRSP", "FHSA"];

function AddHoldingModal({
  monthId,
  investments,
  onClose,
  onSaved,
}: {
  monthId: number;
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

      await api.createShareLot(monthId, {
        investmentId: targetId,
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
