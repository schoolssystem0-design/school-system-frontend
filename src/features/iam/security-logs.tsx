"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { iam } from "@/lib/api/endpoints";
import { formatDateTime } from "@/lib/format";

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      Page {page + 1} of {totalPages}
      <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

/** Sign-ins and failed attempts (FR 2.7). */
export function LoginHistoryPage() {
  const [filters, setFilters] = useState({ username: "", result: "", from: "", to: "" });
  const [page, setPage] = useState(0);
  const params = Object.fromEntries(
    Object.entries({ ...filters, page: String(page) }).filter(([, v]) => v !== ""),
  ) as Record<string, string>;
  const logins = useQuery({ queryKey: ["iam", "logins", params], queryFn: () => iam.logins(params) });
  const set = (key: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Login history" description="Successful, wrong and blocked sign-in attempts." />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="l-user" label="Username">
          <Input id="l-user" value={filters.username} onChange={set("username")} className="w-44" />
        </Field>
        <Field id="l-result" label="Result">
          <NativeSelect id="l-result" className="w-36" value={filters.result} onChange={set("result")}>
            <option value="">All</option>
            <option value="SUCCESS">Successful</option>
            <option value="INVALID">Wrong password</option>
            <option value="BLOCKED">Blocked</option>
          </NativeSelect>
        </Field>
        <Field id="l-from" label="From">
          <Input id="l-from" type="date" value={filters.from} onChange={set("from")} />
        </Field>
        <Field id="l-to" label="To">
          <Input id="l-to" type="date" value={filters.to} onChange={set("to")} />
        </Field>
      </div>
      <Card>
        <CardContent className="p-0">
          {logins.isPending ? (
            <Loading />
          ) : logins.isError ? (
            <ErrorState error={logins.error} onRetry={() => logins.refetch()} />
          ) : logins.data.items.length === 0 ? (
            <div className="p-6">
              <Empty title="No sign-ins match" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Network</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logins.data.items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDateTime(l.at)}</TableCell>
                    <TableCell>
                      {l.displayName ?? l.username} <span className="text-muted-foreground">({l.username})</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.result === "SUCCESS" ? "default" : "destructive"}>
                        {l.result === "SUCCESS" ? "Successful" : l.result === "INVALID" ? "Wrong password" : "Blocked"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {l.ip}
                      {l.newLocation && <Badge variant="outline" className="ms-2">New location</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {logins.data && <Pager page={page} totalPages={logins.data.totalPages} onPage={setPage} />}
    </div>
  );
}

/** Who did what and when, with old and new values (FR 2.8). */
export function ActivityPage() {
  const [filters, setFilters] = useState({ q: "", from: "", to: "" });
  const [page, setPage] = useState(0);
  const params = Object.fromEntries(
    Object.entries({ ...filters, page: String(page) }).filter(([, v]) => v !== ""),
  ) as Record<string, string>;
  const activity = useQuery({ queryKey: ["iam", "activity", params], queryFn: () => iam.activity(params) });
  const [open, setOpen] = useState<number | null>(null);
  const set = (key: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Activity history" description="Every change, with the person, time and old and new values." />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="a-q" label="Search">
          <Input id="a-q" value={filters.q} onChange={set("q")} placeholder="Action, name or value" className="w-64" />
        </Field>
        <Field id="a-from" label="From">
          <Input id="a-from" type="date" value={filters.from} onChange={set("from")} />
        </Field>
        <Field id="a-to" label="To">
          <Input id="a-to" type="date" value={filters.to} onChange={set("to")} />
        </Field>
      </div>
      <Card>
        <CardContent className="p-0">
          {activity.isPending ? (
            <Loading />
          ) : activity.isError ? (
            <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
          ) : activity.data.items.length === 0 ? (
            <div className="p-6">
              <Empty title="No activity matches" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.data.items.map((a) => (
                  <TableRow key={a.id} className="align-top">
                    <TableCell className="whitespace-nowrap">{formatDateTime(a.at)}</TableCell>
                    <TableCell>{a.actorName ?? (a.actorType === "SYSTEM" ? "System" : "—")}</TableCell>
                    <TableCell>
                      <code className="text-xs">{a.action}</code>
                      {a.reason && <p className="text-xs text-muted-foreground">Reason: {a.reason}</p>}
                    </TableCell>
                    <TableCell>
                      {(a.before || a.after) && (
                        <Button size="sm" variant="ghost" onClick={() => setOpen(open === a.id ? null : (a.id ?? null))}>
                          {open === a.id ? "Hide" : "Show"} changes
                        </Button>
                      )}
                      {open === a.id && (
                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                          <pre className="overflow-x-auto rounded bg-muted p-2">Before: {pretty(a.before)}</pre>
                          <pre className="overflow-x-auto rounded bg-muted p-2">After: {pretty(a.after)}</pre>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {activity.data && <Pager page={page} totalPages={activity.data.totalPages} onPage={setPage} />}
    </div>
  );
}

function pretty(json?: string | null) {
  if (!json) return "—";
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}
