"use client"

import { useState, useEffect, useMemo } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useWeb3Context } from "@/lib/wallet-context"
import { usePredictionMarket } from "@/hooks/use-predection-market"
import { ethers } from "ethers"

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
  const [yesPrice, setYesPrice] = useState<number | null>(null)
  const [noPrice, setNoPrice] = useState<number | null>(null)
  const [expectedOut, setExpectedOut] = useState<string | null>(null)
  const [feeEstimated, setFeeEstimated] = useState<string | null>(null)
  const [slippage, setSlippage] = useState<number>(5)

  const { account, connectWallet, isCorrectNetwork, switchNetwork, signer } = useWeb3Context()
  const { 
    contract, 
    getCurrentMultipliers,
    getBuyYesMultiplier,
    getBuyNoMultiplier
  } = usePredictionMarket()

  const numAmount = parseFloat(amount) || 0
  const hasAmount = numAmount > 0

  // Price normalization from percentage (0-100) to decimal (0-1)
  const normalizedYes = useMemo(() => {
    if (yesPrice === null) return null
    return yesPrice / 100
  }, [yesPrice])

  const normalizedNo = useMemo(() => {
    if (noPrice === null) return null
    return noPrice / 100
  }, [noPrice])

  // Implied odds calculation
  const yesOdds = useMemo(() => {
    if (!normalizedYes || normalizedYes <= 0) return null
    return (1 / normalizedYes)
  }, [normalizedYes])

  const noOdds = useMemo(() => {
    if (!normalizedNo || normalizedNo <= 0) return null
    return (1 / normalizedNo)
  }, [normalizedNo])

  // AMM-based payout multiplier
  const potentialMultiplier = useMemo(() => {
    if (!numAmount || !expectedOut) return null
    const output = parseFloat(expectedOut)
    return output / numAmount
  }, [numAmount, expectedOut])

  // Fetch prices and estimate output
  useEffect(() => {
    let mounted = true
    async function update() {
      if (!contract || !market) return
      try {
        // Get current market prices
        const multipliers = await getCurrentMultipliers(market.id)
        
        if (!mounted) return
        setYesPrice(multipliers.yesPrice)
        setNoPrice(multipliers.noPrice)

        // Estimate trade output if amount and outcome are selected
        if (hasAmount && outcome) {
          try {
            let result
            if (outcome === "YES") {
              result = await getBuyYesMultiplier(market.id, amount)
            } else {
              result = await getBuyNoMultiplier(market.id, amount)
            }
            
            if (!mounted) return
            setExpectedOut(result.totalOut)
            setFeeEstimated(result.totalFee)
          } catch (error) {
            console.error("Error estimating trade:", error)
            // Fallback: use simple probability-based estimation
            const currentPrice = outcome === "YES" ? yesPrice : noPrice
            if (currentPrice && currentPrice > 0) {
              const probability = currentPrice / 100
              const estimatedOut = numAmount / probability
              if (!mounted) return
              setExpectedOut(estimatedOut.toFixed(6))
              setFeeEstimated("0")
            }
          }
        } else {
          if (!mounted) return
          setExpectedOut(null)
          setFeeEstimated(null)
        }
      } catch (err: any) {
        console.error("Price fetch error:", err)
        if (!mounted) return
        setError(err?.reason || err?.message || "Failed to fetch market data")
      }
    }
    update()
    return () => { mounted = false }
  }, [
    contract, 
    market, 
    amount, 
    outcome, 
    getCurrentMultipliers,
    getBuyYesMultiplier,
    getBuyNoMultiplier,
    hasAmount,
    yesPrice,
    noPrice,
    numAmount
  ])

  // Execute trade
  const handleTrade = async () => {
    setError(null)

    // Validation checks
    if (!account) return connectWallet()
    if (!isCorrectNetwork) return switchNetwork()
    if (!amount || numAmount <= 0) return setError("Please enter a valid BNB amount")
    if (!outcome) return setError("Please select YES or NO")
    if (!signer || !contract) return setError("Wallet provider/contract not ready")

    setIsProcessing(true)
    setTxHash(null)

    try {
      const amountInWei = ethers.parseEther(amount)
      
      // Calculate minimum output with user's slippage tolerance
      let minOutWei
      
      if (expectedOut) {
        // Use the fetched expected output
        const minOut = parseFloat(expectedOut) * (1 - slippage / 100)
        
        if (minOut < 1e-18) {
          throw new Error("Minimum output amount is too small. Try a larger trade amount.")
        }
        
        minOutWei = ethers.parseEther(minOut.toFixed(18))
      } else {
        // Fallback: use probability-based estimation
        const currentPrice = outcome === "YES" ? yesPrice : noPrice
        if (!currentPrice || currentPrice <= 0) {
          throw new Error("Invalid market price")
        }
        
        const probability = currentPrice / 100
        const estimatedOut = numAmount / probability
        const minOut = estimatedOut * (1 - slippage / 100)
        
        if (minOut < 1e-18) {
          throw new Error("Minimum output amount is too small. Try a larger trade amount.")
        }
        
        minOutWei = ethers.parseEther(minOut.toFixed(18))
      }

      console.log("Trade details:", {
        marketId: market.id,
        outcome,
        amount: `${numAmount} BNB`,
        expectedOut: expectedOut ? `${parseFloat(expectedOut).toFixed(6)} tokens` : 'estimated',
        minOut: `${ethers.formatEther(minOutWei)} tokens`,
        slippage: `${slippage}%`,
        amountWei: amountInWei.toString(),
        minOutWei: minOutWei.toString()
      })

      const contractWithSigner = contract.connect(signer)
      
      // Execute trade transaction
      let tx
      if (outcome === "YES") {
        tx = await (contractWithSigner as any).buyYesWithBNB(
          BigInt(market.id), 
          minOutWei, 
          { value: amountInWei }
        )
      } else {
        tx = await (contractWithSigner as any).buyNoWithBNB(
          BigInt(market.id), 
          minOutWei, 
          { value: amountInWei }
        )
      }

      setTxHash(tx.hash)
      console.log("Transaction submitted:", tx.hash)
      
      const receipt = await tx.wait()
      console.log("Transaction confirmed:", receipt)
      
      if (receipt.status === 1) {
        setAmount("")
        setTimeout(() => onClose(), 1500) // Give user time to see success message
      } else {
        setError("Transaction failed")
      }
    } catch (err: any) {
      console.error("Trade error:", err)
      
      // Enhanced error handling
      if (err?.message?.includes("slippage exceeded") || err?.reason?.includes("slippage exceeded")) {
        const suggestedSlippage = Math.min(slippage + 3, 15)
        setError(`Slippage exceeded! The market price moved unfavorably. Try:
        • Increasing slippage to ${suggestedSlippage}% or higher
        • Reducing your trade size
        • Waiting a moment and trying again`)
      } else if (err?.code === "INSUFFICIENT_FUNDS" || err?.message?.includes("insufficient funds")) {
        setError("Insufficient BNB balance to complete this trade")
      } else if (err?.message?.includes("insufficient liquidity")) {
        setError("Insufficient liquidity in the market. Try a smaller trade amount.")
      } else if (err?.code === "ACTION_REJECTED" || err?.message?.includes("user rejected")) {
        setError("Transaction was rejected")
      } else if (err?.code === "UNPREDICTABLE_GAS_LIMIT") {
        setError("Unable to estimate gas. Try increasing slippage or reducing amount.")
      } else if (err?.reason) {
        setError(err.reason)
      } else if (err?.message) {
        setError(err.message)
      } else {
        setError("Transaction failed. Please try again.")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const formatMultiplier = (multiplier: number | null) => {
    if (!multiplier) return "-"
    if (multiplier >= 10) return multiplier.toFixed(0) + "x"
    if (multiplier >= 2) return multiplier.toFixed(1) + "x"
    return multiplier.toFixed(2) + "x"
  }

  const formatPercentage = (value: number | null) => {
    if (!value) return "-"
    return value.toFixed(1) + "%"
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-md sm:max-w-lg rounded-lg shadow-lg overflow-auto max-h-[90vh]">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{market?.question || "Trade"}</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Outcome Selection */}
            <div className="flex gap-2">
              <Button 
                className="flex-1"
                variant={outcome === "YES" ? "default" : "outline"}
                onClick={() => onOutcomeChange("YES")}
              >
                <div className="flex flex-col items-center">
                  <span>YES</span>
                  {yesOdds && (
                    <span className="text-xs opacity-80 mt-1">
                      {formatMultiplier(yesOdds)}
                    </span>
                  )}
                </div>
              </Button>

              <Button
                className="flex-1"
                variant={outcome === "NO" ? "default" : "outline"}
                onClick={() => onOutcomeChange("NO")}
              >
                <div className="flex flex-col items-center">
                  <span>NO</span>
                  {noOdds && (
                    <span className="text-xs opacity-80 mt-1">
                      {formatMultiplier(noOdds)}
                    </span>
                  )}
                </div>
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
                step="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="text-lg"
              />
            </div>

            {/* Market Data & Trade Preview */}
            {normalizedYes !== null && normalizedNo !== null && (
              <div className="space-y-3">
                {/* Market Probabilities */}
                <div className="flex gap-3">
                  <div className="flex-1 p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="text-xs text-green-600 font-medium">YES</div>
                    <div className="text-lg font-bold text-green-700">
                      {formatPercentage(yesPrice)}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      Odds: {formatMultiplier(yesOdds)}
                    </div>
                  </div>
                  
                  <div className="flex-1 p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="text-xs text-red-600 font-medium">NO</div>
                    <div className="text-lg font-bold text-red-700">
                      {formatPercentage(noPrice)}
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      Odds: {formatMultiplier(noOdds)}
                    </div>
                  </div>
                </div>

                {/* Trade Details */}
                {expectedOut && potentialMultiplier && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">You pay:</span>
                        <span className="font-medium">{numAmount.toFixed(4)} BNB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">You receive:</span>
                        <span className="font-medium">
                          ~{parseFloat(expectedOut).toFixed(4)} {outcome} tokens
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Potential multiplier:</span>
                        <span className="font-bold text-blue-700">
                          {formatMultiplier(potentialMultiplier)}
                        </span>
                      </div>
                      {feeEstimated && parseFloat(feeEstimated) > 0 && (
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Protocol fee:</span>
                          <span>~{Number(feeEstimated).toFixed(6)} BNB</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Slippage Settings with Presets */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Slippage tolerance</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {[1, 2, 5, 10].map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant={slippage === preset ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSlippage(preset)}
                        className="text-xs h-8"
                      >
                        {preset}%
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      className="w-20 text-right" 
                      type="number" 
                      min="0.1" 
                      max="50" 
                      step="0.5"
                      value={slippage}
                      onChange={(e) => setSlippage(Math.max(0.1, Math.min(50, Number(e.target.value))))}
                    />
                    <span className="text-sm">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {slippage < 1 ? "⚠️ Very low slippage may cause failed trades" :
                     slippage > 10 ? "⚠️ High slippage - trade with caution" :
                     slippage > 5 ? "Higher slippage for volatile markets" :
                     "Recommended: 2-5% for typical markets"}
                  </p>
                </div>
              </div>
            )}

            {/* Error & Status Messages */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
              </div>
            )}

            {txHash && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600">
                  ✓ Transaction submitted: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </p>
              </div>
            )}

            {/* Action Button */}
            <Button
              className="w-full h-12 text-lg font-semibold"
              onClick={handleTrade}
              disabled={isProcessing || !hasAmount || !outcome}
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : !account ? (
                "Connect Wallet"
              ) : !isCorrectNetwork ? (
                "Switch Network"
              ) : (
                `Buy ${outcome || ''} Tokens`
              )}
            </Button>

            {/* Help Text */}
            <p className="text-xs text-gray-500 text-center">
              {hasAmount && outcome && expectedOut ? (
                `Trading ${numAmount} BNB for ~${parseFloat(expectedOut).toFixed(2)} ${outcome} tokens`
              ) : (
                "Enter amount and select outcome to see trade details"
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}