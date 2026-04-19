import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, EmptyState, StatusPill } from "../components/ui";
import { monthLabel } from "../lib/money";
import NewMonthWizard from "../features/newMonth/NewMonthWizard";
import { useApp } from "../state/AppContext";

export default function MonthsPage() {
  const app = useApp();
  const [open, setOpen] = useState(false);

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
                    <Link
                      to={`/months/${m.id}`}
                      className="text-sm text-slate-700 hover:text-slate-900 font-medium"
                    >
                      Open →
                    </Link>
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
    </div>
  );
}
