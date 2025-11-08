"use client"

import { useState } from "react"
import { X, Loader2, Plus, Shield, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useWeb3Context } from "@/lib/wallet-context"
import { usePredictionMarket } from "@/hooks/use-predection-market"

interface CreateMarketModalProps {
  onClose: () => void
  onSuccess?: (marketId: number) => void
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
  category?: string;
}

export default function CreateMarketModal({ onClose, onSuccess }: CreateMarketModalProps) {
  const [question, setQuestion] = useState("")
  const [endDate, setEndDate] = useState("")
  const [endTime, setEndTime] = useState("")
  const [initialYes, setInitialYes] = useState("0.1")
  const [initialNo, setInitialNo] = useState("0.1")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  // Get unified Web3 context
  const { account, connectWallet, isConnecting, isCorrectNetwork, switchNetwork } = useWeb3Context()
  const { createMarket, isLoading, isContractReady } = usePredictionMarket()

  // Calculate liquidity preview
  const totalLiquidity = parseFloat(initialYes || "0") + parseFloat(initialNo || "0")
  const yesPercent = totalLiquidity > 0 ? (parseFloat(initialYes || "0") / totalLiquidity) * 100 : 50
  const noPercent = 100 - yesPercent

  // Validate question with AI
  const validateQuestion = async () => {
    if (!question || question.length < 10) {
      setError("Question must be at least 10 characters")
      return false
    }

    if (question.length > 280) {
      setError("Question must be less than 280 characters")
      return false
    }

    if (!endDate || !endTime) {
      setError("Please set an end date and time first")
      return false
    }

    const endDateTime = new Date(`${endDate}T${endTime}`)
    const endTimeUnix = Math.floor(endDateTime.getTime() / 1000)

    setIsValidating(true)
    setError(null)
    setValidationResult(null)

    try {
      // This will be handled by the createMarket function now
      // We'll just do basic validation here
      setValidationResult({
        valid: true,
        reason: "Question format looks good. Full AI validation will happen during creation.",
        category: "GENERAL"
      })
      return true
    } catch (err: any) {
      console.error('Validation error:', err)
      setError('Failed to validate question. Please try again.')
      return false
    } finally {
      setIsValidating(false)
    }
  }

  const handleCreate = async () => {
    // Step 1: Check if wallet is connected
    if (!account) {
      await connectWallet()
      return
    }

    // Step 2: Check if on correct network
    if (!isCorrectNetwork) {
      await switchNetwork()
      return
    }

    // Step 3: Check if contract is ready
    if (!isContractReady) {
      setError("Contract not ready. Please wait or refresh the page.")
      return
    }

    // Step 4: Validate question
    if (!question || question.length < 10) {
      setError("Question must be at least 10 characters")
      return
    }

    if (question.length > 280) {
      setError("Question must be less than 280 characters")
      return
    }

    // Step 5: Validate end date/time
    if (!endDate || !endTime) {
      setError("Please set an end date and time")
      return
    }

    const endDateTime = new Date(`${endDate}T${endTime}`)
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

    if (endDateTime <= oneHourFromNow) {
      setError("End time must be at least 1 hour from now")
      return
    }

    // Step 6: Validate liquidity amounts
    const yesAmount = parseFloat(initialYes)
    const noAmount = parseFloat(initialNo)

    if (yesAmount <= 0 || noAmount <= 0) {
      setError("Both YES and NO liquidity must be greater than 0")
      return
    }

    if (totalLiquidity < 0.01) {
      setError("Total liquidity must be at least 0.01 BNB")
      return
    }

    // Step 7: Proceed with market creation
    setIsProcessing(true)
    setError(null)
    setTxHash(null)

    try {
      const endTimeUnix = Math.floor(endDateTime.getTime() / 1000)
      
      console.log("📝 Creating market with params:", {
        question,
        category: "GENERAL", // Will be determined by AI validation
        endTime: endTimeUnix,
        initialYes,
        initialNo
      })

      const marketId = await createMarket({
        question,
        category: "GENERAL", // Temporary category, will be overridden by AI
        endTime: endTimeUnix,
        initialYes,
        initialNo
      })

      console.log("✅ Market created successfully:", marketId)
      setTxHash("success")
      
      if (onSuccess) {
        onSuccess(marketId)
      }

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err: any) {
      console.error("❌ Market creation error:", err)
      setError(err.reason || err.message || "Failed to create market")
    } finally {
      setIsProcessing(false)
    }
  }

  // Set minimum date to tomorrow
  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateString = minDate.toISOString().split("T")[0]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-2xl p-6 relative my-8">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-6">Create Prediction Market</h2>

        <div className="space-y-6">
          {/* Question Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Market Question <span className="text-red-500">*</span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={validateQuestion}
                disabled={isValidating || !question || question.length < 10}
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Validate
              </Button>
            </div>
            <Textarea
              placeholder="Will Bitcoin reach $100k by end of 2024?"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value)
                setValidationResult(null) // Clear validation when question changes
              }}
              className="min-h-[100px]"
              maxLength={280}
              disabled={isProcessing}
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {question.length}/280 characters
            </div>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div className={`p-3 rounded-lg border ${
              validationResult.valid 
                ? 'bg-green-950/20 border-green-500 text-green-400' 
                : 'bg-red-950/20 border-red-500 text-red-400'
            }`}>
              <div className="flex items-start gap-2">
                {validationResult.valid ? (
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <div className="font-medium">
                    {validationResult.valid ? '✓ Basic Validation Passed' : '✗ Validation Failed'}
                  </div>
                  <div className="text-sm mt-1">{validationResult.reason}</div>
                  {validationResult.valid && validationResult.category && (
                    <div className="text-sm mt-1">
                      <strong>Category:</strong> {validationResult.category}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* End Date & Time Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                End Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={minDateString}
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                End Time <span className="text-red-500">*</span>
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Initial Liquidity Section */}
          <div>
            <label className="text-sm font-medium mb-2 block">Initial Liquidity (BNB)</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">YES Pool</label>
                <Input
                  type="number"
                  placeholder="0.1"
                  value={initialYes}
                  onChange={(e) => setInitialYes(e.target.value)}
                  step="0.01"
                  min="0.001"
                  disabled={isProcessing}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">NO Pool</label>
                <Input
                  type="number"
                  placeholder="0.1"
                  value={initialNo}
                  onChange={(e) => setInitialNo(e.target.value)}
                  step="0.01"
                  min="0.001"
                  disabled={isProcessing}
                />
              </div>
            </div>

            {/* Liquidity Preview */}
            {totalLiquidity > 0 && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Liquidity:</span>
                  <span className="font-semibold">{totalLiquidity.toFixed(4)} BNB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Initial YES Price:</span>
                  <span className="font-semibold text-green-500">{yesPercent.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Initial NO Price:</span>
                  <span className="font-semibold text-red-500">{noPercent.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">YES Multiplier:</span>
                  <span className="font-semibold text-green-500">
                    {yesPercent > 0 ? (100 / yesPercent).toFixed(2) : '∞'}x
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">NO Multiplier:</span>
                  <span className="font-semibold text-red-500">
                    {noPercent > 0 ? (100 / noPercent).toFixed(2) : '∞'}x
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-950/20 border border-blue-500 rounded-lg">
            <h3 className="font-semibold text-blue-400 mb-2">How it works:</h3>
            <ul className="text-sm text-blue-300 space-y-1 list-disc list-inside">
              <li>Questions are validated by AI to ensure quality and clarity</li>
              <li>You'll provide initial liquidity to start the market</li>
              <li>The ratio of YES/NO liquidity sets the initial odds and multipliers</li>
              <li>You'll receive LP tokens representing your liquidity share</li>
              <li>Traders pay fees that go to liquidity providers</li>
              <li>Markets are automatically resolved by AI after the end time</li>
            </ul>
          </div>

          {/* Error Display */}
          {error && !validationResult && (
            <div className="p-3 bg-red-950/20 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success Display */}
          {txHash && (
            <div className="p-3 bg-green-950/20 border border-green-500 rounded-lg text-green-400 text-sm">
              ✅ Market created successfully! Redirecting...
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={onClose} 
              variant="outline" 
              className="flex-1" 
              disabled={isProcessing}
            >
              Cancel
            </Button>
            
            {!account ? (
              <Button 
                onClick={connectWallet} 
                className="flex-1" 
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </>
                )}
              </Button>
            ) : !isCorrectNetwork ? (
              <Button 
                onClick={switchNetwork} 
                className="flex-1" 
                variant="destructive"
              >
                Switch to BSC Testnet
              </Button>
            ) : !isContractReady ? (
              <Button 
                disabled 
                className="flex-1"
              >
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading Contract...
              </Button>
            ) : (
              <Button 
                onClick={handleCreate} 
                className="flex-1" 
                disabled={isProcessing || isLoading}
              >
                {isProcessing || isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Market
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Wallet Info */}
          {account && (
            <div className="text-center text-xs text-muted-foreground">
              Connected: {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}