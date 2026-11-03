import type { Metadata } from "next";
import { PlatformOverview } from "@/features/platform/platform-pages";

export const metadata: Metadata = { title: "All schools" };

export default function PlatformOverviewRoute() {
  return <PlatformOverview />;
}
