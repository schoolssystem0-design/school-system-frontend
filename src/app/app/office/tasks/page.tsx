import type { Metadata } from "next";
import { TasksPage } from "@/features/office/office-pages";

export const metadata: Metadata = { title: "Tasks" };

export default function Route() {
  return <TasksPage />;
}
