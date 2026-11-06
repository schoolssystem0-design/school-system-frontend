import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/app/data-state";
import { MessagesPage } from "@/features/office/messages-page";

export const metadata: Metadata = { title: "Messages" };

export default function Route() {
  return (
    // MessagesPage reads ?tab= (the dashboard links straight to the SMS phone tab)
    <Suspense fallback={<Loading />}>
      <MessagesPage />
    </Suspense>
  );
}
