import { useState } from "react";
import { api, HttpError } from "../api/client";
import type { InvestmentDto, InvestmentRequest } from "../api/types";
import { Badge, Button, Card, Input, Label, Modal, Select } from "../components/ui";
import { useApp } from "../state/AppContext";

export default function InvestmentsPage() {
  const app = useApp();
  const [editing, setEditing] = useState<InvestmentDto | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-slate-900">Investments</h1>
        <Button onClick={() => setEditing("new")}>+ Add holding</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <Card>
        {app.investments.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No holdings yet. Track ETFs, stocks, or any asset.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2">Name</th>
                <th className="text-left">Ticker</th>
                <th className="text-left">Type</th>
                <th className="text-left">Ccy</th>
                <th className="text-left">Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {app.investments.map((i) => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{i.name}</td>
                  <td className="py-2 text-slate-600">{i.ticker ?? "—"}</td>
                  <td className="py-2">
                    <Badge variant="default">{i.type}</Badge>
                  </td>
                  <td className="py-2 text-slate-600">{i.currency}</td>
                  <td className="py-2">
                    {i.active ? (
                      <Badge variant="success">yes</Badge>
                    ) : (
                      <Badge variant="default">no</Badge>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="text-slate-700 hover:text-slate-900 text-sm font-medium"
                      onClick={() => setEditing(i)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <InvestmentEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setError(null);
            await app.refresh();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function InvestmentEditor({
  initial,
  onClose,
  onSaved,
  onError,
}: {
  initial: InvestmentDto | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const { accounts, currencies } = useApp();
  const [name, setName] = useState(initial?.name ?? "");
  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [type, setType] = useState(initial?.type ?? "ETF");
  const [currency, setCurrency] = useState(initial?.currency ?? currencies?.base ?? "CAD");
  const [accountId, setAccountId] = useState<number | null>(initial?.accountId ?? null);
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const req: InvestmentRequest = {
        name,
        ticker: ticker.trim() || null,
        type,
        currency,
        accountId,
        active,
      };
      if (initial) await api.updateInvestment(initial.id, req);
      else await api.createInvestment(req);
      await onSaved();
    } catch (e) {
      onError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial) return;
    if (!confirm(`Deactivate ${initial.name}?`)) return;
    setBusy(true);
    try {
      await api.deleteInvestment(initial.id);
      await onSaved();
    } catch (e) {
      onError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Edit — ${initial.name}` : "New investment"}
    >
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VFV" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Ticker</Label>
            <Input
              value={ticker ?? ""}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="VFV.TO"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="ETF | STOCK | MF | CRYPTO"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
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
            <Label>Held in (optional)</Label>
            <Select
              value={accountId ?? ""}
              onChange={(e) =>
                setAccountId(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span className="text-slate-700">Active</span>
        </label>
      </div>
      <div className="flex justify-between mt-6 pt-4 border-t border-slate-200">
        <div>
          {initial && (
            <Button variant="danger" onClick={remove} disabled={busy}>
              Deactivate
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
