"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { SecretOnce } from "@/components/app/secret-once";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { meQueryKey } from "@/lib/api/auth";
import { platform } from "@/lib/api/endpoints";
import { formatDate, formatDateTime } from "@/lib/format";
import { SchoolsReport } from "@/features/reports/reports-page";

function useOpenSchool() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schoolId: number) => platform.openSchool(schoolId),
    onSuccess: () => {
      // Drop anything cached from another school before entering this one.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "platform" });
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
      router.push("/app");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function StatusBadge({ status }: { status?: string }) {
  return (
    <Badge variant={status === "ACTIVE" ? "default" : "destructive"}>{status === "ACTIVE" ? "Active" : "Suspended"}</Badge>
  );
}

/** All-schools overview (P-9): every school with its key figures; open any school with full access (P-7). */
/** The all-schools comparison (P-9); Open drills down into a school with full access. */
export function PlatformReportsPage() {
  const open = useOpenSchool();
  return <SchoolsReport onOpen={(id) => open.mutate(id)} opening={open.isPending} />;
}

export function PlatformOverview() {
  const overview = useQuery({ queryKey: ["platform", "overview"], queryFn: platform.overview });
  const open = useOpenSchool();
  if (overview.isPending) return <Loading />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const data = overview.data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="All schools"
        description="Figures grow as modules are added (students, attendance, fees…)."
        actions={
          <Button render={<Link href="/platform/schools/new" />}>
            <Plus aria-hidden /> Add school
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Schools" value={data.schools} />
        <Stat label="Active schools" value={data.activeSchools} />
        <Stat label="User accounts" value={data.users} />
      </div>
      <Card>
        <CardContent className="p-0">
          {(data.rows ?? []).length === 0 ? (
            <div className="p-6">
              <Empty title="No schools yet">Add the first school to get started.</Empty>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current year</TableHead>
                  <TableHead className="text-right">Classes</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.rows ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/platform/schools/${s.id}`} className="underline-offset-4 hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>{s.code}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell>{s.currentYear ?? "—"}</TableCell>
                    <TableCell className="text-right">{s.classes}</TableCell>
                    <TableCell className="text-right">
                      {s.activeUsers}/{s.users}
                    </TableCell>
                    <TableCell>{formatDateTime(s.lastLoginAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => s.id && open.mutate(s.id)} disabled={open.isPending}>
                        Open <ArrowRight aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value ?? 0}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/** Create a school with its main administrator (P-2, P-3). */
export function NewSchoolPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: "", name: "", adminName: "", adminUsername: "admin", adminEmail: "" });
  const [created, setCreated] = useState<Schemas["SchoolCreated"] | null>(null);
  const create = useMutation({
    mutationFn: () => platform.createSchool({ ...form, code: form.code.trim().toUpperCase() }),
    onSuccess: (result) => {
      setCreated(result);
      void queryClient.invalidateQueries({ queryKey: ["platform"] });
    },
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (created) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <PageHeader title={`${created.name} created`} description={`School code ${created.code}`} />
        <SecretOnce
          title={`Setup link for ${created.adminSetup?.username}`}
          value={created.adminSetup?.link ?? ""}
          note={`${created.adminSetup?.emailed ? "Also emailed to the administrator. " : ""}Send it privately; it works once and expires on ${formatDateTime(created.adminSetup?.expiresAt)}. They sign in with school code ${created.code} and username ${created.adminSetup?.username}.`}
        />
        <div className="flex gap-2">
          <Button render={<Link href={`/platform/schools/${created.schoolId}`} />}>View school</Button>
          <Button variant="outline" onClick={() => setCreated(null)}>
            Add another school
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title="Add school" description="Creates the school with its built-in roles and main administrator." />
      <Card>
        <CardContent className="pt-4">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            {create.error && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {errorMessage(create.error)}
              </p>
            )}
            <Field id="s-name" label="School name" className="sm:col-span-2">
              <Input id="s-name" required maxLength={200} value={form.name} onChange={set("name")} placeholder="NNS Secondary School" />
            </Field>
            <Field id="s-code" label="School code" hint="Used at sign-in, e.g. NNS. 2-20 letters, numbers or hyphens.">
              <Input id="s-code" required maxLength={20} value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </Field>
            <div />
            <Field id="s-admin" label="Main administrator's name">
              <Input id="s-admin" required maxLength={200} value={form.adminName} onChange={set("adminName")} />
            </Field>
            <Field id="s-admin-user" label="Their username">
              <Input id="s-admin-user" required maxLength={60} value={form.adminUsername} onChange={set("adminUsername")} />
            </Field>
            <Field id="s-admin-email" label="Their email" hint="For the setup link, verification codes and password resets" className="sm:col-span-2">
              <Input id="s-admin-email" type="email" required maxLength={254} value={form.adminEmail} onChange={set("adminEmail")} />
            </Field>
            <Button type="submit" disabled={create.isPending} className="sm:col-span-2">
              {create.isPending ? "Creating…" : "Create school"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** One school: rename, suspend/reactivate (P-4), website domains (P-6), users and setup links (P-3). */
export function SchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["platform", "school", id], queryFn: () => platform.school(id) });
  const users = useQuery({ queryKey: ["platform", "school", id, "users"], queryFn: () => platform.users(id) });
  const open = useOpenSchool();
  const [suspending, setSuspending] = useState(false);
  const [host, setHost] = useState("");
  const [link, setLink] = useState<Schemas["SetupLink"] | null>(null);
  const update = (s: Schemas["SchoolView"]) => {
    queryClient.setQueryData(["platform", "school", id], s);
    void queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const suspend = useMutation({
    mutationFn: (reason: string) => platform.suspend(id, reason),
    onSuccess: (s) => {
      update(s);
      setSuspending(false);
      toast.success("School suspended. Its users were signed out.");
    },
    onError,
  });
  const reactivate = useMutation({ mutationFn: () => platform.reactivate(id), onSuccess: update, onError });
  const addDomain = useMutation({
    mutationFn: () => platform.addDomain(id, host),
    onSuccess: (s) => {
      update(s);
      setHost("");
    },
    onError,
  });
  const removeDomain = useMutation({ mutationFn: (domainId: number) => platform.removeDomain(id, domainId), onSuccess: update, onError });
  const setupLink = useMutation({ mutationFn: (userId: number) => platform.setupLink(id, userId), onSuccess: setLink, onError });

  if (detail.isPending) return <Loading />;
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  const s = detail.data;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={s.name ?? ""}
        description={`Code ${s.code} · created ${formatDate(s.createdAt)}`}
        actions={
          <>
            <StatusBadge status={s.status} />
            <Button onClick={() => open.mutate(id)} disabled={open.isPending}>
              Open school <ArrowRight aria-hidden />
            </Button>
          </>
        }
      />
      {s.status === "SUSPENDED" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900">Suspended: {s.suspendedReason}</p>
      )}
      {link && (
        <SecretOnce
          title={`New setup link for ${link.username}`}
          value={link.link ?? ""}
          note="Their old sessions were ended. The link works once and expires in 48 hours."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Website domains</CardTitle>
          <CardDescription>The school&apos;s public website is served on these host names.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(s.domains ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{d.host}</span>
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${d.host}`} onClick={() => d.id && removeDomain.mutate(d.id)}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addDomain.mutate();
            }}
          >
            <Field id="d-host" label="Add domain" className="flex-1">
              <Input id="d-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="www.school.edu.pk" required />
            </Field>
            <Button type="submit" variant="outline" disabled={addDomain.isPending}>
              <Plus aria-hidden /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {users.isPending ? (
            <Loading />
          ) : users.isError ? (
            <ErrorState error={users.error} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.map((u) => (
                  <TableRow key={String(u.id)}>
                    <TableCell>
                      {String(u.displayName)}
                      {u.mainAdmin === true && <Badge variant="outline" className="ms-2">Main admin</Badge>}
                    </TableCell>
                    <TableCell>{String(u.username)}</TableCell>
                    <TableCell>{String(u.roles ?? "")}</TableCell>
                    <TableCell>{String(u.status)}</TableCell>
                    <TableCell>{formatDateTime(u.lastLoginAt as string | null)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setupLink.mutate(Number(u.id))}>
                        New setup link
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suspension</CardTitle>
          <CardDescription>
            A suspended school&apos;s users are signed out and cannot sign in. All data is kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {s.status === "ACTIVE" ? (
            <Button variant="destructive" onClick={() => setSuspending(true)}>
              Suspend school
            </Button>
          ) : (
            <Button onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
              Reactivate school
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={suspending}
        onOpenChange={setSuspending}
        title={`Suspend ${s.name}?`}
        description="All its users are signed out immediately."
        confirmLabel="Suspend"
        destructive
        requireReason
        pending={suspend.isPending}
        onConfirm={(reason) => suspend.mutate(reason)}
      />
    </div>
  );
}

/** Super admin actions log (platform_audit_log). */
export function PlatformAuditPage() {
  const [page, setPage] = useState(0);
  const audit = useQuery({ queryKey: ["platform", "audit", page], queryFn: () => platform.audit(page) });
  if (audit.isPending) return <Loading />;
  if (audit.isError) return <ErrorState error={audit.error} onRetry={() => audit.refetch()} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Platform audit" description="Every super admin action: school changes, school switches, setup links." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(audit.data.items ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(a.at)}</TableCell>
                  <TableCell>{a.actorName ?? "System"}</TableCell>
                  <TableCell>
                    <code className="text-xs">{a.action}</code>
                  </TableCell>
                  <TableCell>{a.schoolCode ?? "—"}</TableCell>
                  <TableCell className="max-w-80 truncate text-xs text-muted-foreground">{a.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 text-sm">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        Page {page + 1} of {Math.max(1, audit.data.totalPages)}
        <Button size="sm" variant="outline" disabled={page + 1 >= audit.data.totalPages} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
