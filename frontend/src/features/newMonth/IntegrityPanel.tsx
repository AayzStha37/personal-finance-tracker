import type { MonthSummaryDto } from "../../api/types";
import { Badge } from "../../components/ui";
import { formatMoney, signedMoney } from "../../lib/money";
import { useApp } from "../../state/AppContext";

export default function IntegrityPanel({ summary }: { summary: MonthSummaryDto }) {
  const { currencies } = useApp();
  const comps = summary.integrity.comparisons;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Integrity check</p>
          <p className="text-xs text-slate-500">
            Per-account: previous closing must equal current opening.
          </p>
        </div>
        {summary.integrity.ok ? (
          <Badge variant="success">PASS</Badge>
        ) : (
          <Badge variant="danger">FAIL</Badge>
        )}
      </div>

      {comps.length === 0 ? (
        <p className="text-sm text-slate-500">
          No balances to compare. Add accounts and set opening balances.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="text-left py-2">Account</th>
              <th className="text-right py-2">Prev closing</th>
              <th className="text-right py-2">Opening</th>
              <th className="text-right py-2">Delta</th>
              <th className="text-right py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.accountId} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-800">{c.accountName}</td>
                <td className="py-2 text-right text-slate-600">
                  {formatMoney(c.previousClosing, c.currency, currencies?.currencies)}
                </td>
                <td className="py-2 text-right text-slate-800">
                  {formatMoney(c.currentOpening, c.currency, currencies?.currencies)}
                </td>
                <td
                  className={`py-2 text-right ${
                    c.delta == null
                      ? "text-slate-400"
                      : c.delta === 0
                        ? "text-slate-500"
                        : "text-rose-600"
                  }`}
                >
                  {signedMoney(c.delta, c.currency, currencies?.currencies)}
                </td>
                <td className="py-2 text-right">
                  {c.matches ? (
                    <Badge variant="success">match</Badge>
                  ) : (
                    <Badge variant="danger">mismatch</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!summary.integrity.ok && (
        <p className="text-xs text-amber-700">
          Fix mismatches (go Back to Balances) before activating. You can always save as DRAFT
          and return later.
        </p>
      )}
    </div>
  );
}
