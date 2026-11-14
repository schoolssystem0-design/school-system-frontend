"use client";

import { createContext, useContext } from "react";

/** True once the data saved on this device (for offline work) is back in the query cache. */
export const CacheRestoredContext = createContext(false);

export const useCacheRestored = () => useContext(CacheRestoredContext);
