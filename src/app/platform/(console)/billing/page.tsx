import type { Metadata } from "next";
import { BillingPage } from "@/features/platform/billing";

export const metadata: Metadata = { title: "Billing" };

export default function PlatformBillingRoute() {
  return <BillingPage />;
}
