import { api, type Schemas } from "./client";

/** Simple test marks and positions (D-51). Marks and percentages are strings, as sent by the API. */

export type ClassTest = Schemas["ClassTestView"];
export type TestSheet = Schemas["TestSheet"];
export type TestMarkRow = Schemas["TestMarkRow"];

export const testMarks = {
  list: (sectionId: number) => api<ClassTest[]>(`/test-marks?sectionId=${sectionId}`),
  create: (body: Schemas["ClassTestRequest"]) => api<TestSheet>("/test-marks", { method: "POST", body }),
  sheet: (id: number) => api<TestSheet>(`/test-marks/${id}`),
  save: (id: number, body: Schemas["TestMarksRequest"]) => api<TestSheet>(`/test-marks/${id}/marks`, { method: "PUT", body }),
  remove: (id: number) => api<void>(`/test-marks/${id}`, { method: "DELETE" }),
  overall: (sectionId: number, from: string, to: string) =>
    api<Schemas["OverallRow"][]>(`/test-marks/overall?${new URLSearchParams({ sectionId: String(sectionId), from, to })}`),
  forStudent: (studentId: number) => api<Schemas["StudentTestRow"][]>(`/test-marks/students/${studentId}`),
};
