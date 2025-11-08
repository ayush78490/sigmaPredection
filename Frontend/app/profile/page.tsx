"use client"

import { useState, useEffect } from "react"
import { useWeb3Context } from "@/lib/wallet-context"
import { usePredictionMarket } from "@/hooks/use-predection-market"
import Header from "@/components/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, TrendingDown, Wallet, Coins, BarChart3 } from "lucide-react"
import Link from "next/link"
import { MarketStatus, Outcome } from "@/hooks/use-predection-market"

export default function ProfilePage() {
  const { account, connectWallet } = useWeb3Context()
  const { getUserPositions } = usePredictionMarket()
  const [positions, setPositions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const loadPositions = async () => {
      if (!account) return
      setIsLoading(true)
      try {
        const userPositions = await getUserPositions(account)
        setPositions(userPositions)
      } catch (error) {
        console.error("Failed to load positions:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadPositions()
  }, [account, getUserPositions])

  // Calculate portfolio stats
  const portfolioStats = {
    totalInvested: positions.reduce((total, pos) => total + parseFloat(pos.totalInvested), 0),
    totalMarkets: positions.length,
    activePositions: positions.filter(pos => pos.market.status === MarketStatus.Open).length,
    resolvedPositions: positions.filter(pos => pos.market.status === MarketStatus.Resolved).length
  }

  const getStatusBadge = (status: MarketStatus) => {
    const statusConfig = {
      [MarketStatus.Open]: { label: "Active", color: "bg-green-100 text-green-800" },
      [MarketStatus.Closed]: { label: "Closed", color: "bg-yellow-100 text-yellow-800" },
      [MarketStatus.ResolutionRequested]: { label: "Resolving", color: "bg-blue-100 text-blue-800" },
      [MarketStatus.Resolved]: { label: "Resolved", color: "bg-purple-100 text-purple-800" },
      [MarketStatus.Disputed]: { label: "Disputed", color: "bg-red-100 text-red-800" },
    }
    
    const config = statusConfig[status]
    return (
      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const getOutcomeText = (outcome: Outcome) => {
    switch (outcome) {
      case Outcome.Yes: return "YES Won"
      case Outcome.No: return "NO Won"
      default: return "Pending"
    }
  }

  if (!account) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Wallet className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Your Portfolio</h1>
          <p className="text-muted-foreground mb-6">Connect your wallet to view your trading positions and portfolio</p>
          <Button onClick={connectWallet} size="lg">Connect Wallet</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Portfolio</h1>
          <p className="text-muted-foreground">
            Connected: {account.slice(0, 6)}...{account.slice(-4)}
          </p>
        </div>

        {/* Portfolio Stats */}
        {positions.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold">{portfolioStats.totalInvested.toFixed(2)}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total Invested (BNB)</p>
            </Card>
            
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold mb-2">{portfolioStats.totalMarkets}</div>
              <p className="text-sm text-muted-foreground">Total Markets</p>
            </Card>
            
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold mb-2">{portfolioStats.activePositions}</div>
              <p className="text-sm text-muted-foreground">Active Positions</p>
            </Card>
            
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold mb-2">{portfolioStats.resolvedPositions}</div>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </Card>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading your positions...</span>
          </div>
        ) : positions.length === 0 ? (
          // Empty State
          <Card className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No positions yet</h3>
            <p className="text-muted-foreground mb-6">
              You haven't traded in any prediction markets yet. Start trading to build your portfolio!
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/">
                <Button>Browse Markets</Button>
              </Link>
              <Link href="/markets">
                <Button variant="outline">View All Markets</Button>
              </Link>
            </div>
          </Card>
        ) : (
          // Positions List
          <div className="grid gap-6">
            {positions.map((position, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link href={`/market/${position.market.id}`}>
                        <h3 className="text-lg font-semibold hover:text-primary transition-colors cursor-pointer line-clamp-2">
                          {position.market.question}
                        </h3>
                      </Link>
                      {getStatusBadge(position.market.status)}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>Market ID: {position.market.id}</span>
                      <span>Category: {position.market.category || "General"}</span>
                      {position.market.status === MarketStatus.Resolved && (
                        <span className="font-medium">
                          Outcome: {getOutcomeText(position.market.outcome)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Position Details */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-muted-foreground mb-1">YES Tokens</p>
                    <p className="text-lg font-bold text-green-600 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {parseFloat(position.yesBalance).toFixed(4)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ≈ {(parseFloat(position.yesBalance) * (position.market.yesPrice || 50) / 100).toFixed(4)} BNB
                    </p>
                  </div>
                  
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <p className="text-xs text-muted-foreground mb-1">NO Tokens</p>
                    <p className="text-lg font-bold text-red-600 flex items-center gap-1">
                      <TrendingDown className="w-4 h-4" />
                      {parseFloat(position.noBalance).toFixed(4)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ≈ {(parseFloat(position.noBalance) * (position.market.noPrice || 50) / 100).toFixed(4)} BNB
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
                    <p className="text-lg font-bold text-blue-600">{position.totalInvested} BNB</p>
                    <p className="text-xs text-muted-foreground mt-1">Current value</p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-muted-foreground mb-1">Current Odds</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">YES:</span>
                        <span className="font-medium">{(position.market.yesPrice || 50).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">NO:</span>
                        <span className="font-medium">{(position.market.noPrice || 50).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Link href={`/market/${position.market.id}`}>
                    <Button variant="outline" size="sm">
                      View Market
                    </Button>
                  </Link>
                  
                  {position.market.status === MarketStatus.Resolved && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      Redeem Winnings
                    </Button>
                  )}
                  
                  {position.market.status === MarketStatus.Open && (
                    <Link href={`/market/${position.market.id}?tab=trade`}>
                      <Button size="sm">
                        Trade More
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}