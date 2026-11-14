import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A summary number on a card: label, value, an optional detail line and icon. */
export function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "primary" | "warning" | "danger" | "success";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-highlight/15 text-highlight-ink",
    danger: "bg-destructive/10 text-destructive",
    success: "bg-emerald-500/10 text-emerald-700",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {detail && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{detail}</p>}
        </div>
        {Icon && (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
