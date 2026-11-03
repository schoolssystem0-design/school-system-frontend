import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { FamilyDetail } from "@/features/families/family-detail";

export const metadata: Metadata = { title: "Family" };

export default function FamilyRoute() {
  return (
    <Suspense fallback={<Loading />}>
      <FamilyDetail />
    </Suspense>
  );
}
