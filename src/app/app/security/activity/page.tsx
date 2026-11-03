import type { Metadata } from "next";
import { ActivityPage } from "@/features/iam/security-logs";

export const metadata: Metadata = { title: "Activity history" };

export default function ActivityRoute() {
  return <ActivityPage />;
}
