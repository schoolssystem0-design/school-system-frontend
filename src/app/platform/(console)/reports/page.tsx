import type { Metadata } from "next";
import { PlatformReportsPage } from "@/features/platform/platform-pages";

export const metadata: Metadata = { title: "All-schools report" };

export default function Route() {
  return <PlatformReportsPage />;
}
