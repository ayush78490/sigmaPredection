"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import MarketCard from "@/components/market-card"
import CreateMarketModal from "../components/createMarketModal"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Plus, Wallet } from "lucide-react"
import { useWeb3Context } from "@/lib/wallet-context"
import { usePredictionMarket } from "@/hooks/use-predection-market"
import { useAllMarkets } from "@/hooks/getAllMarkets" // Fixed import path

const CATEGORIES = ["All Markets", "Politics", "Finance", "Crypto", "Sports", "Tech", "Economy"]

// Helper function to extract category from question
const extractCategory = (question: string): string => {
  const lowerQuestion = question.toLowerCase()
  
  if (lowerQuestion.includes('bitcoin') || lowerQuestion.includes('crypto') || lowerQuestion.includes('ethereum')) 
    return "Crypto"
  if (lowerQuestion.includes('election') || lowerQuestion.includes('president') || lowerQuestion.includes('politics')) 
    return "Politics"
  if (lowerQuestion.includes('stock') || lowerQuestion.includes('finance') || lowerQuestion.includes('market')) 
    return "Finance"
  if (lowerQuestion.includes('sports') || lowerQuestion.includes('game') || lowerQuestion.includes('team')) 
    return "Sports"
  if (lowerQuestion.includes('tech') || lowerQuestion.includes('ai') || lowerQuestion.includes('software')) 
    return "Tech"
  if (lowerQuestion.includes('economy') || lowerQuestion.includes('gdp') || lowerQuestion.includes('inflation')) 
    return "Economy"
  
  return "General"
}

// Calculate prices from pool data
const calculatePrices = (yesPool: string, noPool: string) => {
  const yes = parseFloat(yesPool) || 0
  const no = parseFloat(noPool) || 0
  const total = yes + no
  
  if (total === 0) return { yesPrice: 50, noPrice: 50 }
  
  return {
    yesPrice: (yes / total) * 100,
    noPrice: (no / total) * 100
  }
}

// Convert market data to frontend format
const convertToFrontendMarket = (market: any) => {
  const category = market.category || extractCategory(market.question)
  const resolutionDate = new Date(market.endTime * 1000)
  const now = new Date()
  
  // Calculate prices from pool data
  const prices = calculatePrices(market.yesPool, market.noPool)

  // Return the exact Market interface expected by MarketCard
  return {
    id: market.id,
    creator: market.creator,
    question: market.question,
    category: market.category || "General",
    endTime: market.endTime,
    status: market.status,
    outcome: market.outcome,
    yesToken: market.yesToken,
    noToken: market.noToken,
    yesPool: market.yesPool,
    noPool: market.noPool,
    lpTotalSupply: market.lpTotalSupply,
    totalBacking: market.totalBacking,
    platformFees: market.platformFees,
    resolutionRequestedAt: market.resolutionRequestedAt,
    disputeDeadline: market.disputeDeadline,
    resolutionReason: market.resolutionReason,
    resolutionConfidence: market.resolutionConfidence,
    yesPrice: prices.yesPrice,
    noPrice: prices.noPrice,
    yesMultiplier: prices.yesPrice > 0 ? 100 / prices.yesPrice : 0,
    noMultiplier: prices.noPrice > 0 ? 100 / prices.noPrice : 0,
    // Add the missing properties for filtering
    isActive: market.status === 0 && resolutionDate > now
  }
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("All Markets")
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { account, connectWallet, isCorrectNetwork, isConnecting, error: web3Error, isInitialized } = useWeb3Context()
  const { createMarket } = usePredictionMarket()
  const { markets, isLoading, error, refreshMarkets } = useAllMarkets()

  // Convert markets to frontend format
  const formattedMarkets = markets.map(market => convertToFrontendMarket(market))

  // Filter markets based on category and search
  const filteredMarkets = formattedMarkets.filter((market) => {
    const matchesCategory = selectedCategory === "All Markets" || market.category === selectedCategory
    // Use question for search since we don't have title/description in the converted market
    const matchesSearch = market.question.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Handle market creation success
  const handleMarketCreated = (marketId: number) => {
    setShowCreateModal(false)
    // Refresh markets to show the new one
    refreshMarkets()
  }

  // Debug logging
  useEffect(() => {
    console.log("=== Home Page State ===")
    console.log("Initialized:", isInitialized)
    console.log("Account:", account)
    console.log("Correct Network:", isCorrectNetwork)
    console.log("Markets:", markets.length)
    console.log("Loading:", isLoading)
    console.log("Error:", error)
  }, [isInitialized, account, isCorrectNetwork, markets.length, isLoading, error])

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 text-balance">Predict Market Outcomes</h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Trade your predictions on major events. Buy YES or NO tokens based on your beliefs about the future.
            </p>
          </div>
          
          <Button 
            onClick={() => setShowCreateModal(true)}
            size="lg"
            className="mt-4 md:mt-0 bg-black text-white hover:bg-black/90"
            disabled={!account}
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Market
          </Button>
        </div>

        
        {/* Network Warning */}
        {account && !isCorrectNetwork && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-red-800 font-semibold">Wrong Network</h3>
                <p className="text-red-700 text-sm mt-1">
                  Please switch to the correct network to use this application.
                </p>
              </div>
              <Button 
                onClick={() => window.ethereum?.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: '0x61' }], // BSC Testnet
                })}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Switch Network
              </Button>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        {account && isCorrectNetwork && (
          <div className="mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <Button 
                onClick={refreshMarkets} 
                disabled={isLoading}
                variant="outline"
                className="whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Refresh Markets"
                )}
              </Button>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={selectedCategory === category ? "bg-primary text-black" : ""}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Initializing State */}
        {!isInitialized && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Initializing...</span>
          </div>
        )}

        {/* Wallet Not Connected State */}
        {!account && isInitialized && !isLoading && (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Wallet className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
              <p className="text-muted-foreground mb-6">
                Connect your wallet to view prediction markets and start trading.
              </p>
              <Button 
                onClick={connectWallet}
                disabled={isConnecting}
                size="lg"
                className="bg-black text-white hover:bg-black/90"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5 mr-2" />
                    Connect Wallet
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Empty State - No markets created yet */}
        {account && isCorrectNetwork && !isLoading && !error && formattedMarkets.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Plus className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No markets yet</h3>
              <p className="text-muted-foreground mb-6">
                Be the first to create a prediction market and start trading!
              </p>
              <Button 
                onClick={() => setShowCreateModal(true)} 
                size="lg"
                className="bg-black text-white hover:bg-black/90"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create First Market
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {account && isCorrectNetwork && isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading markets from blockchain...</span>
          </div>
        )}

        {/* Error State */}
        {account && isCorrectNetwork && error && !isLoading && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-6">
            <p className="text-destructive font-medium">❌ Error loading markets</p>
            <p className="text-destructive/80 text-sm mt-1">{error}</p>
            <Button onClick={refreshMarkets} variant="outline" size="sm" className="mt-2">
              Try Again
            </Button>
          </div>
        )}

        {/* Markets Grid */}
        {account && isCorrectNetwork && !isLoading && !error && formattedMarkets.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>

            {filteredMarkets.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">No markets found matching your search.</p>
              </div>
            )}
          </>
        )}

        {/* Stats */}
        {account && isCorrectNetwork && !isLoading && !error && formattedMarkets.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">{formattedMarkets.length}</span> total markets
              </div>
              <div>
                <span className="font-medium">
                  {formattedMarkets.filter(m => m.isActive).length}
                </span> active markets
              </div>
              <div>
                <span className="font-medium">
                  {formattedMarkets.filter(m => m.status === 3).length} {/* Resolved status */}
                </span> resolved
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Market Modal */}
      {showCreateModal && (
        <CreateMarketModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleMarketCreated}
        />
      )}
    </main>
  )
}