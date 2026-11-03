"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Shows a temporary password or setup link that will not be shown again, with a copy button. */
export function SecretOnce({ title, value, note }: { title: string; value: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{note}</span>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {value}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
