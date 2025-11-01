"use client"

import { WalletProvider } from "@/lib/wallet-context"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>
}
