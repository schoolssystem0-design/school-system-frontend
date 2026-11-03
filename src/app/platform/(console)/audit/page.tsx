import type { Metadata } from "next";
import { PlatformAuditPage } from "@/features/platform/platform-pages";

export const metadata: Metadata = { title: "Platform audit" };

export default function PlatformAuditRoute() {
  return <PlatformAuditPage />;
}
