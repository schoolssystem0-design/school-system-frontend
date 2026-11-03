import { Suspense } from "react";

/**
 * Public website of a school, reached through the school's own domain (rewritten here by the proxy).
 * Placeholder until Phase 9 (FR 16), when content is loaded per school from the CMS.
 */
export default function SchoolWebsitePage({ params }: PageProps<"/site/[host]/[[...path]]">) {
  return (
    <main className="flex flex-1 items-center justify-center p-6 text-center">
      <Suspense fallback={null}>
        <HostName params={params} />
      </Suspense>
    </main>
  );
}

async function HostName({ params }: { params: PageProps<"/site/[host]/[[...path]]">["params"] }) {
  const { host } = await params;
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">School website</h1>
      <p className="text-muted-foreground">{decodeURIComponent(host)}: coming soon.</p>
    </div>
  );
}
