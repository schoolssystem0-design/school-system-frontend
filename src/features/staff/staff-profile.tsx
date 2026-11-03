"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { SecretOnce } from "@/components/app/secret-once";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, fileUrl, openBlob, type Schemas } from "@/lib/api/client";
import { iam } from "@/lib/api/endpoints";
import { staff, teaching, type StaffMember } from "@/lib/api/people";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { P } from "@/lib/permissions";
import { label, today, UploadButton, useCan } from "@/features/people/shared";
import { useYear } from "@/features/shell/year-context";
import { useStepUp } from "@/features/step-up/step-up-provider";
import { LeavePage } from "@/features/attendance/leave-page";
import { staffBody, StaffForm, staffFrom } from "./staff-form";

const onError = (e: unknown) => toast.error(errorMessage(e));

export function StaffProfile() {
  const id = Number(useParams<{ id: string }>().id);
  const member = useQuery({ queryKey: ["staff", id], queryFn: () => staff.get(id) });
  if (member.isPending) return <Loading />;
  if (member.isError) return <ErrorState error={member.error} onRetry={() => member.refetch()} />;
  return <Profile member={member.data} />;
}

function Profile({ member }: { member: StaffMember }) {
  const can = useCan();
  const id = member.id ?? 0;
  const working = member.status === "ACTIVE";
  const [leaving, setLeaving] = useState(false);
  const queryClient = useQueryClient();
  const rejoin = useMutation({
    mutationFn: () => staff.rejoin(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member marked as working again");
    },
    onError,
  });
  const photo = fileUrl(member.details?.photoFileId);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="size-16 rounded-md border object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <PageHeader
            title={member.details?.name ?? "Staff"}
            description={`${member.employeeNo} · ${member.details?.designation} · joined ${formatDate(member.details?.joiningDate)}`}
            actions={
              <>
                <Badge variant={working ? "default" : "secondary"}>
                  {working ? "Working" : `Left ${formatDate(member.leavingDate)}`}
                </Badge>
                {can(P.STAFF_MANAGE) &&
                  (working ? (
                    <Button variant="destructive" onClick={() => setLeaving(true)}>
                      Record leaving
                    </Button>
                  ) : (
                    <Button variant="outline" disabled={rejoin.isPending} onClick={() => rejoin.mutate()}>
                      Rejoin
                    </Button>
                  ))}
              </>
            }
          />
        </div>
      </div>
      <Tabs defaultValue="details">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="classes">Classes taught</TabsTrigger>
          {can(P.ATTENDANCE_VIEW) && <TabsTrigger value="attendance">Attendance &amp; leave</TabsTrigger>}
          {can(P.STAFF_SALARY_VIEW) && <TabsTrigger value="salary">Salary</TabsTrigger>}
          {can(P.STAFF_MANAGE) && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {can(P.STAFF_MANAGE) && <TabsTrigger value="certificates">Certificates</TabsTrigger>}
          {can(P.STAFF_MANAGE) && can(P.IAM_USER_MANAGE) && <TabsTrigger value="login">Sign-in</TabsTrigger>}
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <Details key={member.version} member={member} />
        </TabsContent>
        {can(P.ATTENDANCE_VIEW) && (
          <TabsContent value="attendance" className="mt-4">
            <LeavePage personType="STAFF" personId={id} />
          </TabsContent>
        )}
        <TabsContent value="classes" className="mt-4">
          <ClassesTaught staffId={id} />
        </TabsContent>
        {can(P.STAFF_SALARY_VIEW) && (
          <TabsContent value="salary" className="mt-4">
            <Salary staffId={id} />
          </TabsContent>
        )}
        {can(P.STAFF_MANAGE) && (
          <TabsContent value="documents" className="mt-4">
            <Documents staffId={id} />
          </TabsContent>
        )}
        {can(P.STAFF_MANAGE) && (
          <TabsContent value="certificates" className="mt-4">
            <Certificates member={member} />
          </TabsContent>
        )}
        {can(P.STAFF_MANAGE) && can(P.IAM_USER_MANAGE) && (
          <TabsContent value="login" className="mt-4">
            <Login member={member} />
          </TabsContent>
        )}
      </Tabs>
      {leaving && <LeaveDialog member={member} onClose={() => setLeaving(false)} />}
    </div>
  );
}

function Details({ member }: { member: StaffMember }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(staffFrom(member.details));
  const save = useMutation({
    mutationFn: () => staff.update(member.id ?? 0, { ...staffBody(value), version: member.version }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Saved");
    },
    onError,
  });
  const manage = can(P.STAFF_MANAGE);
  return (
    <Card>
      <CardContent className="pt-6">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <fieldset disabled={!manage} className="contents">
            <StaffForm value={value} onChange={setValue} />
          </fieldset>
          {member.leavingReason && (
            <p className="text-sm text-muted-foreground">Reason for leaving: {member.leavingReason}</p>
          )}
          {manage && (
            <div>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save details"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function ClassesTaught({ staffId }: { staffId: number }) {
  const { selected } = useYear();
  const yearId = selected?.id ?? 0;
  const list = useQuery({
    queryKey: ["teaching", yearId, "assignments", "staff", staffId],
    queryFn: () => teaching.assignments(yearId, { staffId, currentOnly: false }),
    enabled: yearId > 0,
  });
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  if (list.data.length === 0) return <Empty title={`No classes assigned in ${selected?.name}`} />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Section</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.sectionLabel}</TableCell>
                <TableCell>{a.subjectName ?? <Badge variant="outline">Class teacher</Badge>}</TableCell>
                <TableCell>{formatDate(a.effectiveFrom)}</TableCell>
                <TableCell>{a.effectiveTo ? formatDate(a.effectiveTo) : "Now"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Salary history (FR 3.3): every change is a new dated row with a reason; nothing is overwritten. */
function Salary({ staffId }: { staffId: number }) {
  const can = useCan();
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const key = ["staff", staffId, "salary"];
  const history = useQuery({ queryKey: key, queryFn: () => staff.salary(staffId) });
  const [form, setForm] = useState({ basicSalary: "", perLectureRate: "", bankName: "", bankAccount: "", effectiveFrom: today(), reason: "" });
  const add = useMutation({
    mutationFn: () =>
      guard(() =>
        staff.addSalary(staffId, {
          basicSalary: form.basicSalary.trim(),
          perLectureRate: form.perLectureRate.trim() || undefined,
          bankName: form.bankName.trim() || undefined,
          bankAccount: form.bankAccount.trim() || undefined,
          effectiveFrom: form.effectiveFrom,
          reason: form.reason.trim(),
        }),
      ),
    onSuccess: () => {
      setForm((f) => ({ ...f, basicSalary: "", perLectureRate: "", reason: "" }));
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Salary recorded");
    },
    onError,
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="p-0">
          {history.isPending ? (
            <Loading />
          ) : history.isError ? (
            <ErrorState error={history.error} />
          ) : history.data.length === 0 ? (
            <div className="p-6">
              <Empty title="No salary recorded" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead className="text-right">Basic salary</TableHead>
                  <TableHead className="text-right">Per lecture</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.effectiveFrom)}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.basicSalary)}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.perLectureRate)}</TableCell>
                    <TableCell>{[s.bankName, s.bankAccount].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="max-w-56 truncate">{s.reason}</TableCell>
                    <TableCell>{s.createdBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {can(P.STAFF_SALARY_MANAGE) && (
        <Card>
          <CardHeader>
            <CardTitle>New salary</CardTitle>
            <CardDescription>Applies from the date given. Earlier months keep the salary that applied then.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <Field id="sal-basic" label="Basic salary (Rs.)">
                <Input id="sal-basic" required inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={form.basicSalary} onChange={set("basicSalary")} />
              </Field>
              <Field id="sal-lecture" label="Per lecture rate (Rs.)" hint="For visiting teachers">
                <Input id="sal-lecture" inputMode="decimal" pattern="\d+(\.\d{1,2})?" value={form.perLectureRate} onChange={set("perLectureRate")} />
              </Field>
              <Field id="sal-from" label="Effective from">
                <Input id="sal-from" type="date" required value={form.effectiveFrom} onChange={set("effectiveFrom")} />
              </Field>
              <Field id="sal-bank" label="Bank">
                <Input id="sal-bank" maxLength={100} value={form.bankName} onChange={set("bankName")} />
              </Field>
              <Field id="sal-account" label="Account / IBAN">
                <Input id="sal-account" maxLength={50} value={form.bankAccount} onChange={set("bankAccount")} />
              </Field>
              <Field id="sal-reason" label="Reason">
                <Input id="sal-reason" required maxLength={500} placeholder="e.g. Annual increment" value={form.reason} onChange={set("reason")} />
              </Field>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={add.isPending}>
                  {add.isPending ? "Saving…" : "Record salary"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const STAFF_DOCUMENTS = [
  ["CNIC", "CNIC copy"],
  ["DEGREE", "Degree / certificate"],
  ["EXPERIENCE", "Experience letter"],
  ["CONTRACT", "Contract"],
  ["OTHER", "Other"],
] as const;

function Documents({ staffId }: { staffId: number }) {
  const queryClient = useQueryClient();
  const key = ["staff", staffId, "documents"];
  const docs = useQuery({ queryKey: key, queryFn: () => staff.documents(staffId) });
  const [docType, setDocType] = useState<string>("CNIC");
  const [title, setTitle] = useState("");
  const add = useMutation({
    mutationFn: (fileId: number) => staff.addDocument(staffId, { fileId, docType, title: title || undefined }),
    onSuccess: () => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Document added");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (documentId: number) => staff.removeDocument(staffId, documentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError,
  });
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {docs.isPending ? (
          <Loading />
        ) : docs.isError ? (
          <ErrorState error={docs.error} />
        ) : docs.data.length === 0 ? (
          <Empty title="No documents" />
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {docs.data.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <a className="underline-offset-4 hover:underline" href={fileUrl(d.fileId) ?? "#"} target="_blank" rel="noreferrer">
                  {STAFF_DOCUMENTS.find(([v]) => v === d.docType)?.[1] ?? label(d.docType)}
                  {d.title ? ` — ${d.title}` : ""}
                </a>
                <Button size="icon-sm" variant="ghost" aria-label="Remove document" onClick={() => remove.mutate(d.id ?? 0)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <Field id="sdoc-type" label="Document">
            <NativeSelect id="sdoc-type" className="w-52" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {STAFF_DOCUMENTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="sdoc-title" label="Note (optional)">
            <Input id="sdoc-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <UploadButton
            purpose="STAFF_DOCUMENT"
            accept="application/pdf,image/png,image/jpeg"
            label="Upload file"
            disabled={add.isPending}
            onUploaded={(fileId) => add.mutate(fileId)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Certificates({ member }: { member: StaffMember }) {
  const queryClient = useQueryClient();
  const id = member.id ?? 0;
  const key = ["staff", id, "certificates"];
  const issued = useQuery({ queryKey: key, queryFn: () => staff.certificates(id) });
  const [remarks, setRemarks] = useState("");
  const issue = useMutation({
    mutationFn: () => staff.experienceCertificate(id, remarks.trim() || undefined),
    onSuccess: (blob) => {
      openBlob(blob, `experience-certificate-${member.employeeNo}.pdf`);
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Experience certificate issued");
    },
    onError,
  });
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Experience certificate</CardTitle>
          <CardDescription>
            States the designation and the period of service{member.status === "ACTIVE" ? " up to today" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field id="exp-remarks" label="Extra remarks (optional)">
            <Textarea id="exp-remarks" rows={2} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
          <div>
            <Button disabled={issue.isPending} onClick={() => issue.mutate()}>
              {issue.isPending ? "Preparing…" : "Issue and print"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {issued.isPending ? (
            <Loading />
          ) : issued.isError ? (
            <ErrorState error={issued.error} />
          ) : issued.data.length === 0 ? (
            <div className="p-6">
              <Empty title="No certificates issued yet" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial no.</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issued.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.serialNo}</TableCell>
                    <TableCell>{formatDateTime(c.issuedAt)}</TableCell>
                    <TableCell>{c.issuedBy ?? "—"}</TableCell>
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

/** Gives the staff member their own sign-in (FR 1.6), linked to the staff record. */
function Login({ member }: { member: StaffMember }) {
  const guard = useStepUp();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ["iam", "roles"], queryFn: iam.roles });
  const [username, setUsername] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [dataScope, setDataScope] = useState<"ALL" | "ASSIGNED_CLASSES" | "SELF">(
    member.details?.category === "TEACHER" ? "ASSIGNED_CLASSES" : "ALL",
  );
  const [secret, setSecret] = useState<Schemas["NewLogin"] | null>(null);
  const create = useMutation({
    mutationFn: () => guard(() => staff.createLogin(member.id ?? 0, { username: username.trim(), roleIds, dataScope })),
    onSuccess: (login) => {
      setSecret(login);
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      void queryClient.invalidateQueries({ queryKey: ["iam", "users"] });
    },
    onError,
  });
  if (secret) {
    return (
      <SecretOnce
        title={`Temporary password for ${secret.username}`}
        value={secret.temporaryPassword ?? ""}
        note="Give it to the staff member privately. It is shown only once and must be changed at first sign-in."
      />
    );
  }
  if (member.login) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 pt-6 text-sm">
          <p>
            Signs in as <strong>{member.login.username}</strong>{" "}
            <Badge variant={member.login.status === "ACTIVE" ? "default" : "secondary"}>{label(member.login.status)}</Badge>
          </p>
          <p className="text-muted-foreground">Change roles, reset the password or deactivate the account under Users.</p>
        </CardContent>
      </Card>
    );
  }
  if (member.status !== "ACTIVE") return <Empty title="Staff who have left cannot be given a sign-in" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create sign-in</CardTitle>
        <CardDescription>A temporary password is shown once. The account closes automatically when they leave.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="sl-username" label="Username" hint="lowercase, e.g. ahmed.khan">
              <Input id="sl-username" required maxLength={60} value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field id="sl-scope" label="Can see">
              <NativeSelect id="sl-scope" value={dataScope} onChange={(e) => setDataScope(e.target.value as typeof dataScope)}>
                <option value="ALL">All classes</option>
                <option value="ASSIGNED_CLASSES">Only assigned classes (teachers)</option>
                <option value="SELF">Only own records</option>
              </NativeSelect>
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Roles</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(roles.data ?? []).map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roleIds.includes(r.id ?? 0)}
                    onCheckedChange={(checked) =>
                      setRoleIds((ids) => (checked ? [...ids, r.id ?? 0] : ids.filter((x) => x !== r.id)))
                    }
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Button type="submit" disabled={create.isPending || roleIds.length === 0}>
              {create.isPending ? "Creating…" : "Create sign-in"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LeaveDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [leavingDate, setLeavingDate] = useState(today);
  const [reason, setReason] = useState("");
  const leave = useMutation({
    mutationFn: () => staff.leave(member.id ?? 0, { leavingDate, reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      void queryClient.invalidateQueries({ queryKey: ["teaching"] });
      toast.success("Leaving recorded");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            leave.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Record leaving: {member.details?.name}</DialogTitle>
            <DialogDescription>
              Their sign-in is closed and their classes end on this date. Hand the classes over to another teacher under
              Teaching. Their records stay.
            </DialogDescription>
          </DialogHeader>
          <Field id="lv-date" label="Last working day">
            <Input id="lv-date" type="date" required value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} />
          </Field>
          <Field id="lv-reason" label="Reason">
            <Textarea id="lv-reason" required rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={leave.isPending}>
              {leave.isPending ? "Saving…" : "Record leaving"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
