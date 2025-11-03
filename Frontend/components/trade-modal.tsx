// components/trade-modal.tsx
"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Market } from "@/lib/markets";
import { useWeb3, usePredictionMarket } from "../hooks/use-web3";

interface TradeModalProps {
  market: Market;
  outcome: "YES" | "NO" | null;
  onOutcomeChange: (outcome: "YES" | "NO") => void;
  onClose: () => void;
}

export default function TradeModal({ market, outcome, onOutcomeChange, onClose }: TradeModalProps) {
  const [amount, setAmount] = useState("");
  const [isBuying, setIsBuying] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  const { account, connectWallet, isConnecting, isCorrectNetwork, switchNetwork } = useWeb3();
  const { buyYes, buyNo, sellYes, sellNo, getTokenBalances } = usePredictionMarket();
  
  const [balances, setBalances] = useState({ yes: "0", no: "0" });

  // Load balances when account changes
  useEffect(() => {
    if (account && market.id !== undefined) {
      loadBalances();
    }
  }, [account, market.id]);

  const loadBalances = async () => {
    try {
      const tokenBalances = await getTokenBalances(market.id!);
      setBalances(tokenBalances);
    } catch (err) {
      console.error("Error loading balances:", err);
    }
  };

  const numAmount = parseFloat(amount) || 0;
  const currentPrice = outcome === "YES" ? market.yesOdds : market.noOdds;
  const estimatedTokens = numAmount / (currentPrice / 100);
  const potentialPayout = isBuying ? estimatedTokens : numAmount;
  const maxPayout = isBuying ? estimatedTokens : numAmount;

  const handleTrade = async () => {
    if (!account) {
      await connectWallet();
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    if (!amount || numAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    // Check if market has blockchain ID
    if (market.id === undefined) {
      setError("This market is not yet deployed on-chain");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxHash(null);

    try {
      let receipt;

      if (isBuying) {
        if (outcome === "YES") {
          receipt = await buyYes(market.id, amount);
        } else {
          receipt = await buyNo(market.id, amount);
        }
      } else {
        if (outcome === "YES") {
          receipt = await sellYes(market.id, amount);
        } else {
          receipt = await sellNo(market.id, amount);
        }
      }

      setTxHash(receipt.hash);
      await loadBalances(); // Refresh balances
      setAmount("");
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("Transaction error:", err);
      setError(err.reason || err.message || "Transaction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentBalance = outcome === "YES" ? balances.yes : balances.no;
  const hasBalance = parseFloat(currentBalance) > 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-6">Trade on Market</h2>

        {/* Outcome Selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => onOutcomeChange("YES")}
            className={`p-4 rounded-lg border-2 transition-all ${
              outcome === "YES"
                ? "border-green-500 bg-green-950/30"
                : "border-border bg-muted hover:bg-muted/80"
            }`}
          >
            <div className="text-sm text-muted-foreground mb-1">YES</div>
            <div className={`text-2xl font-bold ${outcome === "YES" ? "text-green-500" : ""}`}>
              {market.yesOdds}%
            </div>
          </button>

          <button
            onClick={() => onOutcomeChange("NO")}
            className={`p-4 rounded-lg border-2 transition-all ${
              outcome === "NO" ? "border-red-500 bg-red-950/30" : "border-border bg-muted hover:bg-muted/80"
            }`}
          >
            <div className="text-sm text-muted-foreground mb-1">NO</div>
            <div className={`text-2xl font-bold ${outcome === "NO" ? "text-red-500" : ""}`}>{market.noOdds}%</div>
          </button>
        </div>

        {/* Buy/Sell Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setIsBuying(true)}
            className={`flex-1 py-2 rounded-md font-medium transition-all ${
              isBuying ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setIsBuying(false)}
            disabled={!hasBalance}
            className={`flex-1 py-2 rounded-md font-medium transition-all ${
              !isBuying ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            } ${!hasBalance ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Sell
          </button>
        </div>

        {/* Balance Display */}
        {account && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your {outcome} tokens:</span>
              <span className="font-semibold">{parseFloat(currentBalance).toFixed(4)}</span>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="mb-6">
          <label className="text-sm text-muted-foreground mb-2 block">
            {isBuying ? "Amount to spend (BNB)" : `${outcome} tokens to sell`}
          </label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg"
            step="0.01"
            min="0"
            disabled={isProcessing}
          />
        </div>

        {/* Transaction Summary */}
        {numAmount > 0 && (
          <div className="space-y-3 mb-6 p-4 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You {isBuying ? "spend" : "receive"}:</span>
              <span className="font-semibold">
                {numAmount.toFixed(4)} {isBuying ? "BNB" : outcome}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You {isBuying ? "receive" : "get back"}:</span>
              <span className="font-semibold">
                {(isBuying ? estimatedTokens : potentialPayout).toFixed(4)} {isBuying ? outcome : "BNB"}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-3 border-t border-border">
              <span className="text-muted-foreground">Avg. price:</span>
              <span className="font-semibold">{(currentPrice / 100).toFixed(2)} BNB</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/20 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success Display */}
        {txHash && (
          <div className="mb-4 p-3 bg-green-950/20 border border-green-500 rounded-lg text-green-400 text-sm">
            Transaction successful!{" "}
            <a
              href={`https://testnet.bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on BSCScan
            </a>
          </div>
        )}

        {/* Action Button */}
        {!account ? (
          <Button onClick={connectWallet} className="w-full" size="lg" disabled={isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect Wallet"
            )}
          </Button>
        ) : !isCorrectNetwork ? (
          <Button onClick={switchNetwork} className="w-full" size="lg" variant="destructive">
            Switch to BSC Testnet
          </Button>
        ) : (
          <Button
            onClick={handleTrade}
            className="w-full"
            size="lg"
            disabled={!amount || numAmount <= 0 || isProcessing || (!isBuying && !hasBalance)}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {isBuying ? "Buy" : "Sell"} {outcome} tokens
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        )}

        {/* Wallet Info */}
        {account && (
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Connected: {account.slice(0, 6)}...{account.slice(-4)}
          </div>
        )}
      </Card>
    </div>
  );
}