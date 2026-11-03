import type { Metadata } from "next";
import { Welcome } from "@/features/shell/welcome";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <Welcome />;
}
