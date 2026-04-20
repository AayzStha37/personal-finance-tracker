import { useEffect, useState } from "react";
import { api, HttpError } from "../api/client";
import type { CurrencyDto, EmiPlanDto, EmiPlanRequest, MonthDto } from "../api/types";
import { Badge, Button, Card, Input, Label, Modal, Select } from "../components/ui";
import { formatMoney, monthLabel, toMinor } from "../lib/money";
import { useApp } from "../state/AppContext";

export default function EmiPage() {
  const { accounts, categories, currencies } = useApp();
  const [plans, setPlans] = useState<EmiPlanDto[]>([]);
  const [currentMonth, setCurrentMonth] = useState<MonthDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, m] = await Promise.all([
        api.listEmiPlans(),
        api.getCurrentMonth(),
      ]);
      setPlans(p);
      setCurrentMonth(m);
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function cancelPlan(id: number) {
    if (!confirm("Cancel this plan? Past installments are kept; future ones stop projecting.")) {
      return;
    }
    setBusy(true);
    try {
      await api.cancelEmiPlan(id);
      await load();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function earlyPayoff(planId: number) {
    if (!currentMonth) {
      setError("No active month found. Create or activate a month first.");
      return;
    }
    const plan = plans.find((p) => p.id === planId);
    const remaining = plan?.installments.filter((i) => i.status === "PROJECTED").length ?? 0;
    const remainingAmount = plan?.installments
      .filter((i) => i.status === "PROJECTED")
      .reduce((s, i) => s + i.amount, 0) ?? 0;
    if (
      !confirm(
        `Pay off ${remaining} remaining installment(s) (${formatMoney(remainingAmount, plan?.currency ?? "CAD", currencies?.currencies)}) as a lump sum in ${monthLabel(currentMonth.year, currentMonth.month)}?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.earlyPayoffEmiPlan(planId, currentMonth.id);
      await load();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-slate-900">EMI plans</h1>
        <Button onClick={() => setCreating(true)}>+ New plan</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <Card>
        {loading ? (
          <p className="text-sm text-slate-500 py-4 text-center">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No EMI plans yet. Add a plan to auto-project installments into upcoming months.
          </p>
        ) : (
          <div className="space-y-3">
            {plans.map((p) => {
              const paid = p.installments.filter((i) => i.status === "PAID").length;
              const projected = p.installments.filter((i) => i.status === "PROJECTED").length;
              const isOpen = expanded === p.id;
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 overflow-hidden"
                >
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
                    onClick={() => setExpanded(isOpen ? null : p.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{p.label}</span>
                        {p.active ? (
                          <Badge variant="success">active</Badge>
                        ) : (
                          <Badge variant="default">cancelled</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatMoney(p.installmentAmount, p.currency, currencies?.currencies)} ×{" "}
                        {p.totalInstallments} · paid {paid} · upcoming {projected}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400">
                        {isOpen ? "Hide" : "Show"} installments
                      </span>
                      {p.active && projected > 0 && (
                        <Button
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            void earlyPayoff(p.id);
                          }}
                          disabled={busy}
                        >
                          Early payoff
                        </Button>
                      )}
                      {p.active && (
                        <Button
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            void cancelPlan(p.id);
                          }}
                          disabled={busy}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                      <table className="w-full text-sm">
                        <thead className="text-xs uppercase text-slate-500">
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-1.5">#</th>
                            <th className="text-left">Due month</th>
                            <th className="text-right">Amount</th>
                            <th className="text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.installments.map((i) => (
                            <tr key={i.id} className="border-b border-slate-100">
                              <td className="py-1.5 text-slate-700">
                                {i.seqNo}/{i.totalInstallments}
                              </td>
                              <td className="py-1.5 text-slate-700">
                                {i.dueYear != null && i.dueMonth != null
                                  ? monthLabel(i.dueYear, i.dueMonth)
                                  : `Month #${i.dueMonthId}`}
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {creating && (
        <PlanEditor
          accounts={accounts}
          categories={categories}
          currencies={currencies?.currencies ?? []}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function PlanEditor({
  accounts,
  categories,
  currencies,
  onClose,
  onSaved,
}: {
  accounts: { id: number; name: string; currency: string }[];
  categories: { id: number; label: string }[];
  currencies: CurrencyDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const today = new Date();
  const [label, setLabel] = useState("");
  const [principal, setPrincipal] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("12");
  const [startYear, setStartYear] = useState(String(today.getFullYear()));
  const [startMonth, setStartMonth] = useState(String(today.getMonth() + 1));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [currency, setCurrency] = useState(
    accounts[0]?.currency ?? currencies[0]?.code ?? "CAD",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!label || !principal || !installmentAmount || !accountId || !categoryId) {
      setError("All fields are required.");
      return;
    }
    const principalMinor = toMinor(principal, currency, currencies);
    const installmentMinor = toMinor(installmentAmount, currency, currencies);
    if (principalMinor == null || installmentMinor == null) {
      setError("Amounts must be valid numbers.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: EmiPlanRequest = {
        label,
        principal: principalMinor,
        installmentAmount: installmentMinor,
        totalInstallments: Number(totalInstallments),
        startYear: Number(startYear),
        startMonth: Number(startMonth),
        accountId,
        categoryId,
        currency,
      };
      await api.createEmiPlan(body);
      await onSaved();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New EMI plan">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Airpods 6-month plan"
          />
        </div>
        <div>
          <Label>Principal</Label>
          <Input
            inputMode="decimal"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
          />
        </div>
        <div>
          <Label>Installment amount</Label>
          <Input
            inputMode="decimal"
            value={installmentAmount}
            onChange={(e) => setInstallmentAmount(e.target.value)}
          />
        </div>
        <div>
          <Label>Total installments</Label>
          <Input
            inputMode="numeric"
            value={totalInstallments}
            onChange={(e) => setTotalInstallments(e.target.value)}
          />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Start year</Label>
          <Input
            inputMode="numeric"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
          />
        </div>
        <div>
          <Label>Start month</Label>
          <Select value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthLabel(2000, m).split(" ")[0]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Account</Label>
          <Select
            value={accountId}
            onChange={(e) => setAccountId(Number(e.target.value))}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
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
          {busy ? "Creating…" : "Create plan"}
        </Button>
      </div>
    </Modal>
  );
}
