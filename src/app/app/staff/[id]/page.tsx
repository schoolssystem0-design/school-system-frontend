import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { StaffProfile } from "@/features/staff/staff-profile";

export const metadata: Metadata = { title: "Staff member" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <StaffProfile />
    </Suspense>
  );
}
