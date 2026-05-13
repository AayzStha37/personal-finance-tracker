import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, EmptyState, Modal, StatusPill } from "../components/ui";
import { monthLabel } from "../lib/money";
import NewMonthWizard from "../features/newMonth/NewMonthWizard";
import { useApp } from "../state/AppContext";
import { api } from "../api/client";

export default function MonthsPage() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteMonth(deleteTarget.id);
      setDeleteTarget(null);
      await app.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-slate-900">Months</h1>
        <Button onClick={() => setOpen(true)}>+ New month</Button>
      </div>

      {app.months.length === 0 ? (
        <Card>
          <EmptyState
            title="No months yet"
            action={<Button onClick={() => setOpen(true)}>Create first month</Button>}
          />
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2">Period</th>
                <th className="text-left">Status</th>
                <th className="text-left">Opened</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {app.months.map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-800">
                    {monthLabel(m.year, m.month)}
                  </td>
                  <td className="py-2">
                    <StatusPill status={m.status} />
                  </td>
                  <td className="py-2 text-slate-600">
                    {m.openedAt ? new Date(m.openedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        to={`/months/${m.id}`}
                        className="text-slate-500 hover:text-slate-800 transition-colors"
                        title="Open month"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </Link>
                      {m.status === "DRAFT" ? (
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              id: m.id,
                              label: monthLabel(m.year, m.month),
                            })
                          }
                          className="text-rose-400 hover:text-rose-600 transition-colors"
                          title="Delete month"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      ) : (
                        <span className="w-[18px]" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <NewMonthWizard
        open={open}
        onClose={() => setOpen(false)}
        onCreated={async () => app.refresh()}
      />

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete month"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-slate-900">
              {deleteTarget?.label}
            </span>
            ? This will permanently remove all associated balances, budgets,
            expenses, incomes, investments, and EMI installments.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
