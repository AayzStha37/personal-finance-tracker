import { useState } from "react";
import { api, HttpError } from "../api/client";
import type { AccountDto, AccountKind, AccountRequest } from "../api/types";
import { Badge, Button, Card, Input, Label, Modal, Select } from "../components/ui";
import { useApp } from "../state/AppContext";

const KINDS: AccountKind[] = ["BANK", "CASH", "CREDIT", "INVESTMENT"];

export default function AccountsPage() {
  const app = useApp();
  const [editing, setEditing] = useState<AccountDto | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-slate-900">Accounts</h1>
        <Button onClick={() => setEditing("new")}>+ Add account</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <Card>
        {app.accounts.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No accounts yet. Add one to start tracking balances.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2">Name</th>
                <th className="text-left">Kind</th>
                <th className="text-left">Currency</th>
                <th className="text-left">Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {app.accounts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">{a.name}</td>
                  <td className="py-2">
                    <Badge variant="default">{a.kind}</Badge>
                  </td>
                  <td className="py-2 text-slate-600">{a.currency}</td>
                  <td className="py-2">
                    {a.active ? (
                      <Badge variant="success">yes</Badge>
                    ) : (
                      <Badge variant="default">no</Badge>
                    )}
                  </td>
                  <td className="py-2 text-right text-slate-600">{a.displayOrder}</td>
                  <td className="py-2 text-right">
                    <button
                      className="text-slate-700 hover:text-slate-900 text-sm font-medium"
                      onClick={() => setEditing(a)}
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
        <AccountEditor
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

function AccountEditor({
  initial,
  onClose,
  onSaved,
  onError,
}: {
  initial: AccountDto | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const { currencies } = useApp();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? "BANK");
  const [currency, setCurrency] = useState(
    initial?.currency ?? currencies?.base ?? "CAD",
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [displayOrder] = useState(initial?.displayOrder ?? 100);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const req: AccountRequest = { name, kind, currency, active, displayOrder };
      if (initial) await api.updateAccount(initial.id, req);
      else await api.createAccount(req);
      await onSaved();
    } catch (e) {
      onError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial) return;
    if (!confirm(`Deactivate account "${initial.name}"?`)) return;
    setBusy(true);
    try {
      await api.deleteAccount(initial.id);
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
      title={initial ? `Edit account — ${initial.name}` : "New account"}
    >
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="RBC Savings"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Kind</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
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
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-slate-700">Active</span>
          </label>
        </div>
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
