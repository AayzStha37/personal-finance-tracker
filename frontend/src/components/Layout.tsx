import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { useApp } from "../state/AppContext";

export default function Layout() {
  const { loading, error } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white grid place-items-center text-sm font-bold">
              $
            </div>
            <h1 className="text-lg font-semibold text-slate-900">Finance Tracker</h1>
          </div>
          <nav className="flex items-center gap-1 ml-4">
            {[
              { to: "/", label: "Dashboard", end: true },
              { to: "/months", label: "Months" },
              { to: "/accounts", label: "Accounts" },
              { to: "/investments", label: "Investments" },
              { to: "/emi", label: "EMIs" },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-4 py-3">
            {error}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-slate-500 text-sm py-10 text-center">Loading…</div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
