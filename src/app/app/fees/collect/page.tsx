import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { CollectPage } from "@/features/fees/collect-page";

export const metadata: Metadata = { title: "Collect fees" };

export default function Route() {
  return (
    <Suspense fallback={<Loading />}>
      <CollectPage />
    </Suspense>
  );
}
