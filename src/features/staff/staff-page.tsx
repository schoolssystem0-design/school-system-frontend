"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { staff } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { P } from "@/lib/permissions";
import { Pager, useCan } from "@/features/people/shared";
import { staffBody, StaffForm, staffFrom } from "./staff-form";

/** Teachers and other staff (FR 3.1–3.4). */
export function StaffPage() {
  const can = useCan();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const params = { q, category, status, page };
  const list = useQuery({ queryKey: ["staff", "list", params], queryFn: () => staff.list(params) });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff"
        description="Teachers and other staff. Each person can be given their own sign-in."
        actions={
          can(P.STAFF_MANAGE) && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden /> Add staff
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field id="sf-search" label="Search">
          <Input
            id="sf-search"
            className="w-60"
            placeholder="Name, employee no., phone"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </Field>
        <Field id="sf-cat" label="Type">
          <NativeSelect id="sf-cat" className="w-36" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            <option value="TEACHER">Teachers</option>
            <option value="OTHER">Other staff</option>
          </NativeSelect>
        </Field>
        <Field id="sf-status" label="Status">
          <NativeSelect id="sf-status" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Working</option>
            <option value="LEFT">Left</option>
            <option value="">All</option>
          </NativeSelect>
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
              <Empty title="No staff found" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee no.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.employeeNo}</TableCell>
                    <TableCell>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/app/staff/${s.id}`}>
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>{s.designation}</TableCell>
                    <TableCell>{s.phone ?? "—"}</TableCell>
                    <TableCell>{formatDate(s.joiningDate)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>
                        {s.status === "ACTIVE" ? "Working" : "Left"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Pager page={page} totalPages={list.data?.totalPages} onChange={setPage} />
      {creating && <NewStaffDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewStaffDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(staffFrom());
  const create = useMutation({
    mutationFn: () => staff.create(staffBody(value)),
    onSuccess: (s) => {
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success(`${s.details?.name} added as ${s.employeeNo}`);
      router.push(`/app/staff/${s.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
          </DialogHeader>
          <StaffForm value={value} onChange={setValue} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Add staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
