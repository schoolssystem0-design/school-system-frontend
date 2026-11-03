import { api, type Schemas } from "./client";

/** Typed calls for Phase 7: dashboard, office tools and messages. */

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

export type Dashboard = Schemas["Dashboard"];
export type Task = Schemas["TaskView"];
export type Complaint = Schemas["ComplaintView"];
export type SchoolEvent = Schemas["EventView"];
export type Template = Schemas["TemplateView"];
export type MessageRequest = Schemas["MessageRequest"];

export const EVENT_TYPES = [
  { value: "EVENT", label: "School event" },
  { value: "HOLIDAY", label: "Public holiday" },
  { value: "EXAM", label: "Examination" },
  { value: "OTHER", label: "Other" },
] as const;

export const dashboard = {
  get: (reveal: boolean) => api<Dashboard>(`/dashboard?${query({ reveal })}`),
  saveFavourites: (pages: Schemas["Favourite"][]) =>
    api<Schemas["Favourite"][]>("/dashboard/favourites", { method: "PUT", body: { pages } }),
};

export const office = {
  colleagues: () => api<Schemas["Colleague"][]>("/office/colleagues"),

  tasks: (includeDone: boolean) => api<Task[]>(`/office/tasks?${query({ includeDone })}`),
  createTask: (body: Schemas["TaskRequest"]) => api<Task>("/office/tasks", { method: "POST", body }),
  completeTask: (id: number) => api<Task>(`/office/tasks/${id}/complete`, { method: "POST", body: {} }),
  reopenTask: (id: number) => api<Task>(`/office/tasks/${id}/reopen`, { method: "POST", body: {} }),

  complaints: (status?: string) => api<Complaint[]>(`/office/complaints?${query({ status })}`),
  complaint: (id: number) => api<Complaint>(`/office/complaints/${id}`),
  openComplaint: (body: Schemas["ComplaintRequest"]) => api<Complaint>("/office/complaints", { method: "POST", body }),
  complaintRemark: (id: number, text: string) =>
    api<Complaint>(`/office/complaints/${id}/remarks`, { method: "POST", body: { text } }),
  assignComplaint: (id: number, userId: number | null) =>
    api<Complaint>(`/office/complaints/${id}/assign`, { method: "POST", body: { userId: userId ?? undefined } }),
  closeComplaint: (id: number, text: string) =>
    api<Complaint>(`/office/complaints/${id}/close`, { method: "POST", body: { text } }),
  reopenComplaint: (id: number, text: string) =>
    api<Complaint>(`/office/complaints/${id}/reopen`, { method: "POST", body: { text } }),

  circulars: () => api<Schemas["CircularView"][]>("/office/circulars"),
  postCircular: (body: Schemas["CircularRequest"]) => api<Schemas["CircularView"]>("/office/circulars", { method: "POST", body }),
  removeCircular: (id: number) => api<void>(`/office/circulars/${id}`, { method: "DELETE" }),

  events: (from: string, to: string) => api<SchoolEvent[]>(`/office/events?${query({ from, to })}`),
  addEvent: (body: Schemas["EventRequest"]) => api<SchoolEvent>("/office/events", { method: "POST", body }),
  removeEvent: (id: number) => api<void>(`/office/events/${id}`, { method: "DELETE" }),

  visitors: (date: string) => api<Schemas["VisitorView"][]>(`/office/visitors?${query({ date })}`),
  addVisitor: (body: Schemas["VisitorRequest"]) => api<Schemas["VisitorView"]>("/office/visitors", { method: "POST", body }),

  birthdays: (days: number) => api<Schemas["BirthdayRow"][]>(`/office/birthdays?${query({ days })}`),
  wish: (personType: string, id: number) =>
    api<Schemas["WishResult"]>(`/office/birthdays/${personType}/${id}/wish`, { method: "POST", body: {} }),
};

export const messages = {
  preview: (body: MessageRequest) => api<Schemas["SendPreview"]>("/communication/preview", { method: "POST", body }),
  send: (body: MessageRequest, idempotencyKey: string) =>
    api<Schemas["SendReport"]>("/communication/send", { method: "POST", body, headers: { "Idempotency-Key": idempotencyKey } }),
  welcome: (studentId: number) => api<Schemas["WelcomeResult"]>(`/communication/welcome/${studentId}`, { method: "POST", body: {} }),
  log: (params: { purpose?: string; status?: string }) => api<Schemas["DeliveryLog"]>(`/communication/log?${query(params)}`),
  retry: (id: number) => api<void>(`/communication/messages/${id}/retry`, { method: "POST", body: {} }),
  templates: () => api<Template[]>("/communication/templates"),
  saveTemplate: (code: string, body: string) => api<Template>(`/communication/templates/${code}`, { method: "PUT", body: { body } }),
  resetTemplate: (code: string) => api<Template>(`/communication/templates/${code}`, { method: "DELETE" }),
};
