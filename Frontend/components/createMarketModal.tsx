// components/create-market-modal.tsx
"use client";

import { useState } from "react";
import { X, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWeb3, usePredictionMarket } from "../hooks/use-web3";

interface CreateMarketModalProps {
  onClose: () => void;
  onSuccess?: (marketId: number) => void;
}

export default function CreateMarketModal({ onClose, onSuccess }: CreateMarketModalProps) {
  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [initialYes, setInitialYes] = useState("0.1");
  const [initialNo, setInitialNo] = useState("0.1");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { account, connectWallet, isConnecting, isCorrectNetwork, switchNetwork } = useWeb3();
  const { createMarket } = usePredictionMarket();

  const totalLiquidity = parseFloat(initialYes || "0") + parseFloat(initialNo || "0");
  const yesPercent = totalLiquidity > 0 ? (parseFloat(initialYes || "0") / totalLiquidity) * 100 : 50;
  const noPercent = 100 - yesPercent;

  const handleCreate = async () => {
    if (!account) {
      await connectWallet();
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    // Validation
    if (!question || question.length < 10) {
      setError("Question must be at least 10 characters");
      return;
    }

    if (question.length > 280) {
      setError("Question must be less than 280 characters");
      return;
    }

    if (!endDate || !endTime) {
      setError("Please set an end date and time");
      return;
    }

    const endDateTime = new Date(`${endDate}T${endTime}`);
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    if (endDateTime <= oneHourFromNow) {
      setError("End time must be at least 1 hour from now");
      return;
    }

    const yesAmount = parseFloat(initialYes);
    const noAmount = parseFloat(initialNo);

    if (yesAmount <= 0 || noAmount <= 0) {
      setError("Both YES and NO liquidity must be greater than 0");
      return;
    }

    if (totalLiquidity < 0.01) {
      setError("Total liquidity must be at least 0.01 BNB");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxHash(null);

    try {
      const endTimeUnix = Math.floor(endDateTime.getTime() / 1000);
      const marketId = await createMarket(question, endTimeUnix, initialYes, initialNo);

      setTxHash("success");
      
      if (onSuccess) {
        onSuccess(marketId);
      }

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("Market creation error:", err);
      setError(err.reason || err.message || "Failed to create market");
    } finally {
      setIsProcessing(false);
    }
  };

  // Set minimum date to tomorrow
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateString = minDate.toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-2xl p-6 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-6">Create Prediction Market</h2>

        <div className="space-y-6">
          {/* Question */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Market Question <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Will Bitcoin reach $100k by end of 2024?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[100px]"
              maxLength={280}
              disabled={isProcessing}
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {question.length}/280 characters
            </div>
          </div>

          {/* End Date & Time */}
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

          {/* Initial Liquidity */}
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
                  <span className="text-muted-foreground">Initial YES odds:</span>
                  <span className="font-semibold text-green-500">{yesPercent.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Initial NO odds:</span>
                  <span className="font-semibold text-red-500">{noPercent.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-950/20 border border-blue-500 rounded-lg">
            <h3 className="font-semibold text-blue-400 mb-2">How it works:</h3>
            <ul className="text-sm text-blue-300 space-y-1 list-disc list-inside">
              <li>You'll provide initial liquidity to start the market</li>
              <li>The ratio of YES/NO liquidity sets the initial odds</li>
              <li>You'll receive LP tokens representing your liquidity share</li>
              <li>Traders pay fees that go to liquidity providers</li>
            </ul>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-950/20 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success Display */}
          {txHash && (
            <div className="p-3 bg-green-950/20 border border-green-500 rounded-lg text-green-400 text-sm">
              Market created successfully! Redirecting...
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="flex-1" disabled={isProcessing}>
              Cancel
            </Button>
            
            {!account ? (
              <Button onClick={connectWallet} className="flex-1" disabled={isConnecting}>
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
              <Button onClick={switchNetwork} className="flex-1" variant="destructive">
                Switch to BSC Testnet
              </Button>
            ) : (
              <Button onClick={handleCreate} className="flex-1" disabled={isProcessing}>
                {isProcessing ? (
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
  );
}