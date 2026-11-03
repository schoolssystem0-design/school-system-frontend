"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/client";
import { families } from "@/lib/api/people";
import { P } from "@/lib/permissions";
import { Pager, useCan } from "@/features/people/shared";
import { emptyFamily, familyBody, FamilyForm } from "./family-form";

/** Families: one record per household, shared by siblings (FR 5.2, 8.5). */
export function FamiliesPage() {
  const can = useCan();
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Families"
        description="Parents' details are kept once per family and shared by all brothers and sisters."
        actions={
          can(P.FAMILIES_MANAGE) && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden /> Add family
            </Button>
          )
        }
      />
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">All families</TabsTrigger>
          <TabsTrigger value="issues">Data issues</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          <FamilyList />
        </TabsContent>
        <TabsContent value="issues" className="mt-4">
          <DataIssues />
        </TabsContent>
      </Tabs>
      {creating && <NewFamilyDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function FamilyList() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const list = useQuery({ queryKey: ["families", "list", q, page], queryFn: () => families.list({ q, page }) });
  return (
    <div className="flex flex-col gap-4">
      <Field id="family-search" label="Search">
        <Input
          id="family-search"
          className="w-72"
          placeholder="Family no., parent name, phone or CNIC"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
      </Field>
      <Card>
        <CardContent className="p-0">
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.items.length === 0 ? (
            <div className="p-6">
              <Empty title="No families found" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Family no.</TableHead>
                  <TableHead>Father</TableHead>
                  <TableHead>Mother</TableHead>
                  <TableHead>Father&apos;s mobile</TableHead>
                  <TableHead className="text-right">Children studying</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/app/families/${f.id}`}>
                        {f.familyNo}
                      </Link>
                    </TableCell>
                    <TableCell>{f.fatherName ?? "—"}</TableCell>
                    <TableCell>{f.motherName ?? "—"}</TableCell>
                    <TableCell>{f.fatherPhone ?? "—"}</TableCell>
                    <TableCell className="text-right">{f.children}</TableCell>
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

function DataIssues() {
  const issues = useQuery({ queryKey: ["families", "issues"], queryFn: families.dataIssues });
  if (issues.isPending) return <Loading />;
  if (issues.isError) return <ErrorState error={issues.error} onRetry={() => issues.refetch()} />;
  if (issues.data.length === 0) return <Empty title="No data issues">Every family has a phone number and children.</Empty>;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Family no.</TableHead>
              <TableHead>Father</TableHead>
              <TableHead>Issue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.data.map((i, index) => (
              <TableRow key={`${i.familyId}-${index}`}>
                <TableCell>
                  <Link className="font-medium underline-offset-4 hover:underline" href={`/app/families/${i.familyId}`}>
                    {i.familyNo}
                  </Link>
                </TableCell>
                <TableCell>{i.fatherName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{i.issue}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewFamilyDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(emptyFamily());
  const create = useMutation({
    mutationFn: () => families.create(familyBody(value)),
    onSuccess: (family) => {
      void queryClient.invalidateQueries({ queryKey: ["families"] });
      toast.success(`Family ${family.familyNo} created`);
      router.push(`/app/families/${family.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add family</DialogTitle>
          </DialogHeader>
          <FamilyForm idPrefix="nf" value={value} onChange={setValue} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create family"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
