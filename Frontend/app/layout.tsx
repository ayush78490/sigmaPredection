"use client"

import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { useEffect, useState } from "react"

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
})

// export const metadata: Metadata = {
//   title: "PredictMarket",
//   description: "Decentralized Prediction Market on BNB Smart Chain",
//   generator: "Ayush",
// }

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent flash of unstyled content
  if (!mounted) {
    return null
  }

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} font-sans antialiased`}>
        <Providers>
          {children}
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
