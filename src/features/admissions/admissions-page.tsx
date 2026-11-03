"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, openBlob } from "@/lib/api/client";
import { admissions, type EnquiryStatus } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { P } from "@/lib/permissions";
import { ClassSelect, label, Pager, useCan, useClasses } from "@/features/people/shared";
import { DuplicateWarning, enquiryBody, EnquiryForm, enquiryFrom } from "./enquiry-form";

/** Admissions (FR 4.1–4.7): enquiries and their follow-up, statuses, and the admission form contents. */
export function AdmissionsPage() {
  const can = useCan();
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admissions"
        description="Record every enquiry, follow it up, and enrol the child when admission is confirmed."
        actions={
          can(P.ADMISSIONS_MANAGE) && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden /> New enquiry
            </Button>
          )
        }
      />
      <Tabs defaultValue="enquiries">
        <TabsList>
          <TabsTrigger value="enquiries">Enquiries</TabsTrigger>
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="content">Admission form</TabsTrigger>
        </TabsList>
        <TabsContent value="enquiries" className="mt-4">
          <EnquiryList />
        </TabsContent>
        <TabsContent value="statuses" className="mt-4">
          <Statuses />
        </TabsContent>
        <TabsContent value="content" className="mt-4">
          <AdmissionContent />
        </TabsContent>
      </Tabs>
      {creating && <NewEnquiryDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

export function StatusBadge({ name, colour }: { name?: string; colour?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
      <span className="size-2 rounded-full" style={{ backgroundColor: colour ?? "#64748b" }} aria-hidden />
      {name}
    </span>
  );
}

function EnquiryList() {
  const [q, setQ] = useState("");
  const [statusId, setStatusId] = useState<number | "">("");
  const [classId, setClassId] = useState<number | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const statuses = useQuery({ queryKey: ["admissions", "statuses"], queryFn: admissions.statuses });
  const params = {
    q,
    statusId: statusId || undefined,
    classId: classId || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
  };
  const list = useQuery({ queryKey: ["admissions", "enquiries", params], queryFn: () => admissions.enquiries(params) });
  const reset = () => setPage(0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="enq-search" label="Search">
          <Input
            id="enq-search"
            className="w-60"
            placeholder="Child, parent, phone or reg. no."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              reset();
            }}
          />
        </Field>
        <Field id="enq-status" label="Status">
          <NativeSelect
            id="enq-status"
            className="w-44"
            value={statusId}
            onChange={(e) => {
              setStatusId(e.target.value ? Number(e.target.value) : "");
              reset();
            }}
          >
            <option value="">All</option>
            {(statuses.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="enq-class" label="Class">
          <ClassSelect
            id="enq-class"
            className="w-36"
            value={classId}
            onChange={(v) => {
              setClassId(v);
              reset();
            }}
          />
        </Field>
        <Field id="enq-from" label="From">
          <Input id="enq-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field id="enq-to" label="To">
          <Input id="enq-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.items.length === 0 ? (
            <div className="p-6">
              <Empty title="No enquiries found" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg. no.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Child</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/app/admissions/${e.id}`}>
                        {e.registrationNo}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(e.enquiryDate)}</TableCell>
                    <TableCell>{e.childName}</TableCell>
                    <TableCell>{e.className ?? "—"}</TableCell>
                    <TableCell>
                      {e.parentName ?? "—"}
                      {e.parentPhone && <span className="block text-xs text-muted-foreground">{e.parentPhone}</span>}
                    </TableCell>
                    <TableCell>{e.testTotal != null ? `${e.testObtained ?? "—"} / ${e.testTotal}` : "—"}</TableCell>
                    <TableCell>
                      <StatusBadge name={e.statusName} colour={e.statusColour} />
                    </TableCell>
                    <TableCell>{formatDate(e.lastContact)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Pager page={page} totalPages={list.data?.totalPages} onChange={setPage} />
    </div>
  );
}

function NewEnquiryDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(enquiryFrom());
  const create = useMutation({
    mutationFn: () => admissions.create(enquiryBody(value)),
    onSuccess: (e) => {
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      toast.success(`Enquiry ${e.registrationNo} saved`);
      router.push(`/app/admissions/${e.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>New enquiry</DialogTitle>
          </DialogHeader>
          <EnquiryForm idPrefix="ne" value={value} onChange={setValue} />
          <DuplicateWarning value={value} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Save enquiry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Statuses() {
  const can = useCan();
  const queryClient = useQueryClient();
  const statuses = useQuery({ queryKey: ["admissions", "statuses"], queryFn: admissions.statuses });
  const [name, setName] = useState("");
  const [colour, setColour] = useState("#0ea5e9");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admissions"] });
  const create = useMutation({
    mutationFn: () => admissions.createStatus({ name, colour }),
    onSuccess: () => {
      setName("");
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const update = useMutation({
    mutationFn: (s: EnquiryStatus & { name: string }) =>
      admissions.updateStatus(s.id ?? 0, { name: s.name, colour: s.colour, active: s.active }),
    onSuccess: () => {
      void refresh();
      toast.success("Status saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const manage = can(P.ADMISSIONS_MANAGE);
  if (statuses.isPending) return <Loading />;
  if (statuses.isError) return <ErrorState error={statuses.error} onRetry={() => statuses.refetch()} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Enquiry statuses</CardTitle>
        <CardDescription>
          The five standard statuses can be renamed and recoloured but not switched off. Add your own for other steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y rounded-md border">
          {statuses.data.map((s) => (
            <StatusRow key={`${s.id}-${s.name}-${s.colour}-${s.active}`} status={s} manage={manage} onSave={update.mutate} />
          ))}
        </ul>
        {manage && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Field id="st-new-name" label="New status">
              <Input id="st-new-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field id="st-new-colour" label="Colour">
              <Input id="st-new-colour" type="color" className="w-16 p-1" value={colour} onChange={(e) => setColour(e.target.value)} />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              Add status
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function StatusRow({
  status,
  manage,
  onSave,
}: {
  status: EnquiryStatus;
  manage: boolean;
  onSave: (s: EnquiryStatus & { name: string }) => void;
}) {
  const [name, setName] = useState(status.name ?? "");
  const [colour, setColour] = useState(status.colour ?? "#64748b");
  const changed = name !== status.name || colour !== status.colour;
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2">
      <Input
        aria-label="Colour"
        type="color"
        className="w-12 p-1"
        disabled={!manage}
        value={colour}
        onChange={(e) => setColour(e.target.value)}
      />
      <Input aria-label="Name" className="w-56" disabled={!manage} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      {status.systemCode && <span className="text-xs text-muted-foreground">Standard: {label(status.systemCode)}</span>}
      <div className="ms-auto flex items-center gap-3">
        {!status.systemCode && (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={status.active ?? true}
              disabled={!manage}
              onCheckedChange={(active) => onSave({ ...status, name, colour, active })}
            />
            In use
          </label>
        )}
        {manage && changed && (
          <Button size="sm" onClick={() => onSave({ ...status, name, colour })}>
            Save
          </Button>
        )}
      </div>
    </li>
  );
}

function AdmissionContent() {
  const can = useCan();
  const queryClient = useQueryClient();
  const classes = useClasses();
  const content = useQuery({ queryKey: ["admissions", "content"], queryFn: admissions.content });
  const [classId, setClassId] = useState<number | "">("");
  const blank = useMutation({
    mutationFn: () => admissions.form({ classId: classId || undefined }),
    onSuccess: (blob) => openBlob(blob, "admission-form.pdf"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: (v: { kind: "TERMS" | "SYLLABUS"; classId?: number; body: string }) => admissions.saveContent(v),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admissions", "content"] });
      toast.success("Saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (content.isPending) return <Loading />;
  if (content.isError) return <ErrorState error={content.error} onRetry={() => content.refetch()} />;
  const terms = content.data.find((c) => c.kind === "TERMS")?.body ?? "";
  const syllabus = content.data.find((c) => c.kind === "SYLLABUS" && c.classId === classId)?.body ?? "";
  const manage = can(P.ADMISSIONS_MANAGE);
  const className = classes.data?.find((c) => c.id === classId)?.name;
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Printed admission form</CardTitle>
          <CardDescription>The form prints with the school letterhead, the terms and the class syllabus.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field id="form-class" label="Class">
            <ClassSelect id="form-class" className="w-40" emptyLabel="Any class" value={classId} onChange={setClassId} />
          </Field>
          <Button variant="outline" disabled={blank.isPending} onClick={() => blank.mutate()}>
            <FileDown aria-hidden /> Blank admission form
          </Button>
        </CardContent>
      </Card>
      <ContentEditor
        key={`terms-${terms}`}
        title="Terms and conditions"
        initial={terms}
        disabled={!manage}
        pending={save.isPending}
        onSave={(body) => save.mutate({ kind: "TERMS", body })}
      />
      {classId !== "" ? (
        <ContentEditor
          key={`syl-${classId}-${syllabus}`}
          title={`Admission test syllabus — ${className}`}
          initial={syllabus}
          disabled={!manage}
          pending={save.isPending}
          onSave={(body) => save.mutate({ kind: "SYLLABUS", classId: Number(classId), body })}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Choose a class above to edit its admission test syllabus.</p>
      )}
    </div>
  );
}

function ContentEditor({
  title,
  initial,
  disabled,
  pending,
  onSave,
}: {
  title: string;
  initial: string;
  disabled: boolean;
  pending: boolean;
  onSave: (body: string) => void;
}) {
  const [body, setBody] = useState(initial);
  const id = `content-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea id={id} aria-label={title} rows={8} maxLength={20000} disabled={disabled} value={body} onChange={(e) => setBody(e.target.value)} />
        {!disabled && (
          <div>
            <Button disabled={pending || body === initial} onClick={() => onSave(body)}>
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
