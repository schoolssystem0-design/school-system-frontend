import type { Metadata } from "next";
import { RegisterPage } from "@/features/attendance/register-page";

export const metadata: Metadata = { title: "Take attendance" };

export default function Route() {
  return <RegisterPage />;
}
