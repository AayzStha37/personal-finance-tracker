import { useEffect, useState } from "react";
import { api, HttpError } from "../api/client";
import type { CurrencyDto, SubscriptionPlanDto, SubscriptionPlanRequest } from "../api/types";
import { Badge, Button, Card, Input, Label, Modal, Select } from "../components/ui";
import { formatMoney, monthLabel, toMinor } from "../lib/money";
import { useApp } from "../state/AppContext";

export default function SubscriptionsPage() {
  const { currencies } = useApp();
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPlans(await api.listSubscriptionPlans());
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
    if (!confirm("Cancel this subscription? It will no longer generate expenses in new months.")) {
      return;
    }
    setBusy(true);
    try {
      await api.cancelSubscriptionPlan(id);
      await load();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deletePlan(id: number) {
    if (!confirm("Permanently delete this subscription? Past expense entries are kept.")) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteSubscriptionPlan(id);
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
        <h1 className="text-xl font-semibold text-slate-900">Subscriptions</h1>
        <Button onClick={() => setCreating(true)}>+ New subscription</Button>
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
            No subscriptions yet. Add one to auto-generate expenses each month.
          </p>
        ) : (
          <div className="space-y-3">
            {plans.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-4"
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
                    {formatMoney(p.amount, p.currency, currencies?.currencies)} / month
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.active && (
                    <Button
                      variant="ghost"
                      onClick={() => void cancelPlan(p.id)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => void deletePlan(p.id)}
                    disabled={busy}
                    className="text-rose-600 hover:text-rose-800"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {creating && (
        <SubscriptionEditor
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

function SubscriptionEditor({
  currencies,
  onClose,
  onSaved,
}: {
  currencies: CurrencyDto[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const today = new Date();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [startYear, setStartYear] = useState(String(today.getFullYear()));
  const [startMonth, setStartMonth] = useState(String(today.getMonth() + 1));
  const [currency, setCurrency] = useState(currencies[0]?.code ?? "CAD");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!label || !amount) {
      setError("All fields are required.");
      return;
    }
    const amountMinor = toMinor(amount, currency, currencies);
    if (amountMinor == null) {
      setError("Amount must be a valid number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: SubscriptionPlanRequest = {
        label,
        amount: amountMinor,
        currency,
        startYear: Number(startYear),
        startMonth: Number(startMonth),
      };
      await api.createSubscriptionPlan(body);
      await onSaved();
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New subscription">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Netflix, Gym, etc."
          />
        </div>
        <div>
          <Label>Amount</Label>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
          {busy ? "Creating…" : "Create subscription"}
        </Button>
      </div>
    </Modal>
  );
}
