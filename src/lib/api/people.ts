import { api, apiBlob, type Schemas } from "./client";
import type { Page } from "./endpoints";

/** Typed calls for the Phase 2 modules: admissions, students, families, staff, teaching and year rollover. */

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

// -------------------------------------------------------------- admissions
export type EnquiryRow = Schemas["EnquiryRow"];
export type Enquiry = Schemas["EnquiryView"];
export type EnquiryStatus = Schemas["EnquiryStatus"];

export const admissions = {
  enquiries: (params: { q?: string; statusId?: number; classId?: number; from?: string; to?: string; page?: number }) =>
    api<Page<EnquiryRow>>(`/admissions/enquiries?${query({ ...params, page: params.page ?? 0 })}`),
  enquiry: (id: number) => api<Enquiry>(`/admissions/enquiries/${id}`),
  create: (body: Schemas["EnquiryRequest"]) => api<Enquiry>("/admissions/enquiries", { method: "POST", body }),
  update: (id: number, body: Schemas["EnquiryRequest"]) =>
    api<Enquiry>(`/admissions/enquiries/${id}`, { method: "PATCH", body }),
  setStatus: (id: number, body: Schemas["EnquiryStatusRequest"]) =>
    api<Enquiry>(`/admissions/enquiries/${id}/status`, { method: "POST", body }),
  saveTest: (id: number, body: Schemas["TestRequest"]) =>
    api<Enquiry>(`/admissions/enquiries/${id}/test`, { method: "PUT", body }),
  remarks: (id: number) => api<Schemas["Remark"][]>(`/admissions/enquiries/${id}/remarks`),
  addRemark: (id: number, text: string) =>
    api<Schemas["Remark"]>(`/admissions/enquiries/${id}/remarks`, { method: "POST", body: { text } }),
  duplicates: (params: { name?: string; dob?: string; phone?: string; cnic?: string; excludeEnquiryId?: number }) =>
    api<Schemas["Match"][]>(`/admissions/duplicates?${query(params)}`),
  enrol: (id: number, body: Schemas["EnrolRequest"]) =>
    api<Student>(`/admissions/enquiries/${id}/enrol`, { method: "POST", body }),
  statuses: () => api<EnquiryStatus[]>("/admissions/statuses"),
  createStatus: (body: Schemas["StatusDefinition"]) =>
    api<EnquiryStatus>("/admissions/statuses", { method: "POST", body }),
  updateStatus: (id: number, body: Schemas["StatusDefinition"]) =>
    api<EnquiryStatus>(`/admissions/statuses/${id}`, { method: "PATCH", body }),
  content: () => api<Schemas["AdmissionContent"][]>("/admissions/content"),
  saveContent: (body: Schemas["ContentRequest"]) => api<void>("/admissions/content", { method: "PUT", body }),
  form: (params: { enquiryId?: number; classId?: number }) => apiBlob(`/admissions/form?${query(params)}`),
};

// ---------------------------------------------------------------- students
export type StudentRow = Schemas["StudentRow"];
export type Student = Schemas["StudentView"];
export type StudentCertificateType = "LEAVING" | "DATE_OF_BIRTH" | "CHARACTER" | "APPRECIATION" | "PROVISIONAL" | "HOPE";

export const students = {
  list: (params: {
    q?: string;
    classId?: number;
    sectionId?: number;
    familyId?: number;
    status?: string;
    page?: number;
    size?: number;
  }) => api<Page<StudentRow>>(`/students?${query({ ...params, page: params.page ?? 0 })}`),
  get: (id: number) => api<Student>(`/students/${id}`),
  admit: (body: Schemas["AdmitRequest"]) => api<Student>("/students", { method: "POST", body }),
  update: (id: number, body: Schemas["UpdateRequest"]) => api<Student>(`/students/${id}`, { method: "PATCH", body }),
  suggestGr: () => api<{ grNo: string }>("/students/suggest-gr"),
  strength: () => api<Schemas["Strength"][]>("/students/strength"),
  register: (from: string, to: string) => api<Schemas["RegisterRow"][]>(`/students/register?${query({ from, to })}`),
  enrolments: (id: number) => api<Schemas["Enrolment"][]>(`/students/${id}/enrolments`),
  changeFamily: (id: number, familyId: number) =>
    api<Student>(`/students/${id}/family`, { method: "PUT", body: { familyId } }),
  move: (id: number, body: Schemas["MoveRequest"]) => api<Student>(`/students/${id}/move`, { method: "POST", body }),
  withdraw: (id: number, body: Schemas["WithdrawRequest"]) =>
    api<Student>(`/students/${id}/withdraw`, { method: "POST", body }),
  readmit: (id: number, body: Schemas["ReadmitRequest"]) =>
    api<Student>(`/students/${id}/readmit`, { method: "POST", body }),
  contacts: (id: number) => api<Schemas["ContactView"][]>(`/students/${id}/contacts`),
  addContact: (id: number, body: Schemas["ContactRequest"]) =>
    api<Schemas["ContactView"]>(`/students/${id}/contacts`, { method: "POST", body }),
  removeContact: (id: number, contactId: number) =>
    api<void>(`/students/${id}/contacts/${contactId}`, { method: "DELETE" }),
  documents: (id: number) => api<Schemas["StudentDocumentView"][]>(`/students/${id}/documents`),
  addDocument: (id: number, body: Schemas["StudentDocumentRequest"]) =>
    api<Schemas["StudentDocumentView"]>(`/students/${id}/documents`, { method: "POST", body }),
  removeDocument: (id: number, documentId: number) =>
    api<void>(`/students/${id}/documents/${documentId}`, { method: "DELETE" }),
  groups: () => api<Schemas["GroupView"][]>("/students/activity-groups"),
  createGroup: (body: Schemas["GroupRequest"]) =>
    api<Schemas["GroupView"]>("/students/activity-groups", { method: "POST", body }),
  activities: (id: number) => api<Schemas["ActivityView"][]>(`/students/${id}/activities`),
  addActivity: (id: number, body: Schemas["ActivityRequest"]) =>
    api<Schemas["ActivityView"]>(`/students/${id}/activities`, { method: "POST", body }),
  removeActivity: (id: number, activityId: number) =>
    api<void>(`/students/${id}/activities/${activityId}`, { method: "DELETE" }),
  certificates: (id: number) => api<Schemas["CertificateEntry"][]>(`/students/${id}/certificates`),
  issueCertificate: (id: number, type: StudentCertificateType, body: Schemas["StudentCertificateRequest"]) =>
    apiBlob(`/students/${id}/certificates/${type}`, { method: "POST", body }),
  bioData: (id: number) => apiBlob(`/students/${id}/bio-data`),
  idCards: (body: Schemas["IdCardRequest"]) => apiBlob("/students/id-cards", { method: "POST", body }),
  bulk: (body: Schemas["StudentBulkRequest"]) => api<{ updated: number }>("/students/bulk", { method: "PUT", body }),
  promotionPreview: (fromYearId: number, toYearId: number, classId: number) =>
    api<Schemas["Preview"]>(`/students/promotion/preview?${query({ fromYearId, toYearId, classId })}`),
  promote: (body: Schemas["PromotionRequest"]) =>
    api<Schemas["PromotionResult"]>("/students/promotion", { method: "POST", body }),
};

// ---------------------------------------------------------------- families
export type FamilyRow = Schemas["FamilyRow"];
export type Family = Schemas["FamilyView"];

export const families = {
  list: (params: { q?: string; page?: number }) =>
    api<Page<FamilyRow>>(`/families?${query({ ...params, page: params.page ?? 0 })}`),
  get: (id: number) => api<Family>(`/families/${id}`),
  create: (body: Schemas["FamilyRequest"]) => api<Family>("/families", { method: "POST", body }),
  update: (id: number, body: Schemas["FamilyRequest"]) => api<Family>(`/families/${id}`, { method: "PATCH", body }),
  bulk: (body: Schemas["FamilyBulkRequest"]) => api<{ updated: number }>("/families/bulk", { method: "PUT", body }),
  dataIssues: () => api<Schemas["DataIssue"][]>("/families/data-issues"),
};

// ------------------------------------------------------------------- staff
export type StaffRow = Schemas["StaffRow"];
export type StaffMember = Schemas["StaffView"];

export const staff = {
  list: (params: { q?: string; category?: string; status?: string; page?: number; size?: number }) =>
    api<Page<StaffRow>>(`/staff?${query({ ...params, page: params.page ?? 0 })}`),
  get: (id: number) => api<StaffMember>(`/staff/${id}`),
  create: (body: Schemas["StaffRequest"]) => api<StaffMember>("/staff", { method: "POST", body }),
  update: (id: number, body: Schemas["StaffRequest"]) => api<StaffMember>(`/staff/${id}`, { method: "PATCH", body }),
  leave: (id: number, body: Schemas["LeaveRequest"]) =>
    api<StaffMember>(`/staff/${id}/leave`, { method: "POST", body }),
  rejoin: (id: number) => api<StaffMember>(`/staff/${id}/rejoin`, { method: "POST" }),
  createLogin: (id: number, body: Schemas["StaffLoginRequest"]) =>
    api<Schemas["NewLogin"]>(`/staff/${id}/login`, { method: "POST", body }),
  documents: (id: number) => api<Schemas["StaffDocumentView"][]>(`/staff/${id}/documents`),
  addDocument: (id: number, body: Schemas["StaffDocumentRequest"]) =>
    api<Schemas["StaffDocumentView"]>(`/staff/${id}/documents`, { method: "POST", body }),
  removeDocument: (id: number, documentId: number) =>
    api<void>(`/staff/${id}/documents/${documentId}`, { method: "DELETE" }),
  salary: (id: number) => api<Schemas["SalaryEntry"][]>(`/staff/${id}/salary`),
  addSalary: (id: number, body: Schemas["SalaryRequest"]) =>
    api<Schemas["SalaryEntry"]>(`/staff/${id}/salary`, { method: "POST", body }),
  certificates: (id: number) => api<Schemas["CertificateEntry"][]>(`/staff/${id}/certificates`),
  experienceCertificate: (id: number, remarks?: string) =>
    apiBlob(`/staff/${id}/certificates/experience`, { method: "POST", body: { remarks } }),
};

// ---------------------------------------------------------------- teaching
export type Assignment = Schemas["AssignmentView"];
export type Period = Schemas["PeriodView"];

export const teaching = {
  assignments: (yearId: number, params: { sectionId?: number; staffId?: number; currentOnly?: boolean } = {}) =>
    api<Assignment[]>(`/academics/years/${yearId}/assignments?${query(params)}`),
  assign: (yearId: number, body: Schemas["AssignRequest"]) =>
    api<Assignment>(`/academics/years/${yearId}/assignments`, { method: "POST", body }),
  end: (yearId: number, assignmentId: number, effectiveTo?: string) =>
    api<void>(`/academics/years/${yearId}/assignments/${assignmentId}/end`, {
      method: "POST",
      body: { effectiveTo },
    }),
  handover: (yearId: number, body: Schemas["HandoverRequest"]) =>
    api<{ moved: number }>(`/academics/years/${yearId}/assignments/handover`, { method: "POST", body }),
  timetable: (yearId: number, params: { sectionId?: number; staffId?: number }) =>
    api<Period[]>(`/academics/years/${yearId}/timetable?${query(params)}`),
  saveTimetable: (yearId: number, sectionId: number, body: Schemas["PeriodRequest"][]) =>
    api<Period[]>(`/academics/years/${yearId}/sections/${sectionId}/timetable`, { method: "PUT", body }),
};

// ---------------------------------------------------------------- rollover
export const rollover = {
  options: () => api<Schemas["Option"][]>("/school/rollover/options"),
  run: (toYearId: number, body: Schemas["RolloverRequest"]) =>
    api<Schemas["RolloverResult"]>(`/school/years/${toYearId}/rollover`, { method: "POST", body }),
};
