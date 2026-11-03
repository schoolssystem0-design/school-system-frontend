import type { Metadata } from "next";
import { LoginHistoryPage } from "@/features/iam/security-logs";

export const metadata: Metadata = { title: "Login history" };

export default function LoginHistoryRoute() {
  return <LoginHistoryPage />;
}
