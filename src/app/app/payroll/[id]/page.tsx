import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { SheetPage } from "@/features/payroll/payroll-page";

export const metadata: Metadata = { title: "Salary sheet" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <SheetPage />
    </Suspense>
  );
}
