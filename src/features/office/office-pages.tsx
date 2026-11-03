"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { EVENT_TYPES, office, type Complaint, type SchoolEvent } from "@/lib/api/office";
import { formatDate, formatDateTime } from "@/lib/format";
import { P } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { today, useCan } from "@/features/people/shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

function useRefresh(...key: string[]) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

// --------------------------------------------------------------------- tasks

/** The shared task list (FR 3.5). */
export function TasksPage() {
  const [includeDone, setIncludeDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const list = useQuery({ queryKey: ["office", "tasks", includeDone], queryFn: () => office.tasks(includeDone) });
  const refresh = useRefresh("office", "tasks");
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => (done ? office.completeTask(id) : office.reopenTask(id)),
    onSuccess: refresh,
    onError,
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tasks"
        description="Your tasks and those shared with you. Anyone involved can mark a task complete."
        actions={<Button onClick={() => setAdding(true)}>New task</Button>}
      />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includeDone} onCheckedChange={(c) => setIncludeDone(c === true)} /> Show completed tasks
      </label>
      {list.isPending ? <Loading /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.length === 0 ? (
        <Empty title="No tasks" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Done</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Shared with</TableHead>
              <TableHead>From</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Checkbox
                    aria-label={`Mark "${t.description}" complete`}
                    checked={t.status === "DONE"}
                    disabled={toggle.isPending}
                    onCheckedChange={(c) => toggle.mutate({ id: t.id ?? 0, done: c === true })}
                  />
                </TableCell>
                <TableCell className={cn(t.status === "DONE" && "text-muted-foreground line-through")}>
                  {t.description}
                  {t.priority === "URGENT" && <span className="ml-2 text-xs font-semibold text-red-700">Urgent</span>}
                </TableCell>
                <TableCell className={cn("whitespace-nowrap", t.overdue && "font-medium text-red-700")}>
                  {t.deadline ? formatDate(t.deadline) : "—"}{t.overdue && " (overdue)"}
                </TableCell>
                <TableCell>{(t.sharedWith ?? []).map((c) => c.name).join(", ") || "—"}</TableCell>
                <TableCell>{t.createdBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {adding && <TaskDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function TaskDialog({ onClose }: { onClose: () => void }) {
  const refresh = useRefresh("office", "tasks");
  const colleagues = useQuery({ queryKey: ["office", "colleagues"], queryFn: office.colleagues });
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [shareWith, setShareWith] = useState<number[]>([]);
  const save = useMutation({
    mutationFn: () => office.createTask({ description, deadline: deadline || undefined, priority: urgent ? "URGENT" : "NORMAL", shareWith }),
    onSuccess: () => {
      refresh();
      toast.success("Task added");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="contents" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Share it with the colleagues involved.</DialogDescription>
          </DialogHeader>
          <Field id="tk-desc" label="Task">
            <Textarea id="tk-desc" required rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field id="tk-deadline" label="Deadline">
            <Input id="tk-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={urgent} onCheckedChange={(c) => setUrgent(c === true)} /> Urgent
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Share with</legend>
            <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
              {(colleagues.data ?? []).map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={shareWith.includes(c.id ?? 0)}
                    onCheckedChange={(v) => setShareWith((s) => (v === true ? [...s, c.id ?? 0] : s.filter((x) => x !== c.id)))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!description.trim() || save.isPending}>Save task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- complaints

/** Parent complaints (FR 3.3) of the selected year. */
export function ComplaintsPage() {
  const can = useCan();
  const [status, setStatus] = useState("OPEN");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const list = useQuery({ queryKey: ["office", "complaints", status], queryFn: () => office.complaints(status || undefined) });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Parent complaints"
        description="Unresolved complaints stay here until someone closes them with a note."
        actions={can(P.OFFICE_COMPLAINTS_MANAGE) ? <Button onClick={() => setAdding(true)}>New complaint</Button> : undefined}
      />
      <Field id="cp-status" label="Show" className="max-w-xs">
        <NativeSelect id="cp-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
          <option value="">All</option>
        </NativeSelect>
      </Field>
      {list.isPending ? <Loading /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.length === 0 ? (
        <Empty title="No complaints" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => setOpenId(c.id ?? 0)}>{c.subject}</button>
                </TableCell>
                <TableCell>{c.complainant}</TableCell>
                <TableCell>{c.assignedTo ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(c.openedAt)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", c.urgent && "font-semibold text-red-700")}>{c.daysOpen}</TableCell>
                <TableCell>{c.status === "OPEN" ? "Open" : "Closed"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {adding && <ComplaintDialog onClose={() => setAdding(false)} />}
      {openId != null && <ComplaintDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ComplaintDialog({ onClose }: { onClose: () => void }) {
  const refresh = useRefresh("office", "complaints");
  const [complainant, setComplainant] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const save = useMutation({
    mutationFn: () => office.openComplaint({ complainant, phone: phone || undefined, subject, details: details || undefined }),
    onSuccess: () => {
      refresh();
      toast.success("Complaint recorded");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form className="contents" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>New complaint</DialogTitle>
            <DialogDescription>For the selected academic year.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="cp-who" label="From"><Input id="cp-who" required maxLength={200} value={complainant} onChange={(e) => setComplainant(e.target.value)} /></Field>
            <Field id="cp-phone" label="Phone"><Input id="cp-phone" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          </div>
          <Field id="cp-subject" label="Subject"><Input id="cp-subject" required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field id="cp-details" label="Details"><Textarea id="cp-details" rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!complainant.trim() || !subject.trim() || save.isPending}>Save complaint</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ComplaintDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const complaint = useQuery({ queryKey: ["office", "complaints", "one", id], queryFn: () => office.complaint(id) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {complaint.isPending ? <Loading /> : complaint.isError ? <ErrorState error={complaint.error} /> : <ComplaintBody c={complaint.data} />}
      </DialogContent>
    </Dialog>
  );
}

function ComplaintBody({ c }: { c: Complaint }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const id = c.id ?? 0;
  const manage = can(P.OFFICE_COMPLAINTS_MANAGE);
  const colleagues = useQuery({ queryKey: ["office", "colleagues"], queryFn: office.colleagues, enabled: manage });
  const [remark, setRemark] = useState("");
  const [confirm, setConfirm] = useState(false);
  const done = () => {
    setRemark("");
    setConfirm(false);
    void queryClient.invalidateQueries({ queryKey: ["office", "complaints"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const addRemark = useMutation({ mutationFn: () => office.complaintRemark(id, remark), onSuccess: done, onError });
  const assign = useMutation({ mutationFn: (userId: number | null) => office.assignComplaint(id, userId), onSuccess: done, onError });
  const change = useMutation({
    mutationFn: (text: string) => (c.status === "OPEN" ? office.closeComplaint(id, text) : office.reopenComplaint(id, text)),
    onSuccess: done,
    onError,
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>{c.subject}</DialogTitle>
        <DialogDescription>
          From {c.complainant}{c.phone ? ` (${c.phone})` : ""} · Opened {formatDateTime(c.openedAt)} by {c.openedBy} · {c.status === "OPEN" ? "Open" : "Closed"}
        </DialogDescription>
      </DialogHeader>
      {c.details && <p className="text-sm">{c.details}</p>}
      {manage && (
        <Field id="cp-assign" label="Assigned to" className="max-w-xs">
          <NativeSelect id="cp-assign" value={c.assignedToUser ?? ""} onChange={(e) => assign.mutate(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Nobody</option>
            {(colleagues.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </NativeSelect>
        </Field>
      )}
      <div>
        <h3 className="mb-2 text-sm font-medium">History</h3>
        {(c.remarks ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No remarks yet.</p> : (
          <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto text-sm">
            {(c.remarks ?? []).map((r, i) => (
              <li key={i}>{r.text} <span className="text-xs text-muted-foreground">{r.createdBy}, {formatDateTime(r.createdAt)}</span></li>
            ))}
          </ul>
        )}
      </div>
      {manage && (
        <>
          <Field id="cp-remark" label="Add a remark">
            <Textarea id="cp-remark" rows={2} maxLength={1000} value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(true)}>{c.status === "OPEN" ? "Close complaint" : "Reopen"}</Button>
            <Button disabled={!remark.trim() || addRemark.isPending} onClick={() => addRemark.mutate()}>Save remark</Button>
          </DialogFooter>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={c.status === "OPEN" ? "Close this complaint?" : "Reopen this complaint?"}
            description={c.status === "OPEN" ? "Say how it was resolved." : "Say why it is being reopened."}
            confirmLabel={c.status === "OPEN" ? "Close complaint" : "Reopen"}
            requireReason
            pending={change.isPending}
            onConfirm={(text) => change.mutate(text)}
          />
        </>
      )}
    </>
  );
}

// ----------------------------------------------------------------- circulars

/** Notices for staff (FR 3.11). */
export function CircularsPage() {
  const can = useCan();
  const list = useQuery({ queryKey: ["office", "circulars"], queryFn: office.circulars });
  const refresh = useRefresh("office", "circulars");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const post = useMutation({
    mutationFn: () => office.postCircular({ title, body }),
    onSuccess: () => {
      refresh();
      setAdding(false);
      setTitle("");
      setBody("");
      toast.success("Circular posted");
    },
    onError,
  });
  const remove = useMutation({ mutationFn: office.removeCircular, onSuccess: refresh, onError });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Circulars"
        description="Notices for all staff. To tell families, use Messages."
        actions={can(P.OFFICE_CIRCULARS_MANAGE) ? <Button onClick={() => setAdding(true)}>New circular</Button> : undefined}
      />
      {list.isPending ? <Loading /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.length === 0 ? (
        <Empty title="No circulars yet" />
      ) : (
        <div className="flex flex-col gap-4">
          {list.data.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{c.title}</CardTitle>
                  <CardDescription>{formatDate(c.date)} · {c.createdBy}</CardDescription>
                </div>
                {can(P.OFFICE_CIRCULARS_MANAGE) && (
                  <Button variant="ghost" size="sm" aria-label={`Remove ${c.title}`} disabled={remove.isPending} onClick={() => remove.mutate(c.id ?? 0)}>Remove</Button>
                )}
              </CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm">{c.body}</p></CardContent>
            </Card>
          ))}
        </div>
      )}
      {adding && (
        <Dialog open onOpenChange={(o) => !o && setAdding(false)}>
          <DialogContent className="sm:max-w-lg">
            <form className="contents" onSubmit={(e) => { e.preventDefault(); post.mutate(); }}>
              <DialogHeader>
                <DialogTitle>New circular</DialogTitle>
                <DialogDescription>All staff can read it straight away.</DialogDescription>
              </DialogHeader>
              <Field id="cr-title" label="Title"><Input id="cr-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
              <Field id="cr-body" label="Notice"><Textarea id="cr-body" required rows={6} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
                <Button type="submit" disabled={!title.trim() || !body.trim() || post.isPending}>Post circular</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ calendar

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EVENT_STYLE: Record<string, string> = {
  EVENT: "bg-sky-100 text-sky-900",
  HOLIDAY: "bg-emerald-100 text-emerald-900",
  EXAM: "bg-amber-100 text-amber-900",
  OTHER: "bg-muted text-foreground",
};

/** Month calendar of school events (FR 3.10). */
export function CalendarPage() {
  const can = useCan();
  const [month, setMonth] = useState(() => { const d = new Date(`${today()}T00:00:00`); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [adding, setAdding] = useState<string | null>(null);
  const [selected, setSelected] = useState<SchoolEvent | null>(null);
  const first = iso(month);
  const last = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const events = useQuery({ queryKey: ["office", "events", first], queryFn: () => office.events(first, last) });
  const refresh = useRefresh("office", "events");
  const remove = useMutation({
    mutationFn: office.removeEvent,
    onSuccess: () => { refresh(); setSelected(null); },
    onError,
  });
  const lead = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: lead + days }, (_, i) => (i < lead ? null : iso(new Date(month.getFullYear(), month.getMonth(), i - lead + 1))));
  const manage = can(P.OFFICE_EVENTS_MANAGE);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        description="School events, holidays and examinations. Days the school is closed for attendance are set under Academic years."
        actions={manage ? <Button onClick={() => setAdding(today())}>New event</Button> : undefined}
      />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Previous</Button>
        <Button variant="outline" size="sm" onClick={() => { const d = new Date(`${today()}T00:00:00`); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
        <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next</Button>
        <h2 className="ml-2 text-lg font-semibold">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
      </div>
      {events.isError ? <ErrorState error={events.error} onRetry={() => events.refetch()} /> : (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
          {WEEK_DAYS.map((d) => <div key={d} className="bg-muted p-2 text-center text-xs font-medium">{d}</div>)}
          {cells.map((date, i) => (
            <div key={date ?? `blank-${i}`} className={cn("min-h-24 bg-background p-1", date === today() && "ring-2 ring-inset ring-primary")}>
              {date && (
                <>
                  {manage ? (
                    <button type="button" className="text-xs text-muted-foreground hover:underline" aria-label={`Add an event on ${formatDate(date)}`} onClick={() => setAdding(date)}>{Number(date.slice(8))}</button>
                  ) : <span className="text-xs text-muted-foreground">{Number(date.slice(8))}</span>}
                  <ul className="mt-1 flex flex-col gap-1">
                    {(events.data ?? []).filter((e) => (e.dateFrom ?? "") <= date && (e.dateTo ?? "") >= date).map((e) => (
                      <li key={e.id}>
                        <button type="button" className={cn("w-full truncate rounded px-1 text-left text-xs", EVENT_STYLE[e.type ?? "OTHER"])} onClick={() => setSelected(e)}>{e.title}</button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {adding && <EventDialog date={adding} onClose={() => setAdding(null)} />}
      {selected && (
        <Dialog open onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selected.title}</DialogTitle>
              <DialogDescription>
                {EVENT_TYPES.find((t) => t.value === selected.type)?.label} · {formatDate(selected.dateFrom)}
                {selected.dateTo !== selected.dateFrom ? ` to ${formatDate(selected.dateTo)}` : ""}
              </DialogDescription>
            </DialogHeader>
            {selected.details && <p className="text-sm">{selected.details}</p>}
            {manage && (
              <DialogFooter>
                <Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate(selected.id ?? 0)}>Remove event</Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EventDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const refresh = useRefresh("office", "events");
  const [title, setTitle] = useState("");
  const [dateFrom, setDateFrom] = useState(date);
  const [dateTo, setDateTo] = useState(date);
  const [type, setType] = useState("EVENT");
  const [details, setDetails] = useState("");
  const save = useMutation({
    mutationFn: () => office.addEvent({ title, dateFrom, dateTo, type, details: details || undefined }),
    onSuccess: () => {
      refresh();
      toast.success("Event added");
      onClose();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form className="contents" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>Shows on everyone&apos;s calendar.</DialogDescription>
          </DialogHeader>
          <Field id="ev-title" label="Title"><Input id="ev-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field id="ev-type" label="Type">
            <NativeSelect id="ev-type" value={type} onChange={(e) => setType(e.target.value)}>
              {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </NativeSelect>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="ev-from" label="First day"><Input id="ev-from" type="date" required value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); if (dateTo < e.target.value) setDateTo(e.target.value); }} /></Field>
            <Field id="ev-to" label="Last day"><Input id="ev-to" type="date" required min={dateFrom} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
          </div>
          <Field id="ev-details" label="Details"><Textarea id="ev-details" rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!title.trim() || save.isPending}>Save event</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ visitors

/** The visitor log (FR 3.9). */
export function VisitorsPage() {
  const can = useCan();
  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const list = useQuery({ queryKey: ["office", "visitors", date], queryFn: () => office.visitors(date) });
  const refresh = useRefresh("office", "visitors");
  const add = useMutation({
    mutationFn: () => {
      const now = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour12: false });
      return office.addVisitor({ date, name, purpose: purpose || undefined, timeIn: date === today() ? now : undefined });
    },
    onSuccess: () => { refresh(); setName(""); setPurpose(""); },
    onError,
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Visitors" description="Who came to the school." />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="vs-date" label="Date"><Input id="vs-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {can(P.OFFICE_VISITORS_MANAGE) && (
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <Field id="vs-name" label="Visitor"><Input id="vs-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field id="vs-purpose" label="Purpose"><Input id="vs-purpose" maxLength={300} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
            <Button type="submit" disabled={!name.trim() || add.isPending}>Add visitor</Button>
          </form>
        )}
      </div>
      {list.isPending ? <Loading /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.length === 0 ? (
        <Empty title="No visitors recorded for this day" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Visitor</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Recorded by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((v) => (
              <TableRow key={v.id}>
                <TableCell>{v.timeIn ? v.timeIn.slice(0, 5) : "—"}</TableCell>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell>{v.purpose ?? "—"}</TableCell>
                <TableCell>{v.createdBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- birthdays

/** Upcoming birthdays of students and staff, with a wish by SMS (FR 3.4). */
export function BirthdaysPage() {
  const can = useCan();
  const [days, setDays] = useState(30);
  const list = useQuery({ queryKey: ["office", "birthdays", days], queryFn: () => office.birthdays(days) });
  const refresh = useRefresh("office", "birthdays");
  const wish = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) => office.wish(type, id),
    onSuccess: (r) => {
      refresh();
      if (r.noPhone) toast.error("No phone number for messages");
      else toast.success(r.alreadySent ? "Already wished this year" : "Birthday wish queued");
    },
    onError,
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Birthdays" description="Students go to the family's phone; staff to their own." />
      <Field id="bd-days" label="Coming up in" className="max-w-xs">
        <NativeSelect id="bd-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
          <option value={366}>The whole year</option>
        </NativeSelect>
      </Field>
      {list.isPending ? <Loading /> : list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.data.length === 0 ? (
        <Empty title="No birthdays in these days" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Class or role</TableHead>
              <TableHead>Birthday</TableHead>
              <TableHead className="text-right">Days left</TableHead>
              <TableHead className="sr-only">Wish</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.map((b) => (
              <TableRow key={`${b.personType}-${b.id}`}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.detail ?? "—"}</TableCell>
                <TableCell>{formatDate(b.birthday)}</TableCell>
                <TableCell className="text-right tabular-nums">{b.daysLeft === 0 ? "Today" : b.daysLeft}</TableCell>
                <TableCell className="text-right">
                  {b.wished ? <span className="text-xs text-muted-foreground">Wished</span> : can(P.MESSAGES_SEND) && (
                    <Button variant="outline" size="sm" aria-label={`Send a wish to ${b.name}`} disabled={wish.isPending} onClick={() => wish.mutate({ type: b.personType ?? "", id: b.id ?? 0 })}>Send wish</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
