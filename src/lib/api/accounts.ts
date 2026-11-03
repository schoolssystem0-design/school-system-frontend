import { api, apiBlob, type Schemas } from "./client";
import type { Page } from "./endpoints";

/** Typed calls for Phase 4: school accounts and payroll. Every change asks for a verification code (step-up). */

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

const keyed = (key: string) => ({ "Idempotency-Key": key });

export type MoneyAccount = Schemas["MoneyAccountView"];
export type Category = Schemas["CategoryView"];
export type Vendor = Schemas["VendorView"];
export type Entry = Schemas["EntryView"];
export type Sheet = Schemas["SheetView"];
export type SalaryLine = Schemas["LineView"];

export const ENTRY_KINDS = [
  { value: "INCOME", label: "Income" },
  { value: "EXPENSE", label: "Expense" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "PURCHASE", label: "Supplier bill" },
  { value: "VENDOR_PAYMENT", label: "Supplier payment" },
] as const;

export const JOURNAL_TYPES: Record<string, string> = {
  FEE_RECEIPT: "Fee receipt",
  FEE_CREDIT: "Fee advance used",
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  VENDOR: "Supplier",
  SALARY: "Salaries",
  REVERSAL: "Reversal",
  OPENING: "Opening balance",
  DAY: "Day",
  MONTH: "Month",
};

export const accounts = {
  moneyAccounts: (includeInactive = false) =>
    api<MoneyAccount[]>(`/accounts/money-accounts?${query({ includeInactive })}`),
  createMoneyAccount: (body: Schemas["MoneyAccountRequest"]) =>
    api<MoneyAccount>("/accounts/money-accounts", { method: "POST", body }),
  updateMoneyAccount: (id: number, body: Schemas["MoneyAccountUpdate"]) =>
    api<MoneyAccount>(`/accounts/money-accounts/${id}`, { method: "PATCH", body }),
  openingBalance: (id: number, body: Schemas["OpeningRequest"]) =>
    api<MoneyAccount>(`/accounts/money-accounts/${id}/opening-balance`, { method: "POST", body }),
  categories: (kind?: string) => api<Category[]>(`/accounts/categories?${query({ kind })}`),
  createCategory: (body: Schemas["CategoryRequest"]) => api<Category>("/accounts/categories", { method: "POST", body }),
  updateCategory: (id: number, body: Schemas["CategoryRequest"]) =>
    api<Category>(`/accounts/categories/${id}`, { method: "PATCH", body }),
  vendors: () => api<Vendor[]>("/accounts/vendors"),
  createVendor: (body: Schemas["VendorRequest"]) => api<Vendor>("/accounts/vendors", { method: "POST", body }),
  updateVendor: (id: number, body: Schemas["VendorRequest"]) =>
    api<Vendor>(`/accounts/vendors/${id}`, { method: "PATCH", body }),

  entries: (params: {
    kind?: string;
    status?: string;
    from?: string;
    to?: string;
    accountId?: number;
    categoryId?: number;
    vendorId?: number;
    q?: string;
    page?: number;
  }) => api<Page<Entry>>(`/accounts/entries?${query({ ...params, page: params.page ?? 0 })}`),
  createEntry: (body: Schemas["EntryRequest"], key: string) =>
    api<Entry>("/accounts/entries", { method: "POST", body, headers: keyed(key) }),
  approveEntry: (id: number, note?: string) =>
    api<Entry>(`/accounts/entries/${id}/approve`, { method: "POST", body: { note } }),
  rejectEntry: (id: number, note: string) => api<Entry>(`/accounts/entries/${id}/reject`, { method: "POST", body: { note } }),
  reverseEntry: (id: number, reason: string) =>
    api<Entry>(`/accounts/entries/${id}/reverse`, { method: "POST", body: { reason } }),

  ledger: (accountId: number, from: string, to: string, view: string) =>
    api<Schemas["AccountLedger"]>(`/accounts/ledger/${accountId}?${query({ from, to, view })}`),
  day: (accountId: number, date: string) => api<Schemas["DaySummary"]>(`/accounts/days/${accountId}?${query({ date })}`),
  closes: (accountId: number) => api<Schemas["DayCloseView"][]>(`/accounts/days/${accountId}/closes`),
  closeDay: (accountId: number, body: Schemas["CloseRequest"]) =>
    api<Schemas["DaySummary"]>(`/accounts/days/${accountId}/close`, { method: "POST", body }),
  uncleared: (accountId: number) => api<Schemas["LedgerLine"][]>(`/accounts/reconciliation/${accountId}`),
  clear: (accountId: number, body: Schemas["ClearRequest"]) =>
    api<{ changed: number }>(`/accounts/reconciliation/${accountId}`, { method: "POST", body }),

  trialBalance: (asOf: string) => api<Schemas["BalanceRow"][]>(`/accounts/reports/trial-balance?${query({ asOf })}`),
  balanceSheet: (asOf: string) => api<Schemas["BalanceSheet"]>(`/accounts/reports/balance-sheet?${query({ asOf })}`),
  monthly: (from: string, to: string) => api<Schemas["MonthRow"][]>(`/accounts/reports/monthly?${query({ from, to })}`),
  byCategory: (from: string, to: string) =>
    api<Schemas["CategoryRow"][]>(`/accounts/reports/by-category?${query({ from, to })}`),
  dailyCollection: (from: string, to: string) =>
    api<{ date: string; account: string; fees: string; otherIncome: string; total: string }[]>(
      `/accounts/reports/daily-collection?${query({ from, to })}`,
    ),
  activity: (from: string, to: string, page = 0) =>
    api<Page<Schemas["ActivityRow"]>>(`/accounts/activity?${query({ from, to, page })}`),
};

export const payroll = {
  sheets: () => api<Schemas["SheetRow"][]>("/payroll/sheets"),
  generate: (month: string) => api<Sheet>("/payroll/sheets", { method: "POST", body: { month } }),
  sheet: (id: number) => api<Sheet>(`/payroll/sheets/${id}`),
  updateLine: (lineId: number, body: Schemas["SalaryLineRequest"]) =>
    api<Sheet>(`/payroll/lines/${lineId}`, { method: "PUT", body }),
  approve: (id: number) => api<Sheet>(`/payroll/sheets/${id}/approve`, { method: "POST" }),
  pay: (id: number, body: Schemas["PayRequest"], key: string) =>
    api<Sheet>(`/payroll/sheets/${id}/pay`, { method: "POST", body, headers: keyed(key) }),
  reverse: (id: number, reason: string) => api<Sheet>(`/payroll/sheets/${id}/reverse`, { method: "POST", body: { reason } }),
  slips: (id: number, lineId?: number) => apiBlob(`/payroll/sheets/${id}/slips?${query({ lineId })}`),
};
