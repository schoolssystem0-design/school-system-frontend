import { ShieldCheck, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { API_BASE_URL } from "@/lib/api/client";

type VerifyResult = {
  genuine?: boolean;
  schoolName?: string;
  documentTitle?: string;
  issuedOn?: string;
  message?: string;
  subjectLine?: string;
};

export const metadata: Metadata = { title: "Document verification" };

/** Public lookup by token; must not be prerendered at build time. */
export const instant = false;

export default async function VerifyDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let result: VerifyResult | null = null;
  try {
    const response = await fetch(`${API_BASE_URL}/public/verify/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (response.ok) {
      result = (await response.json()) as VerifyResult;
    }
  } catch {
    result = null;
  }

  const genuine = result?.genuine === true;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 px-4 py-12">
      <div
        className={`rounded-xl border p-8 shadow-sm ${genuine ? "border-emerald-200 bg-emerald-50/80" : "border-destructive/30 bg-destructive/5"}`}
      >
        <div className="mb-4 flex items-center gap-3">
          {genuine ? (
            <ShieldCheck className="size-10 text-emerald-700" aria-hidden />
          ) : (
            <ShieldX className="size-10 text-destructive" aria-hidden />
          )}
          <h1 className="text-xl font-semibold">{genuine ? "Genuine document" : "Not recognised"}</h1>
        </div>
        {genuine ? (
          <>
            <p className="text-lg leading-relaxed">{result?.message}</p>
            {result?.documentTitle && (
              <p className="mt-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{result.documentTitle}</span>
                {result.subjectLine ? ` · ${result.subjectLine}` : null}
                {result.issuedOn ? ` · Issued ${result.issuedOn}` : null}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            {result?.message ?? "This QR code is invalid or the document was not issued through Tirvex School Management."}
          </p>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Anyone can scan the QR on a certificate, report card or fee receipt to confirm it was issued by the school.
      </p>
    </main>
  );
}