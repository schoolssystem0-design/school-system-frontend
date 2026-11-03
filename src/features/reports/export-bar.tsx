"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiBlob, errorMessage, openBlob, type Schemas } from "@/lib/api/client";
import { useYear } from "@/features/shell/year-context";

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Print-only heading text for a control: "Section: Class 5 - A". */
function filterText(field: HTMLInputElement | HTMLSelectElement) {
  if (field instanceof HTMLSelectElement) return field.selectedOptions[0]?.text ?? "";
  return field.value;
}

/** The labelled filters and the visible tables on the page, exactly as the user sees them (FR 15.5, 15.6). */
function readPage(year: string | undefined): Pick<Schemas["TableExportRequest"], "filters" | "tables"> {
  const main = document.getElementById("main");
  if (!main) return { filters: [], tables: [] };
  const filters = year ? [`Academic Year ${year}`] : [];
  main.querySelectorAll("label[for]").forEach((label) => {
    const field = document.getElementById(label.getAttribute("for") ?? "");
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement) || field.offsetParent === null) return;
    if (field.closest("table") || field.type === "checkbox") return;
    const value = filterText(field);
    if (value) filters.push(`${label.textContent?.trim()}: ${value}`);
  });
  const tables = Array.from(main.querySelectorAll("table"))
    .filter((table) => table.offsetParent !== null)
    .map((table) => {
      const heads = Array.from(table.querySelectorAll("thead th"));
      // Columns that only hold buttons have a screen-reader-only heading
      const keep = heads.map((th) => !th.classList.contains("sr-only") && Boolean(th.textContent?.trim()));
      const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
        Array.from(tr.querySelectorAll("td"))
          .filter((_, i) => keep[i] !== false)
          .map((td) => {
            const copy = td.cloneNode(true) as HTMLElement;
            copy.querySelectorAll("button, .sr-only").forEach((n) => n.remove());
            return (copy.textContent ?? "").trim().replace(/\s+/g, " ");
          }),
      );
      return {
        title: table.closest('[data-slot="card"]')?.querySelector('[data-slot="card-title"]')?.textContent?.trim(),
        columns: heads.filter((_, i) => keep[i]).map((th) => th.textContent?.trim() ?? ""),
        rows,
      };
    });
  return { filters, tables };
}

/** Excel, PDF and Print for whatever tables the page is showing. */
export function ExportBar({ title }: { title: string }) {
  const { selected } = useYear();
  const save = useMutation({
    mutationFn: async (format: "xlsx" | "pdf") => {
      const page = readPage(selected?.name);
      if ((page.tables ?? []).length === 0) throw new Error("There is no table on the page to export");
      const body: Schemas["TableExportRequest"] = { title, ...page };
      const blob = await apiBlob(`/reports/tables/file?format=${format}`, { method: "POST", body }, format === "pdf" ? "application/pdf" : XLSX_TYPE);
      openBlob(blob, `${title}.${format}`);
    },
    onError: (e: unknown) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex flex-wrap gap-2 print:hidden" role="group" aria-label="Export this page">
      <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate("xlsx")}>
        <Download className="size-4" aria-hidden /> Excel
      </Button>
      <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate("pdf")}>
        <Download className="size-4" aria-hidden /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden /> Print
      </Button>
    </div>
  );
}
