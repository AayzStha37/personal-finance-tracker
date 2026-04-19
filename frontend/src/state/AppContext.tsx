import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import type {
  AccountDto,
  BudgetCategoryDto,
  CurrenciesResponse,
  MonthDto,
} from "../api/types";

interface AppState {
  currencies: CurrenciesResponse | null;
  accounts: AccountDto[];
  categories: BudgetCategoryDto[];
  months: MonthDto[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currencies, setCurrencies] = useState<CurrenciesResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [categories, setCategories] = useState<BudgetCategoryDto[]>([]);
  const [months, setMonths] = useState<MonthDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [c, a, cat, m] = await Promise.all([
        api.listCurrencies(),
        api.listAccounts(),
        api.listBudgetCategories(),
        api.listMonths(),
      ]);
      setCurrencies(c);
      setAccounts(a);
      setCategories(cat);
      setMonths(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AppContext.Provider
      value={{ currencies, accounts, categories, months, loading, error, refresh }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
