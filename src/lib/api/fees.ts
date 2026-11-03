import { api, apiBlob, type Schemas } from "./client";
import type { Page } from "./endpoints";

/** Typed calls for Phase 3 fees. Money-creating calls carry an Idempotency-Key (one per form submission). */

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

const keyed = (key: string) => ({ "Idempotency-Key": key });

/** A fresh key for one attempt at a money action; reuse it when retrying the same attempt. */
export function newKey() {
  return crypto.randomUUID();
}

export type FeeHead = Schemas["HeadView"];
export type OpenLine = Schemas["OpenLine"];
export type Payment = Schemas["PaymentView"];
export type Ledger = Schemas["Ledger"];
export type Bill = Schemas["BillView"];
export type RunReport = Schemas["RunReport"];
export type Discount = Schemas["DiscountView"];
export type Adjustment = Schemas["AdjustmentView"];

export const FREQUENCIES = [
  { value: "MONTHLY", label: "Every month" },
  { value: "YEARLY", label: "Once a year" },
  { value: "ONE_TIME", label: "Once (e.g. admission)" },
  { value: "PER_TERM", label: "Per term" },
  { value: "CUSTOM", label: "When needed" },
] as const;

export const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank deposit" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "ONLINE", label: "Online transfer" },
] as const;

export const fees = {
  // set-up
  heads: () => api<FeeHead[]>("/fees/heads"),
  createHead: (body: Schemas["FeeHeadRequest"]) => api<FeeHead>("/fees/heads", { method: "POST", body }),
  updateHead: (id: number, body: Schemas["FeeHeadRequest"]) =>
    api<FeeHead>(`/fees/heads/${id}`, { method: "PATCH", body }),
  headStatus: (id: number, active: boolean) =>
    api<FeeHead>(`/fees/heads/${id}/status`, { method: "POST", body: { active } }),
  classAmounts: (yearId: number) => api<Schemas["ClassAmount"][]>(`/fees/years/${yearId}/class-amounts`),
  saveClassAmounts: (yearId: number, body: Schemas["ClassAmountRequest"][]) =>
    api<Schemas["ClassAmount"][]>(`/fees/years/${yearId}/class-amounts`, { method: "PUT", body }),
  missingAmounts: (yearId: number) => api<Schemas["MissingAmount"][]>(`/fees/years/${yearId}/missing-amounts`),
  overrides: (studentId: number, yearId: number) =>
    api<Schemas["OverrideView"][]>(`/fees/students/${studentId}/overrides?${query({ yearId })}`),
  saveOverride: (studentId: number, body: Schemas["OverrideRequest"]) =>
    api<Schemas["OverrideView"][]>(`/fees/students/${studentId}/overrides`, { method: "PUT", body }),
  siblingRules: () => api<Schemas["SiblingRule"][]>("/fees/sibling-rules"),
  saveSiblingRules: (body: Schemas["SiblingRuleRequest"][]) =>
    api<Schemas["SiblingRule"][]>("/fees/sibling-rules", { method: "PUT", body }),
  accounts: () => api<Schemas["AccountView"][]>("/fees/accounts"),

  // discounts
  discounts: (params: { status?: string; studentId?: number } = {}) =>
    api<Discount[]>(`/fees/discounts?${query(params)}`),
  createDiscount: (body: Schemas["DiscountRequest"]) => api<Discount>("/fees/discounts", { method: "POST", body }),
  approveDiscount: (id: number, note?: string) =>
    api<Discount>(`/fees/discounts/${id}/approve`, { method: "POST", body: { note } }),
  rejectDiscount: (id: number, note: string) =>
    api<Discount>(`/fees/discounts/${id}/reject`, { method: "POST", body: { note } }),
  endDiscount: (id: number, reason: string, lastDay?: string) =>
    api<Discount>(`/fees/discounts/${id}/end`, { method: "POST", body: { reason, lastDay } }),

  // bills
  runBills: (body: Schemas["BillRunRequest"], key: string) =>
    api<RunReport>("/fees/bill-runs", { method: "POST", body, headers: keyed(key) }),
  runs: () => api<Schemas["RunView"][]>("/fees/bill-runs"),
  runLateFee: (body: Schemas["LateFeeRequest"], key: string) =>
    api<RunReport>("/fees/late-fee-runs", { method: "POST", body, headers: keyed(key) }),
  runAbsentFine: (month: string, key: string) =>
    api<RunReport>("/fees/absent-fine-runs", { method: "POST", body: { month }, headers: keyed(key) }),
  admissionProposal: (studentId: number) =>
    api<Schemas["PlannedLine"][]>(`/fees/students/${studentId}/admission-proposal`),
  bills: (params: {
    studentId?: number;
    familyId?: number;
    classId?: number;
    sectionId?: number;
    runId?: number;
    status?: string;
    q?: string;
    page?: number;
  }) => api<Page<Schemas["BillRow"]>>(`/fees/bills?${query({ ...params, page: params.page ?? 0 })}`),
  bill: (id: number) => api<Bill>(`/fees/bills/${id}`),
  voucher: (id: number) => apiBlob(`/fees/bills/${id}/voucher`),
  vouchers: (body: Schemas["VoucherRequest"]) => apiBlob("/fees/vouchers", { method: "POST", body }),

  // payments
  pay: (body: Schemas["PaymentRequest"], key: string) =>
    api<Payment>("/fees/payments", { method: "POST", body, headers: keyed(key) }),
  payments: (params: {
    from?: string;
    to?: string;
    method?: string;
    accountId?: number;
    familyId?: number;
    q?: string;
    page?: number;
  }) => api<Page<Schemas["PaymentRow"]>>(`/fees/payments?${query({ ...params, page: params.page ?? 0 })}`),
  payment: (id: number) => api<Payment>(`/fees/payments/${id}`),
  receipt: (id: number) => apiBlob(`/fees/payments/${id}/receipt`),
  reverse: (id: number, reason: string) =>
    api<Payment>(`/fees/payments/${id}/reverse`, { method: "POST", body: { reason } }),
  openLines: (familyId: number, studentId?: number) =>
    api<OpenLine[]>(`/fees/families/${familyId}/open-lines?${query({ studentId })}`),
  applyCredit: (familyId: number) =>
    api<{ applied: string }>(`/fees/families/${familyId}/apply-credit`, { method: "POST" }),

  // corrections
  adjustments: (params: { status?: string; studentId?: number } = {}) =>
    api<Adjustment[]>(`/fees/adjustments?${query(params)}`),
  requestAdjustment: (body: Schemas["AdjustmentRequest"]) =>
    api<Adjustment>("/fees/adjustments", { method: "POST", body }),
  approveAdjustment: (id: number, note?: string) =>
    api<Adjustment>(`/fees/adjustments/${id}/approve`, { method: "POST", body: { note } }),
  rejectAdjustment: (id: number, note: string) =>
    api<Adjustment>(`/fees/adjustments/${id}/reject`, { method: "POST", body: { note } }),

  // ledgers, status, collections
  studentLedger: (id: number) => api<Ledger>(`/fees/students/${id}/ledger`),
  familyLedger: (id: number) => api<Ledger>(`/fees/families/${id}/ledger`),
  status: (params: { classId?: number; sectionId?: number; status?: string; q?: string; page?: number }) =>
    api<Page<Schemas["StatusRow"]>>(`/fees/status?${query({ ...params, page: params.page ?? 0 })}`),
  defaulters: (params: { minBalance?: string; minDaysOverdue?: number; classId?: number }) =>
    api<Schemas["DefaulterRow"][]>(`/fees/defaulters?${query(params)}`),
  followUps: (familyId: number) => api<Schemas["FollowUp"][]>(`/fees/families/${familyId}/follow-ups`),
  addFollowUp: (familyId: number, body: Schemas["FollowUpRequest"]) =>
    api<Schemas["FollowUp"][]>(`/fees/families/${familyId}/follow-ups`, { method: "POST", body }),
  finalReminder: (familyId: number) => apiBlob(`/fees/families/${familyId}/final-reminder`, { method: "POST" }),
  remind: (body: Schemas["ReminderRequest"], key: string) =>
    api<Schemas["ReminderResult"]>("/fees/reminders", { method: "POST", body, headers: keyed(key) }),
  messages: (status?: string) => api<Schemas["Queued"][]>(`/fees/messages?${query({ status })}`),

  // reports
  headReport: (from: string, to: string) => api<Schemas["HeadReportRow"][]>(`/fees/reports/heads?${query({ from, to })}`),
  collectionReport: (from: string, to: string) =>
    api<Schemas["HeadReportRow"][]>(`/fees/reports/collections?${query({ from, to })}`),
  familyReceivables: () => api<Schemas["FamilyReceivable"][]>("/fees/reports/family-receivables"),
  writeOffs: (kind = "BAD_DEBT") => api<Schemas["AdjustmentRow"][]>(`/fees/reports/write-offs?${query({ kind })}`),
  credits: () => api<Schemas["CreditRow"][]>("/fees/reports/credits"),
  missingSiblingDiscounts: () => api<Schemas["MissingDiscountRow"][]>("/fees/reports/missing-sibling-discounts"),
};
