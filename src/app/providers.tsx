"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { CacheRestoredContext } from "@/lib/offline/restored";
import { keepCacheSaved, restoreCache } from "@/lib/offline/persist";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Never retry auth/permission/validation errors; retry other failures once.
            retry: (count, error) =>
              !(error instanceof ApiError && error.status < 500) && count < 1,
          },
        },
      }),
  );
  // The data saved on this device for offline work is put back first; the signed-in area waits for it.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let stop: (() => void) | undefined;
    void restoreCache(client).finally(() => {
      setRestored(true);
      stop = keepCacheSaved(client);
    });
    return () => stop?.();
  }, [client]);

  useEffect(() => {
    // Lets the app open with no internet (production only: development reloads code all the time).
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }
  }, []);

  return (
    <QueryClientProvider client={client}>
      <CacheRestoredContext.Provider value={restored}>{children}</CacheRestoredContext.Provider>
    </QueryClientProvider>
  );
}
