"use client"

import { useState, useEffect } from "react"
import { useWeb3Context } from "@/lib/wallet-context"
import { usePredictionMarket, MarketStatus, Outcome } from "@/hooks/use-predection-market"
import Header from "@/components/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Coins, Copy, ExternalLink, Wallet, BarChart3, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import LightRays from "@/components/LightRays"

export default function ProfilePage() {
  const { account, connectWallet } = useWeb3Context()
  const { getUserPositions, contractAddress, getMarketInvestment, getCurrentMultipliers, redeem } = usePredictionMarket()

  const [positions, setPositions] = useState<any[]>([])
  const [marketInvestments, setMarketInvestments] = useState<{ [key: string]: string }>({})
  const [marketOdds, setMarketOdds] = useState<{ [key: string]: { yesMultiplier: number, noMultiplier: number, yesPrice: number, noPrice: number } }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [redeemingMarketId, setRedeemingMarketId] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!account) return

      setIsLoading(true)

      try {
        const userPositions = await getUserPositions(account)
        setPositions(userPositions)

        const investmentsPromises = userPositions.map(async (pos) => {
          try {
            const investment = await getMarketInvestment(account, pos.market.id)
            return { marketId: pos.market.id, investment }
          } catch {
            return { marketId: pos.market.id, investment: "0" }
          }
        })

        const oddsPromises = userPositions.map(async (pos) => {
          try {
            return { marketId: pos.market.id, odds: await getCurrentMultipliers(pos.market.id) }
          } catch {
            return {
              marketId: pos.market.id,
              odds: { yesMultiplier: 10000, noMultiplier: 10000, yesPrice: 5000, noPrice: 5000 }
            }
          }
        })

        const investments = await Promise.all(investmentsPromises)
        const oddsData = await Promise.all(oddsPromises)

        let investmentMap: { [key: string]: string } = {}
        investments.forEach(({ marketId, investment }) => {
          investmentMap[marketId] = investment
        })
        setMarketInvestments(investmentMap)

        let oddsMap: { [key: string]: { yesMultiplier: number, noMultiplier: number, yesPrice: number, noPrice: number } } = {}
        oddsData.forEach(({ marketId, odds }) => {
          oddsMap[marketId] = odds
        })
        setMarketOdds(oddsMap)

      } catch (error) {
        console.error("Failed to load portfolio data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [account, getUserPositions, getMarketInvestment, getCurrentMultipliers])

  // Improved market activity check
  const isMarketActive = (market: any): boolean => {
    // First check explicit isActive flag if it exists
    if (market.isActive !== undefined) {
      return market.isActive
    }
    
    // Fallback logic based on status and timing
    const now = Math.floor(Date.now() / 1000)
    const isOpenStatus = market.status === MarketStatus.Open
    const hasNotEnded = market.endTime > now
    
    // Market is active if it's open and hasn't ended, OR if it's resolved but still within redemption period
    return isOpenStatus && hasNotEnded
  }

  // Enhanced status checking with activity
  const getMarketStatusInfo = (market: any) => {
    const active = isMarketActive(market)
    const status = market.status as MarketStatus
    const now = Math.floor(Date.now() / 1000)
    
    // If market is explicitly inactive
    if (!active) {
      return {
        label: "Inactive",
        color: "bg-gray-500 text-white",
        description: "Market is not active for trading"
      }
    }

    const statusConfig: Record<MarketStatus, { label: string; color: string; description: string }> = {
      [MarketStatus.Open]: { 
        label: "Active", 
        color: "bg-green-500 text-white",
        description: market.endTime > now ? "Open for trading" : "Trading ended, awaiting resolution"
      },
      [MarketStatus.Closed]: { 
        label: "Closed", 
        color: "bg-yellow-500 text-white",
        description: "Trading closed, pending resolution"
      },
      [MarketStatus.ResolutionRequested]: { 
        label: "Resolving", 
        color: "bg-blue-500 text-white",
        description: "AI resolution in progress"
      },
      [MarketStatus.Resolved]: { 
        label: "Resolved", 
        color: "bg-purple-500 text-white",
        description: "Market has been resolved"
      },
      [MarketStatus.Disputed]: { 
        label: "Disputed", 
        color: "bg-red-500 text-white",
        description: "Resolution under dispute"
      },
    }
    
    return statusConfig[status] || { 
      label: "Unknown", 
      color: "bg-gray-500 text-white",
      description: "Status unknown"
    }
  }

  const handleRedeem = async (marketId: string) => {
    if (!account) return
    
    setRedeemingMarketId(marketId)
    try {
      await redeem(Number(marketId))
      // Refresh positions after successful redemption
      const userPositions = await getUserPositions(account)
      setPositions(userPositions)
      
      // Refresh market investments
      const updatedInvestment = await getMarketInvestment(account, Number(marketId))
      setMarketInvestments(prev => ({
        ...prev,
        [marketId]: updatedInvestment
      }))
    } catch (error) {
      console.error("Failed to redeem winnings:", error)
    } finally {
      setRedeemingMarketId(null)
    }
  }

  // Enhanced statistics calculation
  const totalInvestment = Object.values(marketInvestments).reduce((acc, val) => acc + parseFloat(val || "0"), 0)
  const totalMarkets = positions.length
  const activeMarkets = positions.filter(pos => isMarketActive(pos.market)).length
  const resolvedMarkets = positions.filter(pos => pos.market.status === MarketStatus.Resolved).length
  const inactiveMarkets = positions.filter(pos => !isMarketActive(pos.market)).length

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text) }
  const getBlockExplorerUrl = (address: string) => `https://testnet.bscscan.com/address/${address}`

  const getPredictedOutcome = (yesPrice: number, noPrice: number): { outcomeText: string; confidence: number } => {
    if (yesPrice > noPrice) {
      return { outcomeText: "YES more likely", confidence: yesPrice / 100 }
    } else if (noPrice > yesPrice) {
      return { outcomeText: "NO more likely", confidence: noPrice / 100 }
    }
    return { outcomeText: "Even odds", confidence: 50 }
  }

  // Improved hasWinningTokens function with better type checking and debugging
  const hasWinningTokens = (position: any): boolean => {
    const market = position.market
    
    // Only check resolved markets
    if (market.status !== MarketStatus.Resolved) {
      return false
    }
    
    // Safely parse balances
    const yesBalance = parseFloat(position.yesBalance || "0")
    const noBalance = parseFloat(position.noBalance || "0")
    
    // Debug logging
    // console.log('Checking winning tokens for market:', {
    //   marketId: market.id,
    //   status: market.status,
    //   outcome: market.outcome,
    //   yesBalance: yesBalance,
    //   noBalance: noBalance,
    //   hasYesTokens: yesBalance > 0,
    //   hasNoTokens: noBalance > 0
    // })
    
    // Check if user has tokens for the winning outcome
    if (market.outcome === Outcome.Yes && yesBalance > 0.0001) {
      
      return true
    }
    
    if (market.outcome === Outcome.No && noBalance > 0.0001) {
      
      return true
    }
    
    return false
  }

  // Improved calculatePotentialWinnings function
  const calculatePotentialWinnings = (position: any): string => {
    const market = position.market
    
    if (market.status !== MarketStatus.Resolved) {
      return "0"
    }
    
    // Safely parse balances
    const yesBalance = parseFloat(position.yesBalance || "0")
    const noBalance = parseFloat(position.noBalance || "0")
    
    if (market.outcome === Outcome.Yes && yesBalance > 0) {
      return yesBalance.toFixed(4)
    } else if (market.outcome === Outcome.No && noBalance > 0) {
      return noBalance.toFixed(4)
    }
    
    return "0"
  }

  // Calculate total winnings across all positions
  const totalWinnings = positions.reduce((total, position) => {
    if (hasWinningTokens(position)) {
      const winnings = parseFloat(calculatePotentialWinnings(position) || "0")
      return total + winnings
    }
    return total
  }, 0)

  if (!account) {
    return (
      <main className="min-h-screen bg-background relative overflow-hidden">
        {/* Light Rays Background */}
        <div className="fixed inset-0 z-0">
          <LightRays
            raysOrigin="top-center"
            raysColor="#6366f1"
            raysSpeed={1.5}
            lightSpread={0.8}
            rayLength={1.2}
            followMouse={true}
            mouseInfluence={0.1}
            noiseAmount={0.1}
            distortion={0.05}
          />
        </div>

        {/* Content overlay */}
        <div className="relative z-10">
          <Header />
          <div className="max-w-4xl mx-auto px-4 py-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center backdrop-blur-sm bg-card/80">
              <Wallet className="w-10 h-10 text-muted-foreground" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Your Portfolio</h1>
            <p className="text-muted-foreground mb-6">Connect your wallet to view your trading positions and portfolio</p>
            <Button onClick={connectWallet} variant="outline" size="lg" className="backdrop-blur-sm bg-card/80">Connect Wallet</Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Light Rays Background */}
      <div className="fixed inset-0 z-0">
        <LightRays
          raysOrigin="top-center"
          raysColor="#6366f1"
          raysSpeed={1.5}
          lightSpread={0.8}
          rayLength={1.2}
          followMouse={true}
          mouseInfluence={0.1}
          noiseAmount={0.1}
          distortion={0.05}
        />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 bg-black/80">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Your Portfolio</h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <p className="text-muted-foreground mb-2 backdrop-blur-sm bg-card/80 p-2 rounded-lg inline-block">
                  Connected: {account.slice(0, 6)}...{account.slice(-4)}
                </p>
                {contractAddress && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground backdrop-blur-sm bg-card/80 p-2 rounded-lg">
                    <span>Contract: {contractAddress.slice(0, 8)}...{contractAddress.slice(-6)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-muted"
                      onClick={() => copyToClipboard(contractAddress)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-muted"
                      onClick={() => window.open(getBlockExplorerUrl(contractAddress), '_blank')}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              <Card className="p-4 bg-primary/5 border-primary/20 backdrop-blur-sm bg-card/80">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total BNB Invested</p>
                    <p className="text-xl font-bold">
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        `${totalInvestment.toFixed(4)} BNB`
                      )}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {positions.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <Card className="p-4 text-center overflow-hidden hover:shadow-lg hover:shadow-blue-500/50 hover:scale-[103%] transition-all cursor-pointer h-full border-2 hover:border-white/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-green-500" />
                  <span className="text-2xl font-bold">{totalInvestment.toFixed(4)}</span>
                </div>
                <p className="text-sm text-muted-foreground">Total BNB Invested</p>
              </Card>
              <Card className="p-4 text-center overflow-hidden hover:shadow-lg hover:shadow-blue-500/50 hover:scale-[103%] transition-all cursor-pointer h-full border-2 hover:border-white/50">
                <div className="text-2xl font-bold mb-2">{totalMarkets}</div>
                <p className="text-sm text-muted-foreground">Markets Traded</p>
              </Card>
              <Card className="p-4 text-center overflow-hidden hover:shadow-lg hover:shadow-blue-500/50 hover:scale-[103%] transition-all cursor-pointer h-full border-2 hover:border-white/50">
                <div className="text-2xl font-bold mb-2">{activeMarkets}</div>
                <p className="text-sm text-muted-foreground">Active Positions</p>
              </Card>
              <Card className="p-4 text-center overflow-hidden hover:shadow-lg hover:shadow-blue-500/50 hover:scale-[103%] transition-all cursor-pointer h-full border-2 hover:border-white/50">
                <div className="text-2xl font-bold mb-2">{resolvedMarkets}</div>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </Card>
              <Card className="p-4 text-center overflow-hidden hover:shadow-lg hover:shadow-blue-500/50 hover:scale-[103%] transition-all cursor-pointer h-full border-2 hover:border-white/50">
                <div className="text-2xl font-bold mb-2">{inactiveMarkets}</div>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </Card>
            </div>
          )}

          {/* Total Winnings Banner */}
          {totalWinnings > 0 && (
            <Card className="mb-6 p-4 bg-gradient-to-r from-green-500 to-emerald-600 border-green-400 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-white" />
                  <div>
                    <p className="text-white font-semibold">Total Winnings Available</p>
                    <p className="text-white text-lg font-bold">{totalWinnings.toFixed(4)} BNB</p>
                  </div>
                </div>
                <div className="text-white text-sm">
                  Ready to claim from {positions.filter(pos => hasWinningTokens(pos)).length} market(s)
                </div>
              </div>
            </Card>
          )}

          {!isLoading && positions.length === 0 && (
            <Card className="p-12 text-center backdrop-blur-sm bg-card/80 bg-black/10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No positions yet</h3>
              <p className="text-muted-foreground mb-6">You haven't traded in any prediction markets yet. Start trading to build your portfolio!</p>
              <div className="flex gap-4 justify-center">
                <Link href="/">
                  <Button className="backdrop-blur-sm bg-card/80">Browse Markets</Button>
                </Link>
                <Link href="/markets">
                  <Button variant="outline" className="backdrop-blur-sm bg-card/80">View All Markets</Button>
                </Link>
              </div>
              {contractAddress && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-sm text-muted-foreground mb-2">Prediction Market Contract</p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded backdrop-blur-sm">
                      {contractAddress.slice(0, 12)}...{contractAddress.slice(-8)}
                    </code>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 backdrop-blur-sm bg-card/80" onClick={() => copyToClipboard(contractAddress)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 backdrop-blur-sm bg-card/80" onClick={() => window.open(getBlockExplorerUrl(contractAddress), '_blank')}>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {!isLoading && positions.length > 0 && (
            <div className="grid gap-6">
              {positions.map((position, index) => {
                const investmentStr = marketInvestments[position.market.id] || "0"
                const investment = parseFloat(investmentStr)
                const odds = marketOdds[position.market.id] || { yesPrice: 5000, noPrice: 5000 }
                const predicted = getPredictedOutcome(odds.yesPrice, odds.noPrice)
                const market = position.market
                const hasWinnings = hasWinningTokens(position)
                const potentialWinnings = calculatePotentialWinnings(position)
                const marketActive = isMarketActive(market)
                const statusInfo = getMarketStatusInfo(market)

                return (
                  <Card key={index} className={`p-6 hover:shadow-lg transition-shadow backdrop-blur-sm bg-card/80 ${
                    !marketActive ? 'opacity-70 border-gray-400' : 'border-2'
                  }`}>
                    {/* Inactive Market Warning */}
                    {!marketActive && (
                      <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">This market is no longer active for trading</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Link href={`/market/${market.id}`}>
                            <h3 className={`text-lg font-semibold hover:text-primary transition-colors cursor-pointer line-clamp-2 ${
                              !marketActive ? 'text-gray-600' : ''
                            }`}>
                              {market.question}
                              {!marketActive && (
                                <span className="ml-2 text-xs text-gray-500">(Inactive)</span>
                              )}
                            </h3>
                          </Link>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color} backdrop-blur-sm`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>Market ID: {market.id}</span>
                          <span>Category: {market.category || "General"}</span>
                          {market.status === MarketStatus.Resolved && (
                            <span className="font-medium">
                              Outcome: {(() => {
                                switch (market.outcome as Outcome) {
                                  case Outcome.Yes: return "YES Won"
                                  case Outcome.No: return "NO Won"
                                  default: return "Pending"
                                }
                              })()}
                            </span>
                          )}
                          {!marketActive && (
                            <span className="text-gray-500">• Inactive</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{statusInfo.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                      <div className={`rounded-lg p-3 border backdrop-blur-sm ${
                        marketActive ? 'bg-primary/10 border-primary/20' : 'bg-primary/10 border-primary/20'
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1">BNB Invested</p>
                        <p className={`text-lg font-bold flex items-center gap-1 ${
                          marketActive ? 'text-primary' : 'text-gray-600'
                        }`}>
                          <Coins className="w-4 h-4" />{investment.toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total in this market</p>
                      </div>
                      <div className={`rounded-lg p-3 border backdrop-blur-sm ${
                        marketActive ? 'bg-primary/10 border-primary/20' : 'bg-primary/10 border-primary/20'
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1">YES Tokens</p>
                        <p className={`text-lg font-bold flex items-center gap-1 ${
                          marketActive ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {parseFloat(position.yesBalance || "0").toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ≈ {(parseFloat(position.yesBalance || "0") * (odds.yesPrice || 50) / 100).toFixed(4)} BNB
                        </p>
                      </div>
                      <div className={`rounded-lg p-3 border backdrop-blur-sm ${
                        marketActive ? 'bg-primary/10 border-primary/20' : 'bg-primary/10 border-primary/20'
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1">NO Tokens</p>
                        <p className={`text-lg font-bold flex items-center gap-1 ${
                          marketActive ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {parseFloat(position.noBalance || "0").toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ≈ {(parseFloat(position.noBalance || "0") * (odds.noPrice || 50) / 100).toFixed(4)} BNB
                        </p>
                      </div>
                      <div className={`rounded-lg p-3 border backdrop-blur-sm ${
                        marketActive ? 'bg-primary/10 border-primary/20' : 'bg-primary/10 border-primary/20'
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1">Predicted Outcome</p>
                        <p className={`text-lg font-bold ${
                          marketActive ? 'text-blue-600' : 'text-gray-600'
                        }`}>
                          {predicted.outcomeText}
                        </p>
                        <p className="text-xs text-muted-foreground">{predicted.confidence.toFixed(2)}% confidence</p>
                      </div>
                      <div className={`rounded-lg p-3 border backdrop-blur-sm ${
                        marketActive ? 'bg-primary/10 border-primary/20' : 'bg-primary/10 border-primary/20'
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1">Current Odds</p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className={marketActive ? "text-green-600" : "text-gray-600"}>YES:</span>
                            <span className="font-medium">{(odds.yesPrice / 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className={marketActive ? "text-red-600" : "text-gray-600"}>NO:</span>
                            <span className="font-medium">{(odds.noPrice / 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Winnings Display for Resolved Markets */}
                    {market.status === MarketStatus.Resolved && hasWinnings && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <div>
                              <p className="text-sm font-medium text-green-800">Winnings Available</p>
                              <p className="text-lg font-bold text-green-600">
                                {potentialWinnings} BNB
                              </p>
                              <p className="text-xs text-green-600">
                                {market.outcome === Outcome.Yes ? 'YES' : 'NO'} tokens can be redeemed for BNB
                              </p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 backdrop-blur-sm flex items-center gap-2"
                            onClick={() => handleRedeem(market.id.toString())}
                            disabled={redeemingMarketId === market.id.toString()}
                          >
                            {redeemingMarketId === market.id.toString() ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Claim {potentialWinnings} BNB
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* No Winnings Message for Resolved Markets */}
                    {market.status === MarketStatus.Resolved && !hasWinnings && (
                      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <p className="text-sm text-gray-600">
                            Market resolved - {market.outcome === Outcome.Yes ? 'YES' : 'NO'} won. 
                            {parseFloat(position.yesBalance || "0") > 0 || parseFloat(position.noBalance || "0") > 0 
                              ? " You don't have winning tokens for this outcome." 
                              : " You didn't participate in this market."}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Link href={`/market/${market.id}`}>
                        <Button variant="outline" size="sm" className="backdrop-blur-sm bg-card/80">View Market</Button>
                      </Link>
                      
                      {/* Trade More Button for Active Markets */}
                      {marketActive && market.status === MarketStatus.Open && (
                        <Link href={`/market/${market.id}?tab=trade`}>
                          <Button variant="outline" size="sm" className="backdrop-blur-sm bg-card/80">Trade More</Button>
                        </Link>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-12 backdrop-blur-sm bg-card/80 rounded-lg p-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading your portfolio...</span>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}