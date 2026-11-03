import { api, resetCsrfToken, type Schemas } from "./client";

export type Me = Schemas["MeResponse"];
export type LoginRequest = Schemas["LoginRequest"];

export const meQueryKey = ["auth", "me"] as const;

export const fetchMe = () => api<Me>("/auth/me");

export const login = (request: LoginRequest) => api<Me>("/auth/login", { method: "POST", body: request });

export async function logout() {
  try {
    await api<void>("/auth/logout", { method: "POST" });
  } finally {
    resetCsrfToken();
  }
}

export const changePassword = (currentPassword: string, newPassword: string) =>
  api<void>("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });

export const completeSetup = (token: string, newPassword: string) =>
  api<void>("/auth/setup", { method: "POST", body: { token, newPassword } });

export const requestPasswordReset = (schoolCode: string, username: string) =>
  api<void>("/auth/password-reset/request", { method: "POST", body: { schoolCode, username } });

export const confirmPasswordReset = (token: string, newPassword: string) =>
  api<void>("/auth/password-reset/confirm", { method: "POST", body: { token, newPassword } });

export const requestStepUp = () => api<Schemas["CodeSent"]>("/auth/step-up/request", { method: "POST" });

export const verifyStepUp = (code: string) =>
  api<Schemas["StepUpVerified"]>("/auth/step-up/verify", { method: "POST", body: { code } });
