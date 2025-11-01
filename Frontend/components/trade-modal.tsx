"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X } from "lucide-react"
import type { Market } from "@/lib/markets"

interface TradeModalProps {
  market: Market | null
  outcome: "YES" | "NO" | null
  onOutcomeChange: (outcome: "YES" | "NO") => void
  onClose: () => void
}

export default function TradeModal({ market, outcome, onOutcomeChange, onClose }: TradeModalProps) {
  const [amount, setAmount] = useState<string>("100")
  const [isLoading, setIsLoading] = useState(false)

  if (!market) return null

  const odds = outcome === "YES" ? market.yesOdds : market.noOdds
  const tokens = Number.parseFloat(amount) / (odds / 100) || 0
  const color = outcome === "YES" ? "green" : outcome === "NO" ? "red" : "gray"

  const handleTrade = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
    alert(`Order placed: Buy ${tokens.toFixed(2)} ${outcome} tokens for $${amount}`)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-card border-l border-border shadow-xl transition-transform duration-300 z-50 translate-x-0">
        <div className="p-6 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Place Order</h2>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Market Info */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-2">Market</p>
            <h3 className="font-semibold line-clamp-2">{market.title}</h3>
          </div>

          {/* Outcome Selection */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              variant={outcome === "YES" ? "default" : "outline"}
              className={
                outcome === "YES"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "border-green-200 dark:border-green-900"
              }
              onClick={() => onOutcomeChange("YES")}
            >
              Buy YES
            </Button>
            <Button
              variant={outcome === "NO" ? "default" : "outline"}
              className={
                outcome === "NO" ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-200 dark:border-red-900"
              }
              onClick={() => onOutcomeChange("NO")}
            >
              Buy NO
            </Button>
          </div>

          {/* Odds Display */}
          {outcome && (
            <Card className="bg-muted p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Current Odds</p>
                  <p className="text-2xl font-bold">{odds}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Price per Token</p>
                  <p className="text-2xl font-bold">${(odds / 100).toFixed(2)}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Amount Input */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={!outcome}
            />
          </div>

          {/* Preview */}
          {outcome && (
            <Card className="bg-muted p-4 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">You will receive:</span>
                  <span className="font-semibold">
                    {tokens.toFixed(4)} {outcome} tokens
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg price:</span>
                  <span className="font-semibold">${(odds / 100).toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold">
                  <span>Total:</span>
                  <span>${amount}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Trade Button */}
          <Button
            onClick={handleTrade}
            disabled={!outcome || !amount || isLoading}
            className={`w-full py-3 font-semibold ${
              outcome === "YES"
                ? "bg-green-600 hover:bg-green-700"
                : outcome === "NO"
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
            }`}
          >
            {isLoading ? "Processing..." : `Buy ${outcome} Tokens`}
          </Button>

          {/* Note */}
          <p className="text-xs text-muted-foreground mt-4 text-center">
            All trades are final. Please review before confirming.
          </p>
        </div>
      </div>
    </>
  )
}
