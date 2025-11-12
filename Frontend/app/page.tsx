"use client"

import { useEffect } from "react"
import { useWeb3Context } from "@/lib/wallet-context"
import { useRouter } from "next/navigation"
import LandingPage from "./landing-page"

export default function Home() {
  const { account, isInitialized } = useWeb3Context()
  const router = useRouter()

  useEffect(() => {
    // If wallet is connected and initialized, redirect to markets page
    if (isInitialized && account) {
      router.push('/markets')
    }
  }, [account, isInitialized, router])

  // Show landing page while:
  // - Still initializing
  // - Not connected
  // - Or during redirect
  return <LandingPage />
}