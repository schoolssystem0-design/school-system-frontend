import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { EnquiryDetail } from "@/features/admissions/enquiry-detail";

export const metadata: Metadata = { title: "Enquiry" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <EnquiryDetail />
    </Suspense>
  );
}
