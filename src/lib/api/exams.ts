import { api, apiBlob, type Schemas } from "./client";

/** Typed calls for Phase 6 examinations and results (FR 14). Marks and percentages are strings, as sent by the API. */

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

export type Exam = Schemas["ExamView"];
export type ExamClass = Schemas["ExamClassView"];
export type ExamClassRow = Schemas["ExamClassRow"];
export type Paper = Schemas["PaperView"];
export type Scale = Schemas["ScaleView"];
export type MarkGrid = Schemas["MarkGrid"];
export type ClassResults = Schemas["ClassResults"];
export type StudentResult = Schemas["StudentResult"];

export const RESULT_STATUS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-foreground" },
  REVIEWED: { label: "Reviewed", className: "bg-sky-100 text-sky-900" },
  PUBLISHED: { label: "Published", className: "bg-emerald-100 text-emerald-900" },
};

const cls = (id: number) => `/exams/classes/${id}`;

export const exams = {
  list: () => api<Exam[]>("/exams"),
  get: (id: number) => api<Exam>(`/exams/${id}`),
  create: (body: Schemas["ExamRequest"]) => api<Exam>("/exams", { method: "POST", body }),
  update: (id: number, body: Schemas["ExamRequest"]) => api<Exam>(`/exams/${id}`, { method: "PUT", body }),
  addClasses: (id: number, classIds: number[]) =>
    api<Exam>(`/exams/${id}/classes`, { method: "POST", body: { classIds } }),

  scales: () => api<Scale[]>("/exams/grade-scales"),
  saveBands: (id: number, body: Schemas["BandsRequest"]) =>
    api<Scale>(`/exams/grade-scales/${id}`, { method: "PUT", body }),

  examClass: (id: number) => api<ExamClass>(cls(id)),
  savePapers: (id: number, body: Schemas["PapersRequest"]) =>
    api<ExamClass>(`${cls(id)}/papers`, { method: "PUT", body }),

  marks: (id: number, sectionId: number, examSubjectId: number) =>
    api<MarkGrid>(`${cls(id)}/marks?${query({ sectionId, examSubjectId })}`),
  saveMarks: (id: number, sectionId: number, examSubjectId: number, body: Schemas["ExamMarksRequest"]) =>
    api<MarkGrid>(`${cls(id)}/marks?${query({ sectionId, examSubjectId })}`, { method: "PUT", body }),
  missing: (id: number) => api<Schemas["MissingRow"][]>(`${cls(id)}/missing`),

  results: (id: number, params: { sectionId?: number; version?: number } = {}) =>
    api<ClassResults>(`${cls(id)}/results?${query(params)}`),
  versions: (id: number) => api<Schemas["VersionRow"][]>(`${cls(id)}/versions`),
  failed: (id: number) => api<StudentResult[]>(`${cls(id)}/failed`),
  analysis: (id: number) => api<Schemas["Analysis"]>(`${cls(id)}/analysis`),
  cumulative: (classId: number, yearId: number) =>
    api<Schemas["CumulativeRow"][]>(`/exams/cumulative?${query({ classId, yearId })}`),
  studentResults: (studentId: number) => api<Schemas["StudentExamRow"][]>(`/exams/students/${studentId}/results`),
  saveRemarks: (id: number, body: Schemas["ResultRemarksRequest"]) =>
    api<ClassResults>(`${cls(id)}/remarks`, { method: "PUT", body }),

  review: (id: number) => api<ExamClass>(`${cls(id)}/review`, { method: "POST", body: {} }),
  backToDraft: (id: number) => api<ExamClass>(`${cls(id)}/back-to-draft`, { method: "POST", body: {} }),
  publish: (id: number) => api<ExamClass>(`${cls(id)}/publish`, { method: "POST", body: {} }),
  unlock: (id: number, reason: string) => api<ExamClass>(`${cls(id)}/unlock`, { method: "POST", body: { reason } }),

  datesheet: (id: number) => apiBlob(`${cls(id)}/datesheet`),
  datesheetImage: (id: number) => apiBlob(`${cls(id)}/datesheet.png`, {}, "image/png"),
  admitCards: (id: number, params: { sectionId?: number; withholdDefaulters?: boolean }) =>
    apiBlob(`${cls(id)}/admit-cards?${query(params)}`),
  resultSheet: (id: number, sectionId?: number) => apiBlob(`${cls(id)}/result-sheet?${query({ sectionId })}`),
  reportCards: (id: number, params: { sectionId?: number; studentId?: number }) =>
    apiBlob(`${cls(id)}/report-cards?${query(params)}`),

  sendResults: (id: number, body: Schemas["ResultSmsRequest"], idempotencyKey: string) =>
    api<Schemas["ResultSmsReport"]>(`${cls(id)}/send-results`, {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  messages: () => api<Schemas["Queued"][]>("/exams/messages"),
};
