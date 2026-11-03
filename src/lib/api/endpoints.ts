import { api, type Schemas } from "./client";

/** Typed calls for the Phase 1 modules. Types come from the backend's OpenAPI document (npm run gen:api). */

// ------------------------------------------------------------------ school
export type Profile = Schemas["Profile"];
export type Year = Schemas["YearView"];
export type DayOff = Schemas["DayOffView"];
export type DayType = "FULL" | "HALF" | "OFF";
export type WorkingWeek = Record<string, DayType>;

export const school = {
  profile: () => api<Profile>("/school/profile"),
  saveProfile: (body: Schemas["ProfileRequest"]) => api<Profile>("/school/profile", { method: "PUT", body }),
  years: () => api<Year[]>("/school/years"),
  createYear: (body: Schemas["YearRequest"]) => api<Year>("/school/years", { method: "POST", body }),
  updateYear: (id: number, body: Schemas["YearRequest"]) =>
    api<Year>(`/school/years/${id}`, { method: "PATCH", body }),
  makeCurrent: (id: number) => api<Year>(`/school/years/${id}/make-current`, { method: "POST" }),
  week: (yearId: number) => api<WorkingWeek>(`/school/years/${yearId}/working-days`),
  saveWeek: (yearId: number, week: WorkingWeek) =>
    api<WorkingWeek>(`/school/years/${yearId}/working-days`, { method: "PUT", body: week }),
  daysOff: (yearId: number) => api<DayOff[]>(`/school/years/${yearId}/days-off`),
  addDayOff: (yearId: number, body: Schemas["DayOffRequest"]) =>
    api<DayOff>(`/school/years/${yearId}/days-off`, { method: "POST", body }),
  removeDayOff: (id: number) => api<void>(`/school/days-off/${id}`, { method: "DELETE" }),
  upload: (purpose: string, file: File) => {
    const form = new FormData();
    form.append("purpose", purpose);
    form.append("file", file);
    return api<Schemas["FileInfo"]>("/files", { method: "POST", form });
  },
};

// --------------------------------------------------------------------- iam
export type User = Schemas["UserView"];
export type Role = Schemas["RoleView"];
export type PermissionDefinition = Schemas["Definition"];
export type Page<T> = { items: T[]; page: number; size: number; totalItems: number; totalPages: number };

export const iam = {
  users: (params: { q?: string; status?: string; page?: number }) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.status) search.set("status", params.status);
    search.set("page", String(params.page ?? 0));
    return api<Page<User>>(`/iam/users?${search}`);
  },
  createUser: (body: Schemas["CreateUserRequest"]) =>
    api<Schemas["TemporaryPassword"]>("/iam/users", { method: "POST", body }),
  updateUser: (id: number, body: Schemas["UpdateUserRequest"]) =>
    api<User>(`/iam/users/${id}`, { method: "PATCH", body }),
  deactivate: (id: number, reason: string) =>
    api<User>(`/iam/users/${id}/deactivate`, { method: "POST", body: { reason } }),
  activate: (id: number, reason: string) =>
    api<User>(`/iam/users/${id}/activate`, { method: "POST", body: { reason } }),
  unlock: (id: number) => api<User>(`/iam/users/${id}/unlock`, { method: "POST" }),
  resetPassword: (id: number) =>
    api<Schemas["TemporaryPassword"]>(`/iam/users/${id}/reset-password`, { method: "POST" }),
  roles: () => api<Role[]>("/iam/roles"),
  permissions: () => api<PermissionDefinition[]>("/iam/permissions"),
  createRole: (body: Schemas["CreateRoleRequest"]) => api<Role>("/iam/roles", { method: "POST", body }),
  updateRole: (id: number, body: Schemas["UpdateRoleRequest"]) =>
    api<Role>(`/iam/roles/${id}`, { method: "PUT", body }),
  deleteRole: (id: number) => api<void>(`/iam/roles/${id}`, { method: "DELETE" }),
  logins: (params: Record<string, string>) =>
    api<Page<Schemas["LoginRow"]>>(`/iam/login-history?${new URLSearchParams(params)}`),
  activity: (params: Record<string, string>) =>
    api<Page<Schemas["AuditRow"]>>(`/audit?${new URLSearchParams(params)}`),
};

// ---------------------------------------------------------------- settings
export type Setting = Schemas["SettingView"];

export const settings = {
  list: () => api<Setting[]>("/settings"),
  history: (key: string) => api<Schemas["HistoryEntry"][]>(`/settings/${key}/history`),
  change: (key: string, value: unknown, reason: string) =>
    api<Setting>(`/settings/${key}`, { method: "PUT", body: { value, reason } }),
};

// --------------------------------------------------------------- academics
export type SchoolClass = Schemas["ClassView"];
export type Subject = Schemas["SubjectView"];
export type ClassSubject = Schemas["ClassSubjectView"];

export const academics = {
  classes: () => api<SchoolClass[]>("/academics/classes"),
  createClass: (body: Schemas["ClassRequest"]) => api<SchoolClass>("/academics/classes", { method: "POST", body }),
  updateClass: (id: number, body: Schemas["ClassRequest"]) =>
    api<SchoolClass>(`/academics/classes/${id}`, { method: "PATCH", body }),
  reorder: (classIds: number[]) =>
    api<SchoolClass[]>("/academics/classes/order", { method: "PUT", body: { classIds } }),
  classStatus: (id: number, status: "ACTIVE" | "INACTIVE") =>
    api<SchoolClass>(`/academics/classes/${id}/status`, { method: "POST", body: { status } }),
  deleteClass: (id: number) => api<void>(`/academics/classes/${id}`, { method: "DELETE" }),
  createSection: (classId: number, name: string) =>
    api<Schemas["SectionView"]>(`/academics/classes/${classId}/sections`, { method: "POST", body: { name } }),
  renameSection: (id: number, name: string, version: number) =>
    api<Schemas["SectionView"]>(`/academics/sections/${id}`, { method: "PATCH", body: { name, version } }),
  sectionStatus: (id: number, status: "ACTIVE" | "INACTIVE") =>
    api<Schemas["SectionView"]>(`/academics/sections/${id}/status`, { method: "POST", body: { status } }),
  deleteSection: (id: number) => api<void>(`/academics/sections/${id}`, { method: "DELETE" }),
  subjects: () => api<Subject[]>("/academics/subjects"),
  createSubject: (name: string, shortName?: string) =>
    api<Subject>("/academics/subjects", { method: "POST", body: { name, shortName } }),
  updateSubject: (id: number, name: string, shortName: string, version: number) =>
    api<Subject>(`/academics/subjects/${id}`, { method: "PATCH", body: { name, shortName, version } }),
  subjectStatus: (id: number, status: "ACTIVE" | "INACTIVE") =>
    api<Subject>(`/academics/subjects/${id}/status`, { method: "POST", body: { status } }),
  deleteSubject: (id: number) => api<void>(`/academics/subjects/${id}`, { method: "DELETE" }),
  classSubjects: (yearId: number, classId: number) =>
    api<ClassSubject[]>(`/academics/years/${yearId}/classes/${classId}/subjects`),
  saveClassSubjects: (yearId: number, classId: number, body: Schemas["ClassSubjectRequest"][]) =>
    api<ClassSubject[]>(`/academics/years/${yearId}/classes/${classId}/subjects`, { method: "PUT", body }),
};

// ---------------------------------------------------------------- platform
export type PlatformMe = Schemas["PlatformMe"];
export type SchoolDetail = Schemas["SchoolView"];

export const platform = {
  login: (email: string, password: string, totpCode: string) =>
    api<Schemas["PlatformLoginResponse"]>("/platform/auth/login", {
      method: "POST",
      body: { email, password, totpCode },
    }),
  enrol: (code: string) =>
    api<Schemas["PlatformLoginResponse"]>("/platform/auth/totp/enroll", { method: "POST", body: { code } }),
  me: () => api<PlatformMe>("/platform/auth/me"),
  overview: () => api<Schemas["Overview"]>("/platform/overview"),
  audit: (page = 0) => api<Page<Schemas["PlatformAuditRow"]>>(`/platform/audit?page=${page}`),
  schools: () => api<SchoolDetail[]>("/platform/schools"),
  school: (id: number) => api<SchoolDetail>(`/platform/schools/${id}`),
  createSchool: (body: Schemas["CreateSchoolRequest"]) =>
    api<Schemas["SchoolCreated"]>("/platform/schools", { method: "POST", body }),
  rename: (id: number, name: string) => api<SchoolDetail>(`/platform/schools/${id}`, { method: "PATCH", body: { name } }),
  suspend: (id: number, reason: string) =>
    api<SchoolDetail>(`/platform/schools/${id}/suspend`, { method: "POST", body: { reason } }),
  reactivate: (id: number) => api<SchoolDetail>(`/platform/schools/${id}/reactivate`, { method: "POST" }),
  addDomain: (id: number, host: string) =>
    api<SchoolDetail>(`/platform/schools/${id}/domains`, { method: "POST", body: { host, primary: false } }),
  removeDomain: (id: number, domainId: number) =>
    api<SchoolDetail>(`/platform/schools/${id}/domains/${domainId}`, { method: "DELETE" }),
  users: (id: number) => api<Record<string, unknown>[]>(`/platform/schools/${id}/users`),
  setupLink: (schoolId: number, userId: number) =>
    api<Schemas["SetupLink"]>(`/platform/schools/${schoolId}/users/${userId}/setup-link`, { method: "POST" }),
  openSchool: (schoolId: number) => api<PlatformMe>(`/platform/active-school/${schoolId}`, { method: "POST" }),
  leaveSchool: () => api<PlatformMe>("/platform/active-school", { method: "DELETE" }),
};
