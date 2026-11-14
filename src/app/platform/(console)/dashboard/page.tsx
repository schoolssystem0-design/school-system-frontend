import type { Metadata } from "next";
import { BusinessDashboardPage } from "@/features/platform/business-dashboard";

export const metadata: Metadata = { title: "Business dashboard" };

export default function PlatformDashboardRoute() {
  return <BusinessDashboardPage />;
}
