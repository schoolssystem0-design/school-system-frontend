"use client";

import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiBlob, errorMessage, openBlob } from "@/lib/api/client";
import { P } from "@/lib/permissions";
import { useCan } from "@/features/people/shared";
import { XLSX_TYPE } from "./export-bar";

/** Student records and class lists: for whoever may print student records or view reports. */
export function useCanDownloadRecords() {
  const can = useCan();
  return can(P.STUDENTS_PRINT) || can(P.REPORTS_VIEW);
}

/** A button that downloads one report as PDF or Excel (for the academic year selected at the top). */
export function DownloadMenu({ label, path, fileName }: { label: string; path: string; fileName: string }) {
  const save = useMutation({
    mutationFn: async (format: "pdf" | "xlsx") => {
      const blob = await apiBlob(`${path}${path.includes("?") ? "&" : "?"}format=${format}`, {}, format === "pdf" ? "application/pdf" : XLSX_TYPE);
      openBlob(blob, `${fileName}.${format}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={save.isPending} />}>
        <Download aria-hidden /> {save.isPending ? "Preparing…" : label} <ChevronDown className="opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => save.mutate("pdf")}>
          <FileText aria-hidden /> PDF (print or share)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => save.mutate("xlsx")}>
          <FileSpreadsheet aria-hidden /> Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One student's whole year: details, family, classes, attendance, marks, results and fees. */
export function StudentRecordDownload({ studentId, grNo }: { studentId: number; grNo?: string }) {
  return (
    <DownloadMenu
      label="Full record"
      path={`/reports/student-record/file?studentId=${studentId}`}
      fileName={`student-record-${grNo ?? studentId}`}
    />
  );
}

/** The students of a section (or of a whole class when no section is chosen). */
export function ClassListDownload({ classId, sectionId }: { classId?: number | ""; sectionId?: number | "" }) {
  const target = sectionId ? `sectionId=${sectionId}` : classId ? `classId=${classId}` : null;
  if (!target) return null;
  return <DownloadMenu label="Class list" path={`/reports/class-list/file?${target}`} fileName="class-list" />;
}
