"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { newKey } from "@/lib/api/fees";
import { messages, type MessageRequest, type Template } from "@/lib/api/office";
import { formatDateTime, formatMoney } from "@/lib/format";
import { P } from "@/lib/permissions";
import { ClassSelect, SectionSelect, useCan } from "@/features/people/shared";

const onError = (e: unknown) => toast.error(errorMessage(e));

const STATUS_LABEL: Record<string, string> = { PENDING: "Waiting", SENT: "Sent", FAILED: "Failed" };

/** Messages to families, enquiries and staff, the delivery log and template wording (FR 8.6, 4.3). */
export function MessagesPage() {
  const can = useCan();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Messages" description="SMS to families, enquiries and staff. You see who gets it and the cost before sending." />
      <Tabs defaultValue={can(P.MESSAGES_SEND) ? "send" : "log"}>
        <TabsList>
          {can(P.MESSAGES_SEND) && <TabsTrigger value="send">Send a message</TabsTrigger>}
          <TabsTrigger value="log">Delivery log</TabsTrigger>
          <TabsTrigger value="templates">Automatic messages</TabsTrigger>
        </TabsList>
        <TabsContent value="send" className="mt-4"><SendPanel /></TabsContent>
        <TabsContent value="log" className="mt-4"><LogPanel /></TabsContent>
        <TabsContent value="templates" className="mt-4"><TemplatesPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function SendPanel() {
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState("ALL_FAMILIES");
  const [classId, setClassId] = useState<number | "">("");
  const [sectionId, setSectionId] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const request: MessageRequest = {
    audience,
    message,
    classId: (audience === "CLASS" || audience === "ENQUIRIES") && classId !== "" ? classId : undefined,
    sectionId: audience === "SECTION" && sectionId !== "" ? sectionId : undefined,
  };
  const signature = JSON.stringify(request);
  // One key per distinct message, so a retry of the same send never messages a phone twice
  const key = useMemo(() => newKey(), [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = useMutation({ mutationFn: () => messages.preview(request), onError });
  const send = useMutation({
    mutationFn: () => messages.send(request, key),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
      preview.reset();
      setMessage("");
      toast.success(`${r.queued} messages queued${r.alreadyQueued ? `, ${r.alreadyQueued} already sent` : ""}${r.noPhone ? `, ${r.noPhone} without a phone` : ""}`);
    },
    onError,
  });
  const ready = message.trim() && !(audience === "CLASS" && classId === "") && !(audience === "SECTION" && sectionId === "");
  const reset = () => preview.reset();
  const p = preview.data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
          <CardDescription>{"You can write {name} for each person's name. The school's message signature is added at the end."}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field id="ms-audience" label="Send to">
            <NativeSelect id="ms-audience" value={audience} onChange={(e) => { setAudience(e.target.value); reset(); }}>
              <option value="ALL_FAMILIES">All families</option>
              <option value="CLASS">Families of a class</option>
              <option value="SECTION">Families of a section</option>
              <option value="ENQUIRIES">Enquiries still open</option>
              <option value="STAFF">All staff</option>
            </NativeSelect>
          </Field>
          {(audience === "CLASS" || audience === "ENQUIRIES") && (
            <Field id="ms-class" label="Class">
              <ClassSelect id="ms-class" emptyLabel={audience === "ENQUIRIES" ? "All classes" : "Choose a class"} value={classId} onChange={(v) => { setClassId(v); reset(); }} />
            </Field>
          )}
          {audience === "SECTION" && (
            <Field id="ms-section" label="Section">
              <SectionSelect id="ms-section" value={sectionId} onChange={(v) => { setSectionId(v); reset(); }} />
            </Field>
          )}
          <Field id="ms-text" label="Message">
            <Textarea id="ms-text" rows={5} maxLength={500} value={message} onChange={(e) => { setMessage(e.target.value); reset(); }} />
          </Field>
          <div>
            <Button variant="outline" disabled={!ready || preview.isPending} onClick={() => preview.mutate()}>Check before sending</Button>
          </div>
        </CardContent>
      </Card>
      {p && (
        <Card>
          <CardHeader>
            <CardTitle>Before you send</CardTitle>
            <CardDescription>{p.recipients} people will get this{(p.noPhone ?? 0) > 0 ? `; ${p.noPhone} have no phone number` : ""}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="rounded-md bg-muted p-3">{p.sampleMessage}</p>
            <p>
              {p.characters} characters, {p.parts} SMS {p.parts === 1 ? "part" : "parts"} each ({p.encoding}).{" "}
              {p.totalParts} parts in total, about <span className="font-semibold">{formatMoney(p.estimatedCost)}</span>.
            </p>
            {p.encoding === "UCS-2" && (
              <Alert>
                <AlertTitle>A special character makes this cost more</AlertTitle>
                <AlertDescription>Characters such as curly quotes shorten each SMS part to 70 characters. Plain quotes avoid this.</AlertDescription>
              </Alert>
            )}
            <details>
              <summary className="cursor-pointer">First recipients</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {(p.sample ?? []).map((r) => <li key={r.phone}>{r.name}, {r.phone}</li>)}
              </ul>
            </details>
            <div>
              <Button disabled={send.isPending || p.recipients === 0} onClick={() => send.mutate()}>{send.isPending ? "Sending…" : `Send to ${p.recipients}`}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LogPanel() {
  const can = useCan();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const log = useQuery({ queryKey: ["messages", "log", status], queryFn: () => messages.log({ status: status || undefined }) });
  const retry = useMutation({
    mutationFn: messages.retry,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast.success("It will be sent again");
    },
    onError,
  });
  if (log.isPending) return <Loading />;
  if (log.isError) return <ErrorState error={log.error} onRetry={() => log.refetch()} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Last 30 days: {(log.data.last30Days ?? []).map((c) => `${STATUS_LABEL[c.status ?? ""] ?? c.status} ${c.count}`).join(", ") || "nothing sent"}.
      </p>
      <Field id="lg-status" label="Show" className="max-w-xs">
        <NativeSelect id="lg-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="PENDING">Waiting</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
        </NativeSelect>
      </Field>
      {(log.data.messages ?? []).length === 0 ? <Empty title="No messages" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="sr-only">Retry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(log.data.messages ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                <TableCell>{m.recipient}</TableCell>
                <TableCell className="text-sm">{m.body}</TableCell>
                <TableCell>
                  {STATUS_LABEL[m.status ?? ""] ?? m.status}
                  {m.lastError && m.status !== "SENT" && <span className="block text-xs text-muted-foreground">{m.lastError}</span>}
                </TableCell>
                <TableCell>
                  {m.status === "FAILED" && can(P.MESSAGES_SEND) && (
                    <Button variant="outline" size="sm" disabled={retry.isPending} onClick={() => retry.mutate(m.id ?? 0)}>Send again</Button>
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

function TemplatesPanel() {
  const list = useQuery({ queryKey: ["messages", "templates"], queryFn: messages.templates });
  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {list.data.map((t) => <TemplateCard key={`${t.code}-${t.body}`} template={t} />)}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const can = useCan();
  const queryClient = useQueryClient();
  const [body, setBody] = useState(template.body ?? "");
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["messages", "templates"] });
    toast.success("Template saved");
  };
  const save = useMutation({ mutationFn: () => messages.saveTemplate(template.code ?? "", body), onSuccess: done, onError });
  const reset = useMutation({ mutationFn: () => messages.resetTemplate(template.code ?? ""), onSuccess: done, onError });
  const editable = can(P.MESSAGES_TEMPLATES_MANAGE);
  const id = `tp-${template.code}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{template.label}</CardTitle>
        <CardDescription>You can use: {(template.placeholders ?? []).map((p) => `{${p}}`).join(", ")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field id={id} label="Wording">
          <Textarea id={id} rows={4} maxLength={500} disabled={!editable} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {editable && (
          <div className="flex gap-2">
            <Button size="sm" disabled={!body.trim() || body === template.body || save.isPending} onClick={() => save.mutate()}>Save</Button>
            {template.customised && <Button size="sm" variant="ghost" disabled={reset.isPending} onClick={() => reset.mutate()}>Use the standard wording</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
