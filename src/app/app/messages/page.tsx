import type { Metadata } from "next";
import { MessagesPage } from "@/features/office/messages-page";

export const metadata: Metadata = { title: "Messages" };

export default function Route() {
  return <MessagesPage />;
}
