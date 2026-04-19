import { useEffect, useMemo, useState } from "react";
import { api, HttpError } from "../../api/client";
import type {
  BalanceUpdate,
  BudgetUpdate,
  MonthDto,
  MonthSummaryDto,
} from "../../api/types";
import { Button, Input, Label, Modal, Select } from "../../components/ui";
import { useApp } from "../../state/AppContext";
import { fromMinor, monthLabel, nextMonth, toMinor } from "../../lib/money";

type Step = 1 | 2 | 3 | 4;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (summary: MonthSummaryDto) => void;
}

export default function NewMonthWizard({ open, onClose, onCreated }: Props) {
  const { accounts, categories, currencies, months } = useApp();
  const baseCurrency = currencies?.base ?? "CAD";

  const suggested = useMemo(() => suggestNextMonth(months), [months]);

  const [step, setStep] = useState<Step>(1);
  const [year, setYear] = useState(suggested.year);
  const [month, setMonth] = useState(suggested.month);
  const [rolloverBalances, setRolloverBalances] = useState(true);
  const [rolloverBudgets, setRolloverBudgets] = useState(true);
  const [summary, setSummary] = useState<MonthSummaryDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [balanceDraft, setBalanceDraft] = useState<Record<number, string>>({});
  const [budgetDraft, setBudgetDraft] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSummary(null);
      setError(null);
      setYear(suggested.year);
      setMonth(suggested.month);
      setRolloverBalances(true);
      setRolloverBudgets(true);
      setBalanceDraft({});
      setBudgetDraft({});
    }
  }, [open, suggested.year, suggested.month]);

  useEffect(() => {
    if (!summary) return;
    const b: Record<number, string> = {};
    summary.balances.forEach((x) => {
      b[x.accountId] = fromMinor(x.openingAmount, x.currency, currencies?.currencies);
    });
    setBalanceDraft(b);

    const bg: Record<number, string> = {};
    summary.budgets.forEach((x) => {
      bg[x.categoryId] = fromMinor(x.limitAmount, x.currency ?? baseCurrency, currencies?.currencies);
    });
    setBudgetDraft(bg);
  }, [summary, baseCurrency, currencies]);

  async function createDraft() {
    setBusy(true);
    setError(null);
    try {
      const s = await api.createMonth({
        year,
        month,
        rolloverBalances,
        rolloverBudgets,
      });
      setSummary(s);
      setStep(2);
    } catch (e) {
      setError(readError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveBalances() {
    if (!summary) return;
    setBusy(true);
    setError(null);
    try {
      const updates: BalanceUpdate[] = Object.entries(balanceDraft).map(([idStr, v]) => {
        const accountId = Number(idStr);
        const account = summary.balances.find((b) => b.accountId === accountId);
        return {
          accountId,
          openingAmount: toMinor(v, account?.currency, currencies?.currencies),
          closingAmount: account?.closingAmount ?? null,
        };
      });
      await api.updateBalances(summary.month.id, updates);
      await api.runIntegrity(summary.month.id);
      const refreshed = await api.getMonthSummary(summary.month.id);
      setSummary(refreshed);
      setStep(3);
    } catch (e) {
      setError(readError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveBudgets() {
    if (!summary) return;
    setBusy(true);
    setError(null);
    try {
      const updates: BudgetUpdate[] = [];
      for (const [idStr, v] of Object.entries(budgetDraft)) {
        const categoryId = Number(idStr);
        const minor = toMinor(v, baseCurrency, currencies?.currencies);
        if (minor == null || minor < 0) continue;
        updates.push({ categoryId, limitAmount: minor, currency: baseCurrency });
      }
      await api.updateBudgets(summary.month.id, updates);
      const refreshed = await api.getMonthSummary(summary.month.id);
      setSummary(refreshed);
      setStep(4);
    } catch (e) {
      setError(readError(e));
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!summary) return;
    setBusy(true);
    setError(null);
    try {
      await api.activateMonth(summary.month.id);
      const refreshed = await api.getMonthSummary(summary.month.id);
      onCreated(refreshed);
      onClose();
    } catch (e) {
      setError(readError(e));
    } finally {
      setBusy(false);
    }
  }

  const title = summary
    ? `New Month — ${monthLabel(summary.month.year, summary.month.month)} (Step ${step}/4)`
    : `New Month — Step ${step}/4`;

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <Stepper step={step} />
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {step === 1 && (
          <StepPeriod
            year={year}
            month={month}
            setYear={setYear}
            setMonth={setMonth}
            rolloverBalances={rolloverBalances}
            setRolloverBalances={setRolloverBalances}
            rolloverBudgets={rolloverBudgets}
            setRolloverBudgets={setRolloverBudgets}
          />
        )}

        {step === 2 && summary && (
          <StepBalances
            summary={summary}
            draft={balanceDraft}
            setDraft={setBalanceDraft}
            currencies={currencies?.currencies ?? []}
          />
        )}

        {step === 3 && summary && (
          <StepBudgets
            summary={summary}
            draft={budgetDraft}
            setDraft={setBudgetDraft}
            categories={categories}
            baseCurrency={baseCurrency}
          />
        )}

        {step === 4 && summary && (
          <p className="text-sm text-slate-600">
            Review your month setup. Click <strong>Activate month</strong> to start tracking, or
            leave as DRAFT to continue editing later.
          </p>
        )}
      </div>

      <footer className="mt-6 flex justify-between items-center pt-4 border-t border-slate-200">
        <Button
          variant="ghost"
          onClick={() => {
            if (step === 1) {
              onClose();
            } else if (step > 1 && summary) {
              setStep((step - 1) as Step);
            }
          }}
          disabled={busy}
        >
          {step === 1 ? "Cancel" : "Back"}
        </Button>

        <div className="flex gap-2">
          {step === 1 && (
            <Button onClick={createDraft} disabled={busy || accounts.length === 0}>
              {busy ? "Creating…" : "Create draft"}
            </Button>
          )}
          {step === 2 && (
            <Button onClick={saveBalances} disabled={busy}>
              {busy ? "Saving…" : "Save balances"}
            </Button>
          )}
          {step === 3 && (
            <Button onClick={saveBudgets} disabled={busy}>
              {busy ? "Saving…" : "Save budgets"}
            </Button>
          )}
          {step === 4 && summary && (
            <>
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Leave as DRAFT
              </Button>
              <Button onClick={activate} disabled={busy}>
                {busy ? "Activating…" : "Activate month"}
              </Button>
            </>
          )}
        </div>
      </footer>
    </Modal>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Period", "Balances", "Budgets", "Review"];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        return (
          <li key={label} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full grid place-items-center font-medium ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-slate-900 text-white"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? "✓" : n}
            </div>
            <span className={active ? "font-medium text-slate-900" : "text-slate-500"}>
              {label}
            </span>
            {i < labels.length - 1 && <span className="w-4 h-px bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}

function StepPeriod(props: {
  year: number;
  month: number;
  setYear: (v: number) => void;
  setMonth: (v: number) => void;
  rolloverBalances: boolean;
  setRolloverBalances: (v: boolean) => void;
  rolloverBudgets: boolean;
  setRolloverBudgets: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Choose the year and month. The wizard will create a <strong>DRAFT</strong> month and
        roll over selected data from the most recent previous month.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Year</Label>
          <Input
            type="number"
            value={props.year}
            onChange={(e) => props.setYear(Number(e.target.value))}
            min={1970}
            max={9999}
          />
        </div>
        <div>
          <Label>Month</Label>
          <Select value={props.month} onChange={(e) => props.setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")} — {new Date(2000, m - 1, 1).toLocaleString("en", { month: "long" })}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Roll over from previous month
        </p>
        {[
          { label: "Opening balances (prev. closing → curr. opening)", key: "balances" as const },
          { label: "Budget limits", key: "budgets" as const },
        ].map((opt) => {
          const value = opt.key === "balances" ? props.rolloverBalances : props.rolloverBudgets;
          const setter =
            opt.key === "balances" ? props.setRolloverBalances : props.setRolloverBudgets;
          return (
            <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setter(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-slate-700">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function StepBalances({
  summary,
  draft,
  setDraft,
  currencies,
}: {
  summary: MonthSummaryDto;
  draft: Record<number, string>;
  setDraft: (v: Record<number, string>) => void;
  currencies: { code: string; decimals: number; symbol: string }[];
}) {
  if (summary.balances.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No accounts yet. Add accounts from the Accounts tab and create the month again.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Set each account&apos;s opening balance for this month.
      </p>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="text-left py-2">Account</th>
            <th className="text-right py-2">Prev closing</th>
            <th className="text-right py-2">Opening</th>
            <th className="text-left py-2 pl-2">Currency</th>
          </tr>
        </thead>
        <tbody>
          {summary.balances.map((b) => {
            const cmp = summary.integrity.comparisons.find((c) => c.accountId === b.accountId);
            const decimals = currencies.find((c) => c.code === b.currency)?.decimals ?? 2;
            return (
              <tr key={b.accountId} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-800">{b.accountName}</td>
                <td className="py-2 text-right text-slate-600">
                  {cmp?.previousClosing != null
                    ? (cmp.previousClosing / Math.pow(10, decimals)).toFixed(decimals)
                    : "—"}
                </td>
                <td className="py-2 text-right w-36">
                  <Input
                    className="text-right"
                    inputMode="decimal"
                    value={draft[b.accountId] ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [b.accountId]: e.target.value })
                    }
                  />
                </td>
                <td className="py-2 pl-2 text-slate-600">{b.currency}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StepBudgets({
  summary,
  draft,
  setDraft,
  categories,
  baseCurrency,
}: {
  summary: MonthSummaryDto;
  draft: Record<number, string>;
  setDraft: (v: Record<number, string>) => void;
  categories: { id: number; code: string; label: string; displayOrder: number }[];
  baseCurrency: string;
}) {
  const byCategoryId = new Map(summary.budgets.map((b) => [b.categoryId, b]));
  const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Set a limit for each category (in {baseCurrency}). Leave blank to skip.
      </p>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="text-left py-2">Category</th>
            <th className="text-right py-2">Limit</th>
            <th className="text-left py-2 pl-2">Currency</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const existing = byCategoryId.get(c.id);
            return (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-800">{c.label}</td>
                <td className="py-2 text-right w-36">
                  <Input
                    className="text-right"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={draft[c.id] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })}
                  />
                </td>
                <td className="py-2 pl-2 text-slate-600">
                  {existing?.currency ?? baseCurrency}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function suggestNextMonth(months: MonthDto[]): { year: number; month: number } {
  if (months.length === 0) {
    const d = new Date();
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }
  const latest = months.reduce((acc, m) => {
    if (m.year > acc.year || (m.year === acc.year && m.month > acc.month)) return m;
    return acc;
  });
  return nextMonth(latest.year, latest.month);
}

function readError(e: unknown): string {
  if (e instanceof HttpError) {
    if (typeof e.body === "object" && e.body && "message" in e.body) {
      return e.body.message || "Request failed";
    }
    return String(e.message);
  }
  return e instanceof Error ? e.message : String(e);
}
