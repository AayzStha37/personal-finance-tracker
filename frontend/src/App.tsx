import { useEffect, useState } from "react";

type Ping = {
  status: string;
  currencies: string[];
  categories: string[];
};

export default function App() {
  const [ping, setPing] = useState<Ping | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ping")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setPing)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-md p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-800">
          Personal Finance Tracker
        </h1>
        <p className="text-slate-600">
          Scaffold is up. The New Month wizard and dashboards arrive in Step 4.
        </p>

        <section className="pt-4 border-t border-slate-200">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            Backend status
          </h2>
          {error && (
            <p className="mt-2 text-rose-600 text-sm">Error: {error}</p>
          )}
          {!error && !ping && (
            <p className="mt-2 text-slate-400 text-sm">Contacting backend…</p>
          )}
          {ping && (
            <dl className="mt-2 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-800">{ping.status}</dd>
              <dt className="text-slate-500">Currencies</dt>
              <dd className="text-slate-800">{ping.currencies.join(", ")}</dd>
              <dt className="text-slate-500">Categories</dt>
              <dd className="text-slate-800">{ping.categories.join(", ")}</dd>
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
