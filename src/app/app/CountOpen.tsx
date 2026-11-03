"use client";

import { useEffect } from "react";
import { countUsage } from "@/lib/usage";

// Once per page load: the shell stays between the app's pages, and a remount (React runs effects twice while
// developing) does not count again.
let counted = false;

/** Counts that the app was opened (src/lib/usage.ts). Draws nothing. */
export function CountOpen() {
  useEffect(() => {
    if (counted) return;
    counted = true;
    countUsage("open");
  }, []);
  return null;
}
