import type {
  AccountDto,
  AccountRequest,
  ApiError,
  BalanceDto,
  BalanceUpdate,
  BudgetCategoryDto,
  BudgetDto,
  BudgetUpdate,
  CreateMonthRequest,
  CurrenciesResponse,
  EmiInstallmentDto,
  EmiPlanDto,
  EmiPlanRequest,
  ExchangeRateDto,
  ExchangeRateUpsert,
  ExpenseEntryDto,
  ExpenseEntryRequest,
  IncomeEntryDto,
  IncomeEntryRequest,
  IntegrityCheckDto,
  InvestmentDto,
  InvestmentRequest,
  InvestmentSnapshotDto,
  InvestmentSnapshotUpdate,
  MonthDto,
  MonthSummaryDto,
} from "./types";

const BASE = "/api";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | string,
  ) {
    const message =
      typeof body === "string" ? body : body?.message || body?.error || `HTTP ${status}`;
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new HttpError(res.status, (parsed as ApiError) ?? text ?? `HTTP ${res.status}`);
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  // Months
  listMonths: () => request<MonthDto[]>("/months"),
  getCurrentMonth: async (): Promise<MonthDto | null> => {
    const res = await fetch(`${BASE}/months/current`);
    if (res.status === 204) return null;
    if (!res.ok) throw new HttpError(res.status, await res.text());
    return (await res.json()) as MonthDto;
  },
  getMonth: (id: number) => request<MonthDto>(`/months/${id}`),
  getMonthSummary: (id: number) => request<MonthSummaryDto>(`/months/${id}/summary`),
  createMonth: (req: CreateMonthRequest) =>
    request<MonthSummaryDto>("/months", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  activateMonth: (id: number) =>
    request<MonthDto>(`/months/${id}/activate`, { method: "POST" }),
  lockMonth: (id: number) =>
    request<MonthDto>(`/months/${id}/lock`, { method: "POST" }),
  runIntegrity: (id: number) =>
    request<IntegrityCheckDto>(`/months/${id}/integrity-check`, { method: "POST" }),
  listMonthEmiInstallments: (id: number) =>
    request<EmiInstallmentDto[]>(`/months/${id}/emi-installments`),

  // Balances
  listBalances: (monthId: number) =>
    request<BalanceDto[]>(`/months/${monthId}/balances`),
  updateBalances: (monthId: number, balances: BalanceUpdate[]) =>
    request<BalanceDto[]>(`/months/${monthId}/balances`, {
      method: "PUT",
      body: JSON.stringify({ balances }),
    }),

  // Budgets
  listBudgets: (monthId: number) =>
    request<BudgetDto[]>(`/months/${monthId}/budgets`),
  updateBudgets: (monthId: number, budgets: BudgetUpdate[]) =>
    request<BudgetDto[]>(`/months/${monthId}/budgets`, {
      method: "PUT",
      body: JSON.stringify({ budgets }),
    }),

  // Investments
  listInvestmentSnapshots: (monthId: number) =>
    request<InvestmentSnapshotDto[]>(`/months/${monthId}/investments`),
  updateInvestmentSnapshots: (monthId: number, snapshots: InvestmentSnapshotUpdate[]) =>
    request<InvestmentSnapshotDto[]>(`/months/${monthId}/investments`, {
      method: "PUT",
      body: JSON.stringify({ snapshots }),
    }),

  // Budget categories
  listBudgetCategories: () => request<BudgetCategoryDto[]>("/budget-categories"),

  // Accounts
  listAccounts: () => request<AccountDto[]>("/accounts"),
  createAccount: (req: AccountRequest) =>
    request<AccountDto>("/accounts", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  updateAccount: (id: number, req: AccountRequest) =>
    request<AccountDto>(`/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(req),
    }),
  deleteAccount: (id: number) =>
    request<void>(`/accounts/${id}`, { method: "DELETE" }),

  // Investments catalog
  listInvestments: () => request<InvestmentDto[]>("/investments"),
  createInvestment: (req: InvestmentRequest) =>
    request<InvestmentDto>("/investments", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  updateInvestment: (id: number, req: InvestmentRequest) =>
    request<InvestmentDto>(`/investments/${id}`, {
      method: "PUT",
      body: JSON.stringify(req),
    }),
  deleteInvestment: (id: number) =>
    request<void>(`/investments/${id}`, { method: "DELETE" }),

  // Currencies
  listCurrencies: () => request<CurrenciesResponse>("/currencies"),

  // EMI
  listEmiPlans: () => request<EmiPlanDto[]>("/emi/plans"),
  getEmiPlan: (id: number) => request<EmiPlanDto>(`/emi/plans/${id}`),
  createEmiPlan: (req: EmiPlanRequest) =>
    request<EmiPlanDto>("/emi/plans", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  cancelEmiPlan: (id: number) =>
    request<EmiPlanDto>(`/emi/plans/${id}/cancel`, { method: "POST" }),
  skipEmiInstallment: (id: number) =>
    request<EmiInstallmentDto>(`/emi/installments/${id}/skip`, { method: "POST" }),

  // Expenses
  listExpenses: (monthId: number) =>
    request<ExpenseEntryDto[]>(`/months/${monthId}/expenses`),
  createExpense: (monthId: number, req: ExpenseEntryRequest) =>
    request<ExpenseEntryDto>(`/months/${monthId}/expenses`, {
      method: "POST",
      body: JSON.stringify(req),
    }),
  updateExpense: (id: number, req: ExpenseEntryRequest) =>
    request<ExpenseEntryDto>(`/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(req),
    }),
  deleteExpense: (id: number) =>
    request<void>(`/expenses/${id}`, { method: "DELETE" }),

  // Exchange rates
  listExchangeRates: (month?: string) =>
    request<ExchangeRateDto[]>(
      month ? `/exchange-rates?month=${encodeURIComponent(month)}` : "/exchange-rates",
    ),
  upsertExchangeRate: (req: ExchangeRateUpsert) =>
    request<ExchangeRateDto>("/exchange-rates", {
      method: "PUT",
      body: JSON.stringify(req),
    }),
  autoFetchExchangeRate: (from: string, to: string, month: string) =>
    request<ExchangeRateDto>(
      `/exchange-rates/auto-fetch?from=${encodeURIComponent(from)}&to=${encodeURIComponent(
        to,
      )}&month=${encodeURIComponent(month)}`,
      { method: "POST" },
    ),

  // Incomes
  listIncomes: (monthId: number) =>
    request<IncomeEntryDto[]>(`/months/${monthId}/incomes`),
  createIncome: (monthId: number, req: IncomeEntryRequest) =>
    request<IncomeEntryDto>(`/months/${monthId}/incomes`, {
      method: "POST",
      body: JSON.stringify(req),
    }),
  updateIncome: (id: number, req: IncomeEntryRequest) =>
    request<IncomeEntryDto>(`/incomes/${id}`, {
      method: "PUT",
      body: JSON.stringify(req),
    }),
  deleteIncome: (id: number) =>
    request<void>(`/incomes/${id}`, { method: "DELETE" }),
};
