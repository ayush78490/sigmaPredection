"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Header from "@/components/header"
import TradeModal from "@/components/trade-modal"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Volume2, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Market, MARKETS } from "@/lib/markets"

export default function MarketPage() {
  const params = useParams()
  const marketSlug = params.slug as string
  const market = MARKETS.find((m) => m.slug === marketSlug)

  const [outcome, setOutcome] = useState<"YES" | "NO" | null>(null)
  const [showModal, setShowModal] = useState(false)

  if (!market) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-muted-foreground">Market not found.</p>
          <Link href="/">
            <Button variant="outline" className="mt-4 bg-transparent">
              Back to Markets
            </Button>
          </Link>
        </div>
      </main>
    )
  }

  const resolutionDate = new Date(market.resolutionDate)
  const daysLeft = Math.max(0, Math.ceil((resolutionDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}m`
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`
    return `$${vol}`
  }

  const handleOpenModal = (selectedOutcome: "YES" | "NO") => {
    setOutcome(selectedOutcome)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setOutcome(null)
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link href="/">
          <Button variant="ghost" className="mb-6 -ml-4 gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Markets
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Category Badge */}
            <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {market.category}
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold text-balance">{market.title}</h1>

            {/* Description */}
            <p className="text-lg text-muted-foreground">{market.description}</p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Volume2 className="w-4 h-4" />
                  Trading Volume
                </div>
                <p className="text-2xl font-bold">{formatVolume(market.volume)}</p>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Days Remaining
                </div>
                <p className="text-2xl font-bold">{daysLeft}d</p>
              </Card>
            </div>

            {/* Resolution Date */}
            <Card className="p-4 bg-muted">
              <p className="text-sm text-muted-foreground mb-1">Resolution Date</p>
              <p className="font-semibold">
                {resolutionDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </Card>
          </div>

          {/* Sidebar - Odds Card */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-8 space-y-6">
              <h2 className="text-xl font-bold">Current Odds</h2>

              {/* YES/NO Odds */}
              <div className="space-y-3">
                {/* YES */}
                <button
                  onClick={() => handleOpenModal("YES")}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    outcome === "YES"
                      ? "border-green-500 bg-green-950/30"
                      : "border-green-900 bg-green-950/10 hover:bg-green-950/20"
                  }`}
                >
                  <div className="text-left">
                    <div className="text-sm text-muted-foreground mb-1">YES</div>
                    <div className="text-3xl font-bold text-green-500">{market.yesOdds}%</div>
                    <div className="text-xs text-green-400 mt-1">${(market.yesOdds / 100).toFixed(2)} per token</div>
                  </div>
                </button>

                {/* NO */}
                <button
                  onClick={() => handleOpenModal("NO")}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    outcome === "NO"
                      ? "border-red-500 bg-red-950/30"
                      : "border-red-900 bg-red-950/10 hover:bg-red-950/20"
                  }`}
                >
                  <div className="text-left">
                    <div className="text-sm text-muted-foreground mb-1">NO</div>
                    <div className="text-3xl font-bold text-red-500">{market.noOdds}%</div>
                    <div className="text-xs text-red-400 mt-1">${(market.noOdds / 100).toFixed(2)} per token</div>
                  </div>
                </button>
              </div>

              {/* Trade Info */}
              {outcome && (
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Click the button below to place your order
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Trade Modal */}
      {showModal && (
        <TradeModal market={market} outcome={outcome} onOutcomeChange={setOutcome} onClose={handleCloseModal} />
      )}
    </main>
  )
}
