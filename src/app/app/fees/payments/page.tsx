import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { PaymentsPage } from "@/features/fees/payments-page";

export const metadata: Metadata = { title: "Payments" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <PaymentsPage />
    </Suspense>
  );
}
