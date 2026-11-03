"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, fileUrl, openBlob } from "@/lib/api/client";
import { students, type Student, type StudentCertificateType } from "@/lib/api/people";
import { formatDate, formatDateTime } from "@/lib/format";
import { P } from "@/lib/permissions";
import { label, UploadButton, useCan } from "@/features/people/shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

// ---------------------------------------------------------------- contacts
/** Extra people for a student: who may collect the child and who receives which messages (FR 5.2). */
export function Contacts({ id }: { id: number }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const key = ["students", id, "contacts"];
  const contacts = useQuery({ queryKey: key, queryFn: () => students.contacts(id) });
  const blank = { name: "", relationship: "", phone: "", cnic: "", canCollect: false, receivesAttendance: false, receivesFees: false, receivesResults: false };
  const [form, setForm] = useState(blank);
  const add = useMutation({
    mutationFn: () =>
      students.addContact(id, { ...form, phone: form.phone || undefined, cnic: form.cnic || undefined }),
    onSuccess: () => {
      setForm(blank);
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Contact added");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (contactId: number) => students.removeContact(id, contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError,
  });
  const manage = can(P.FAMILIES_MANAGE);
  const flag = (key: "canCollect" | "receivesAttendance" | "receivesFees" | "receivesResults", text: string) => (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={form[key]} onCheckedChange={(checked) => setForm((f) => ({ ...f, [key]: checked === true }))} />
      {text}
    </label>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Other contacts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {contacts.isPending ? (
          <Loading />
        ) : contacts.isError ? (
          <ErrorState error={contacts.error} />
        ) : contacts.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other contacts. The family&apos;s parents are used.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Allowed</TableHead>
                {manage && <TableHead className="w-12"><span className="sr-only">Remove</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.relationship}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    {c.canCollect && <Badge variant="outline">Can collect</Badge>}
                    {c.receivesAttendance && <Badge variant="outline">Attendance</Badge>}
                    {c.receivesFees && <Badge variant="outline">Fees</Badge>}
                    {c.receivesResults && <Badge variant="outline">Results</Badge>}
                  </TableCell>
                  {manage && (
                    <TableCell>
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => remove.mutate(c.id ?? 0)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {manage && (
          <form
            className="flex flex-col gap-3 rounded-lg border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <p className="text-sm font-medium">Add contact</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field id="ct-name" label="Name">
                <Input id="ct-name" required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field id="ct-rel" label="Relationship">
                <Input id="ct-rel" required maxLength={50} placeholder="e.g. Uncle, Driver" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
              </Field>
              <Field id="ct-phone" label="Phone">
                <Input id="ct-phone" inputMode="tel" maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field id="ct-cnic" label="CNIC">
                <Input id="ct-cnic" maxLength={20} value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4">
              {flag("canCollect", "May collect the child")}
              {flag("receivesAttendance", "Gets attendance messages")}
              {flag("receivesFees", "Gets fee messages")}
              {flag("receivesResults", "Gets results")}
            </div>
            <div>
              <Button type="submit" size="sm" disabled={add.isPending}>
                Add contact
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------- documents
const DOCUMENT_TYPES = [
  ["B_FORM", "B-Form"],
  ["BIRTH_CERTIFICATE", "Birth certificate"],
  ["SCHOOL_LEAVING_CERTIFICATE", "Previous school leaving certificate"],
  ["RESULT_CARD", "Result card"],
  ["MEDICAL", "Medical"],
  ["OTHER", "Other"],
] as const;

/** Scanned documents (FR 5.1). */
export function Documents({ id }: { id: number }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const key = ["students", id, "documents"];
  const docs = useQuery({ queryKey: key, queryFn: () => students.documents(id) });
  const [docType, setDocType] = useState<string>("B_FORM");
  const [title, setTitle] = useState("");
  const add = useMutation({
    mutationFn: (fileId: number) => students.addDocument(id, { fileId, docType, title: title || undefined }),
    onSuccess: () => {
      setTitle("");
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Document added");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (documentId: number) => students.removeDocument(id, documentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError,
  });
  const upload = can(P.STUDENTS_MANAGE) || can(P.ADMISSIONS_ENROL);
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
                  {DOCUMENT_TYPES.find(([v]) => v === d.docType)?.[1] ?? label(d.docType)}
                  {d.title ? ` — ${d.title}` : ""}
                </a>
                {can(P.STUDENTS_MANAGE) && (
                  <Button size="icon-sm" variant="ghost" aria-label="Remove document" onClick={() => remove.mutate(d.id ?? 0)}>
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {upload && (
          <div className="flex flex-wrap items-end gap-3">
            <Field id="doc-type" label="Document">
              <NativeSelect id="doc-type" className="w-60" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOCUMENT_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="doc-title" label="Note (optional)">
              <Input id="doc-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <UploadButton
              purpose="STUDENT_DOCUMENT"
              accept="application/pdf,image/png,image/jpeg"
              label="Upload file"
              disabled={add.isPending}
              onUploaded={(fileId) => add.mutate(fileId)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------- activities
/** House and club memberships and achievements (FR 5.6). */
export function Activities({ id }: { id: number }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const key = ["students", id, "activities"];
  const list = useQuery({ queryKey: key, queryFn: () => students.activities(id) });
  const groups = useQuery({ queryKey: ["students", "groups"], queryFn: students.groups });
  const [kind, setKind] = useState<"MEMBERSHIP" | "ACHIEVEMENT">("MEMBERSHIP");
  const [groupId, setGroupId] = useState<number | "">("");
  const [role, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [achievedOn, setAchievedOn] = useState("");
  const [description, setDescription] = useState("");
  const [newGroup, setNewGroup] = useState({ name: "", kind: "HOUSE" });
  const manage = can(P.STUDENTS_MANAGE);
  const add = useMutation({
    mutationFn: () =>
      students.addActivity(
        id,
        kind === "MEMBERSHIP"
          ? { kind, groupId: Number(groupId), role: role || undefined }
          : { kind, title, achievedOn: achievedOn || undefined, description: description || undefined },
      ),
    onSuccess: () => {
      setRole("");
      setTitle("");
      setDescription("");
      setAchievedOn("");
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Saved");
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (activityId: number) => students.removeActivity(id, activityId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError,
  });
  const createGroup = useMutation({
    mutationFn: () => students.createGroup(newGroup),
    onSuccess: (g) => {
      setNewGroup({ name: "", kind: newGroup.kind });
      setGroupId(g.id ?? "");
      void queryClient.invalidateQueries({ queryKey: ["students", "groups"] });
    },
    onError,
  });
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        {list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <ErrorState error={list.error} />
        ) : list.data.length === 0 ? (
          <Empty title="No houses, clubs or achievements yet" />
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {list.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>
                  <Badge variant="outline" className="me-2">
                    {a.kind === "MEMBERSHIP" ? label(groups.data?.find((g) => g.id === a.groupId)?.kind ?? "Group") : "Achievement"}
                  </Badge>
                  {a.kind === "MEMBERSHIP" ? a.groupName : a.title}
                  {a.role && <span className="text-muted-foreground"> · {a.role}</span>}
                  {a.achievedOn && <span className="text-muted-foreground"> · {formatDate(a.achievedOn)}</span>}
                  {a.description && <span className="block text-muted-foreground">{a.description}</span>}
                </span>
                {manage && (
                  <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => remove.mutate(a.id ?? 0)}>
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {manage && (
          <form
            className="flex flex-col gap-3 rounded-lg border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <fieldset className="flex gap-4 text-sm">
              <legend className="mb-2 text-sm font-medium">Add</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="act-kind" checked={kind === "MEMBERSHIP"} onChange={() => setKind("MEMBERSHIP")} />
                House or club
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="act-kind" checked={kind === "ACHIEVEMENT"} onChange={() => setKind("ACHIEVEMENT")} />
                Achievement
              </label>
            </fieldset>
            {kind === "MEMBERSHIP" ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field id="act-group" label="House or club">
                  <NativeSelect id="act-group" className="w-56" required value={groupId} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Choose</option>
                    {(groups.data ?? [])
                      .filter((g) => g.active)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({label(g.kind)})
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
                <Field id="act-role" label="Role (optional)">
                  <Input id="act-role" maxLength={100} placeholder="e.g. Captain" value={role} onChange={(e) => setRole(e.target.value)} />
                </Field>
                <div className="flex items-end gap-2 border-s ps-3">
                  <Field id="grp-name" label="New house or club">
                    <Input id="grp-name" maxLength={100} value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} />
                  </Field>
                  <NativeSelect aria-label="Type" className="w-24" value={newGroup.kind} onChange={(e) => setNewGroup({ ...newGroup, kind: e.target.value })}>
                    <option value="HOUSE">House</option>
                    <option value="CLUB">Club</option>
                  </NativeSelect>
                  <Button type="button" size="sm" variant="outline" disabled={!newGroup.name.trim() || createGroup.isPending} onClick={() => createGroup.mutate()}>
                    Create
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="ach-title" label="Achievement">
                  <Input id="ach-title" required maxLength={200} placeholder="e.g. 1st in district quiz" value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <Field id="ach-date" label="Date">
                  <Input id="ach-date" type="date" value={achievedOn} onChange={(e) => setAchievedOn(e.target.value)} />
                </Field>
                <Field id="ach-desc" label="Details">
                  <Input id="ach-desc" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
              </div>
            )}
            <div>
              <Button type="submit" size="sm" disabled={add.isPending || (kind === "MEMBERSHIP" && groupId === "")}>
                Save
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------ certificates
const CERTIFICATES: { type: StudentCertificateType; label: string; fields: (keyof CertificateFields)[] }[] = [
  { type: "LEAVING", label: "School leaving certificate", fields: ["reason", "conduct", "remarks"] },
  { type: "CHARACTER", label: "Character certificate", fields: ["conduct", "remarks"] },
  { type: "DATE_OF_BIRTH", label: "Date of birth certificate", fields: ["remarks"] },
  { type: "APPRECIATION", label: "Certificate of appreciation", fields: ["reason", "remarks"] },
  { type: "PROVISIONAL", label: "Provisional certificate", fields: ["examination", "session", "seatNo", "result", "remarks"] },
  { type: "HOPE", label: "Hope certificate", fields: ["examination", "session", "remarks"] },
];

type CertificateFields = {
  reason: string;
  conduct: string;
  examination: string;
  session: string;
  seatNo: string;
  result: string;
  remarks: string;
};

const FIELD_LABELS: Record<keyof CertificateFields, string> = {
  reason: "Reason",
  conduct: "Conduct",
  examination: "Examination",
  session: "Session / held in",
  seatNo: "Seat no.",
  result: "Result (grade / division)",
  remarks: "Extra remarks",
};

/** Certificates with a serial number, recorded in the register (FR 5.8). */
export function Certificates({ student }: { student: Student }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const id = student.id ?? 0;
  const key = ["students", id, "certificates"];
  const issued = useQuery({ queryKey: key, queryFn: () => students.certificates(id) });
  const [type, setType] = useState<StudentCertificateType>(student.status === "LEFT" ? "LEAVING" : "CHARACTER");
  const [fields, setFields] = useState<CertificateFields>({
    reason: "",
    conduct: "good",
    examination: "",
    session: "",
    seatNo: student.details?.seatNo ?? "",
    result: "",
    remarks: "",
  });
  const issue = useMutation({
    mutationFn: () => {
      const wanted = CERTIFICATES.find((c) => c.type === type)?.fields ?? [];
      const body = Object.fromEntries(wanted.filter((f) => fields[f].trim() !== "").map((f) => [f, fields[f].trim()]));
      return students.issueCertificate(id, type, body);
    },
    onSuccess: (blob) => {
      openBlob(blob, `${type.toLowerCase()}-certificate-${student.grNo}.pdf`);
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Certificate issued and recorded");
    },
    onError,
  });
  const chosen = CERTIFICATES.find((c) => c.type === type);
  const available = CERTIFICATES.filter((c) => c.type !== "LEAVING" || student.status === "LEFT");
  return (
    <div className="flex flex-col gap-6">
      {can(P.STUDENTS_PRINT) && (
        <Card>
          <CardHeader>
            <CardTitle>Issue a certificate</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                issue.mutate();
              }}
            >
              <Field id="cert-type" label="Certificate" className="max-w-sm">
                <NativeSelect id="cert-type" value={type} onChange={(e) => setType(e.target.value as StudentCertificateType)}>
                  {available.map((c) => (
                    <option key={c.type} value={c.type}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {student.status !== "LEFT" && (
                <p className="text-xs text-muted-foreground">A leaving certificate is available after the withdrawal is recorded.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {chosen?.fields.map((f) => (
                  <Field key={f} id={`cert-${f}`} label={FIELD_LABELS[f]} className={f === "remarks" ? "sm:col-span-2" : undefined}>
                    {f === "remarks" ? (
                      <Textarea id={`cert-${f}`} rows={2} maxLength={500} value={fields[f]} onChange={(e) => setFields({ ...fields, [f]: e.target.value })} />
                    ) : (
                      <Input id={`cert-${f}`} maxLength={200} value={fields[f]} onChange={(e) => setFields({ ...fields, [f]: e.target.value })} />
                    )}
                  </Field>
                ))}
              </div>
              <div>
                <Button type="submit" disabled={issue.isPending}>
                  {issue.isPending ? "Preparing…" : "Issue and print"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Issued certificates</CardTitle>
        </CardHeader>
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
                  <TableHead>Certificate</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issued.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.serialNo}</TableCell>
                    <TableCell>{CERTIFICATES.find((x) => x.type === c.type)?.label ?? label(c.type)}</TableCell>
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
