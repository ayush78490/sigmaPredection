"use client"

import { useState } from "react"
import { X, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useWeb3Context } from "@/lib/wallet-context"
import { usePredictionMarket } from "@/hooks/use-predection-market"
import React from "react"

interface TradeModalProps {
  market: any;
  outcome: "YES" | "NO" | null;
  onOutcomeChange: (o: "YES" | "NO") => void;
  onClose: () => void;
}

export default function TradeModal({ 
  market, 
  outcome, 
  onOutcomeChange, 
  onClose 
}: TradeModalProps) {
  const [amount, setAmount] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const { account, connectWallet, isConnecting, isCorrectNetwork, switchNetwork, signer } = useWeb3Context()
  const { contract } = usePredictionMarket() // Instead of getAmountOut, just get contract with ABI/address

  const numAmount = parseFloat(amount) || 0
  const hasAmount = numAmount > 0
  const outcomeLabel = outcome === "YES" ? "YES" : outcome === "NO" ? "NO" : "outcome"

  const handleTrade = async () => {
    if (!account) {
      await connectWallet()
      return
    }
    if (!isCorrectNetwork) {
      await switchNetwork()
      return
    }
    if (!amount || numAmount <= 0) {
      setError("Please enter a valid BNB amount")
      return
    }
    if (!outcome) {
      setError("Please select YES or NO")
      return
    }
    if (!signer || !contract) {
      setError("Wallet provider/contract not ready")
      return
    }
    setIsProcessing(true)
    setError(null)
    setTxHash(null)
    try {
      const { ethers } = await import("ethers")
      const amountInWei = ethers.parseEther(amount)
      const minTokensOut = 0 // For slippage tolerance, use output from `getAmountOut` if desired

      let tx
      if (outcome === "YES") {
        tx = await contract.buyYesWithBNB(market.id, minTokensOut, { value: amountInWei })
      } else {
        tx = await contract.buyNoWithBNB(market.id, minTokensOut, { value: amountInWei })
      }
      setTxHash(tx.hash)
      await tx.wait()
      setAmount("")
      setTimeout(onClose, 2000)
    } catch (err: any) {
      setError(err.reason || err.message || "Transaction failed")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-md sm:max-w-lg rounded-lg shadow-lg overflow-auto">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{market?.question || "Trade"}</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Outcome Selection */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                className="flex-1"
                variant={outcome === "YES" ? "default" : "outline"}
                onClick={() => onOutcomeChange("YES")}
              >
                YES
              </Button>
              <Button
                className="flex-1"
                variant={outcome === "NO" ? "default" : "outline"}
                onClick={() => onOutcomeChange("NO")}
              >
                NO
              </Button>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Amount (BNB)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
              />
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {/* Transaction Hash */}
            {txHash && (
              <p className="text-sm text-green-500">
                Transaction submitted! Hash: {txHash.slice(0, 10)}...
              </p>
            )}

            {/* Action Button */}
            <Button
              className="w-full"
              onClick={handleTrade}
              disabled={isProcessing || !hasAmount}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {!account ? "Connect Wallet" :
               !isCorrectNetwork ? "Switch Network" :
               !outcome ? "Select Outcome" :
               `Buy ${outcomeLabel} Tokens`}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
