"use client";

import { SessionProvider } from "next-auth/react";
import { PwaProvider } from "./pwa";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><PwaProvider>{children}</PwaProvider></SessionProvider>;
}
