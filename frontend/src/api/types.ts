// Shared types mirroring backend DTOs (com.pft.web.dto.Dtos).

export type MonthStatus = "DRAFT" | "ACTIVE" | "LOCKED";
export type AccountKind = "BANK" | "CASH" | "CREDIT" | "INVESTMENT";

export interface MonthDto {
  id: number;
  year: number;
  month: number;
  status: MonthStatus;
  openedAt: string | null;
  lockedAt: string | null;
  integrityOk: boolean;
  notes: string | null;
}

export interface CreateMonthRequest {
  year: number;
  month: number;
  rolloverBalances?: boolean;
  rolloverBudgets?: boolean;
  rolloverInvestments?: boolean;
}

export interface AccountBalanceComparison {
  accountId: number;
  accountName: string;
  currency: string | null;
  previousClosing: number | null;
  currentOpening: number | null;
  delta: number | null;
  matches: boolean;
}

export interface IntegrityCheckDto {
  ok: boolean;
  comparisons: AccountBalanceComparison[];
}

export interface BalanceDto {
  accountId: number;
  accountName: string;
  currency: string;
  openingAmount: number | null;
  closingAmount: number | null;
}

export interface BalanceUpdate {
  accountId: number;
  openingAmount: number | null;
  closingAmount: number | null;
}

export interface BudgetDto {
  categoryId: number;
  categoryCode: string;
  categoryLabel: string;
  limitAmount: number | null;
  currency: string | null;
}

export interface BudgetUpdate {
  categoryId: number;
  limitAmount: number;
  currency: string;
}

export interface BudgetCategoryDto {
  id: number;
  code: string;
  label: string;
  displayOrder: number;
}

export interface InvestmentDto {
  id: number;
  name: string;
  ticker: string | null;
  type: string;
  currency: string;
  accountId: number | null;
  active: boolean;
}

export interface InvestmentRequest {
  name: string;
  ticker?: string | null;
  type: string;
  currency: string;
  accountId?: number | null;
  active?: boolean;
}

export interface InvestmentSnapshotDto {
  investmentId: number;
  investmentName: string;
  currency: string;
  shares: string | number | null;
  amountInvested: number | null;
  marketValue: number | null;
  netChange: number | null;
}

export interface InvestmentSnapshotUpdate {
  investmentId: number;
  shares: number | string;
  amountInvested: number;
  marketValue?: number | null;
}

export interface MonthSummaryDto {
  month: MonthDto;
  previousMonthId: number | null;
  balances: BalanceDto[];
  budgets: BudgetDto[];
  investments: InvestmentSnapshotDto[];
  integrity: IntegrityCheckDto;
}

export interface AccountDto {
  id: number;
  name: string;
  kind: AccountKind;
  currency: string;
  active: boolean;
  displayOrder: number;
}

export interface AccountRequest {
  name: string;
  kind: AccountKind;
  currency: string;
  active?: boolean;
  displayOrder?: number;
}

export interface CurrencyDto {
  code: string;
  symbol: string;
  decimals: number;
}

export interface CurrenciesResponse {
  base: string;
  currencies: CurrencyDto[];
}

export interface ApiError {
  status: number;
  error: string;
  message: string;
  details: string[] | null;
}

// ---- EMI --------------------------------------------------------------

export type InstallmentStatus = "PROJECTED" | "PAID" | "SKIPPED";

export interface EmiInstallmentDto {
  id: number;
  planId: number;
  planLabel: string | null;
  seqNo: number;
  totalInstallments: number;
  dueMonthId: number;
  dueYear: number | null;
  dueMonth: number | null;
  amount: number;
  currency: string | null;
  status: InstallmentStatus;
  expenseEntryId: number | null;
}

export interface EmiPlanDto {
  id: number;
  label: string;
  principal: number;
  installmentAmount: number;
  totalInstallments: number;
  startMonthId: number;
  accountId: number;
  categoryId: number;
  currency: string;
  active: boolean;
  installments: EmiInstallmentDto[];
}

export interface EmiPlanRequest {
  label: string;
  principal: number;
  installmentAmount: number;
  totalInstallments: number;
  startYear: number;
  startMonth: number;
  accountId: number;
  categoryId: number;
  currency: string;
}
