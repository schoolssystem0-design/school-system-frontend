import { api, apiBlob, type Schemas } from "./client";

/** Typed calls for Phase 5 attendance. Statuses (D-09): P present, L late, HD half day, A absent, LV leave. */

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

export type Register = Schemas["RegisterView"];
export type RegisterEntry = Schemas["RegisterEntry"];
export type Leave = Schemas["LeaveView"];
export type StaffDay = Schemas["StaffDay"];

export const STATUSES = [
  { value: "P", label: "Present", short: "P" },
  { value: "A", label: "Absent", short: "A" },
  { value: "L", label: "Late", short: "L" },
  { value: "HD", label: "Half day", short: "HD" },
  { value: "LV", label: "Leave", short: "LV" },
] as const;

export const LEAVE_TYPES = [
  { value: "SICK", label: "Sick" },
  { value: "CASUAL", label: "Casual" },
  { value: "FAMILY", label: "Family" },
  { value: "OFFICIAL", label: "Official duty" },
  { value: "OTHER", label: "Other" },
] as const;

export const attendance = {
  register: (sectionId: number, date: string) => api<Register>(`/attendance/registers/${sectionId}?${query({ date })}`),
  saveRegister: (sectionId: number, date: string, body: Schemas["RegisterRequest"]) =>
    api<Register>(`/attendance/registers/${sectionId}?${query({ date })}`, { method: "PUT", body }),
  missing: (date: string) => api<Schemas["MissingRegister"][]>(`/attendance/missing?${query({ date })}`),
  monthly: (sectionId: number, month: string) => apiBlob(`/attendance/registers/${sectionId}/monthly?${query({ month })}`),
  bulk: (body: Schemas["BulkRequest"]) => api<Schemas["BulkResult"]>("/attendance/corrections/bulk", { method: "POST", body }),
  corrections: (params: { from: string; to: string; personType?: string; personId?: number }) =>
    api<Schemas["CorrectionRow"][]>(`/attendance/corrections?${query(params)}`),

  figures: (params: { sectionId?: number; from: string; to: string }) =>
    api<Schemas["StudentFigures"][]>(`/attendance/reports/students?${query(params)}`),
  low: (params: { sectionId?: number; from: string; to: string }) =>
    api<Schemas["StudentFigures"][]>(`/attendance/reports/low?${query(params)}`),
  full: (params: { sectionId?: number; from: string; to: string }) =>
    api<Schemas["StudentFigures"][]>(`/attendance/reports/full?${query(params)}`),
  repeated: (asOf: string) => api<Schemas["RepeatedAbsence"][]>(`/attendance/reports/repeated?${query({ asOf })}`),
  sections: (from: string, to: string) =>
    api<Schemas["SectionSummary"][]>(`/attendance/reports/sections?${query({ from, to })}`),
  studentMonths: (studentId: number, from: string, to: string) =>
    api<Schemas["StudentMonth"][]>(`/attendance/students/${studentId}/months?${query({ from, to })}`),

  leave: (params: { status?: string; personType?: string; personId?: number; from?: string; to?: string } = {}) =>
    api<Leave[]>(`/attendance/leave?${query(params)}`),
  createLeave: (body: Schemas["LeaveApplicationRequest"]) => api<Leave>("/attendance/leave", { method: "POST", body }),
  approveLeave: (id: number) => api<Leave>(`/attendance/leave/${id}/approve`, { method: "POST", body: {} }),
  rejectLeave: (id: number, note: string) => api<Leave>(`/attendance/leave/${id}/reject`, { method: "POST", body: { note } }),
  cancelLeave: (id: number, note: string) => api<Leave>(`/attendance/leave/${id}/cancel`, { method: "POST", body: { note } }),

  staffDay: (date: string) => api<StaffDay>(`/attendance/staff/day?${query({ date })}`),
  saveStaffDay: (date: string, body: Schemas["StaffDayRequest"]) =>
    api<StaffDay>(`/attendance/staff/day?${query({ date })}`, { method: "PUT", body }),
  staffMonth: (month: string) => api<Schemas["StaffMonthRow"][]>(`/attendance/staff/month?${query({ month })}`),
  approveMonth: (body: Schemas["MonthApproveRequest"]) =>
    api<Schemas["StaffMonthRow"][]>("/attendance/staff/month/approve", { method: "POST", body }),
  reopenMonth: (body: Schemas["MonthReopenRequest"]) =>
    api<Schemas["StaffMonthRow"][]>("/attendance/staff/month/reopen", { method: "POST", body }),
};
