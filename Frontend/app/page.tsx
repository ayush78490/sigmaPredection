"use client"

import { useEffect } from "react"
import { useWeb3Context } from "@/lib/wallet-context"
import { useRouter } from "next/navigation"
import LandingPage from "./landing-page"

export default function Home() {
  const { account, isInitialized } = useWeb3Context()
  const router = useRouter()

  return <LandingPage />
}