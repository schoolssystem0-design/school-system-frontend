import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { StudentProfile } from "@/features/students/student-profile";

export const metadata: Metadata = { title: "Student" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <StudentProfile />
    </Suspense>
  );
}
