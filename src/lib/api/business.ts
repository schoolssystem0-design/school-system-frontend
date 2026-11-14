import { api, apiBlob, type Schemas } from "./client";

/** Tirvex Tech: subscriptions and invoices (owner), the owner's dashboard, and school benchmarking. */
export type BillingOverview = Schemas["BillingOverview"];
export type SchoolBilling = Schemas["SchoolBilling"];
export type Invoice = Schemas["InvoiceView"];
export type Subscription = Schemas["SubscriptionView"];
export type BusinessDashboard = Schemas["BusinessDashboard"];
export type Benchmark = Schemas["Benchmark"];
export type OwnSubscription = Schemas["OwnSubscription"];

export const billing = {
  overview: () => api<BillingOverview>("/platform/billing"),
  setPaymentDetails: (paymentDetails: string) =>
    api<{ paymentDetails?: string }>("/platform/billing/details", { method: "PUT", body: { paymentDetails } }),
  run: () => api<{ invoicesIssued?: number; remindersSent?: number }>("/platform/billing/run", { method: "POST" }),
  school: (schoolId: number) => api<SchoolBilling>(`/platform/schools/${schoolId}/billing`),
  saveSubscription: (
    schoolId: number,
    body: { cycle: string; amount: string; startOn?: string; graceDays?: number; notes?: string },
  ) => api<SchoolBilling>(`/platform/schools/${schoolId}/subscription`, { method: "PUT", body }),
  cancel: (schoolId: number) => api<SchoolBilling>(`/platform/schools/${schoolId}/subscription/cancel`, { method: "POST" }),
  pay: (invoiceId: number, body: { paidOn?: string; method?: string; reference?: string }) =>
    api<Invoice>(`/platform/invoices/${invoiceId}/pay`, { method: "POST", body }),
  void: (invoiceId: number, reason: string) =>
    api<Invoice>(`/platform/invoices/${invoiceId}/void`, { method: "POST", body: { reason } }),
  pdf: (invoiceId: number) => apiBlob(`/platform/invoices/${invoiceId}/pdf`),
  dashboard: () => api<BusinessDashboard>("/platform/dashboard"),
};

/** The school's own subscription and how it compares with similar schools. */
export const school = {
  subscription: () => api<OwnSubscription>("/subscription"),
  invoicePdf: (invoiceId: number) => apiBlob(`/subscription/invoices/${invoiceId}/pdf`),
  benchmark: () => api<Benchmark>("/reports/benchmark"),
};
