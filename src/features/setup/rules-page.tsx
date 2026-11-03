"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorState, Loading } from "@/components/app/data-state";
import { Field } from "@/components/app/field";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { settings, type Setting } from "@/lib/api/endpoints";
import { formatDateTime, formatMoney } from "@/lib/format";
import { can, P } from "@/lib/permissions";
import { useMe } from "@/features/shell/app-shell";
import { useStepUp } from "@/features/step-up/step-up-provider";

/** School rules (FR 12): one place to change policies; each change needs a reason and is kept in history. */
export function RulesPage() {
  const me = useMe();
  const editable = can(me.data?.permissions, P.SETTINGS_EDIT);
  const list = useQuery({ queryKey: ["settings"], queryFn: settings.list });
  const [editing, setEditing] = useState<Setting | null>(null);
  const [history, setHistory] = useState<Setting | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const s of list.data ?? []) {
      const label = s.groupLabel ?? s.group ?? "";
      map.set(label, [...(map.get(label) ?? []), s]);
    }
    return [...map.entries()];
  }, [list.data]);

  if (list.isPending) return <Loading />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Rules & settings"
        description="Changes apply from now on in every screen, printout and message that uses the rule."
      />
      {groups.map(([group, items]) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle>{group}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {items.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                    {s.changedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Changed {formatDateTime(s.changedAt)} by {s.changedBy}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{display(s, s.value)}</span>
                    {s.isDefault && <Badge variant="outline">Default</Badge>}
                    <Button size="icon-sm" variant="ghost" aria-label={`History of ${s.label}`} onClick={() => setHistory(s)}>
                      <History aria-hidden />
                    </Button>
                    {editable && (
                      <Button size="icon-sm" variant="ghost" aria-label={`Change ${s.label}`} onClick={() => setEditing(s)}>
                        <Pencil aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
      {editing && <EditDialog setting={editing} onClose={() => setEditing(null)} />}
      {history && <HistoryDialog setting={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function display(s: Setting, value: unknown) {
  if (s.type === "BOOLEAN") return value ? "Yes" : "No";
  if (s.type === "MONEY") return formatMoney(String(value));
  if (value === "" || value == null) return "Not set";
  return String(value);
}

function EditDialog({ setting, onClose }: { setting: Setting; onClose: () => void }) {
  const queryClient = useQueryClient();
  const guard = useStepUp();
  const [value, setValue] = useState<string>(String(setting.value ?? ""));
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () => guard(() => settings.change(setting.key ?? "", value, reason)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success(`${setting.label} changed`);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{setting.label}</DialogTitle>
            <DialogDescription>{setting.description}</DialogDescription>
          </DialogHeader>
          <Field id="setting-value" label="New value">
            {setting.type === "BOOLEAN" ? (
              <NativeSelect id="setting-value" value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </NativeSelect>
            ) : setting.type === "ENUM" ? (
              <NativeSelect id="setting-value" value={value} onChange={(e) => setValue(e.target.value)}>
                {(setting.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input
                id="setting-value"
                type={setting.type === "TIME" ? "time" : "text"}
                inputMode={setting.type === "INTEGER" || setting.type === "MONEY" ? "decimal" : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
          </Field>
          <Field id="setting-reason" label="Reason for the change">
            <Textarea id="setting-reason" required rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || reason.trim() === ""}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ setting, onClose }: { setting: Setting; onClose: () => void }) {
  const history = useQuery({ queryKey: ["settings", "history", setting.key], queryFn: () => settings.history(setting.key ?? "") });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>History · {setting.label}</DialogTitle>
        </DialogHeader>
        {history.isPending ? (
          <Loading />
        ) : history.data && history.data.length > 0 ? (
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {history.data.map((h, i) => (
              <li key={i} className="rounded-md border p-2 text-sm">
                <p className="font-medium">{display(setting, h.value)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(h.changedAt)} · {h.changedByType === "PLATFORM" ? "Super admin: " : ""}
                  {h.changedBy}
                </p>
                <p className="text-xs">{h.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Never changed: the default applies.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
