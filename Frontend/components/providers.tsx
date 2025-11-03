"use client"

import { ThemeProvider } from "next-themes"
import { WalletProvider } from "@/lib/wallet-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <WalletProvider>{children}</WalletProvider>
    </ThemeProvider>
  )
}
