"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import MarketCard from "@/components/market-card"
import CreateMarketModal from "@/components/createMarketModal"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Plus, Trophy } from "lucide-react"
import { useWeb3Context } from "@/lib/wallet-context"
import { usePredictionMarket } from "@/hooks/use-predection-market"
import { useAllMarkets } from "@/hooks/getAllMarkets"
import Footer from "@/components/footer"
import LightRays from "@/components/LightRays"
import { useRouter } from "next/navigation"

const CATEGORIES = [
  "All Markets", "Politics", "Finance", "Crypto", "Sports", "Tech", "Economy", "General"
]

// --- Helper functions ---
const extractCategory = (question: string): string => {
  const lower = question.toLowerCase()
  if (lower.includes("bitcoin") || lower.includes("crypto")) return "Crypto"
  if (lower.includes("election") || lower.includes("president")) return "Politics"
  if (lower.includes("stock") || lower.includes("finance")) return "Finance"
  if (lower.includes("sports") || lower.includes("team") || lower.includes("match")) return "Sports"
  if (lower.includes("tech") || lower.includes("ai") || lower.includes("software")) return "Tech"
  if (lower.includes("economy") || lower.includes("inflation") || lower.includes("gdp")) return "Economy"
  return "General"
}

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

const convertToFrontendMarket = (market: any) => {
  const prices = calculatePrices(market.yesPool, market.noPool)
  const now = new Date()
  const endTime = new Date(market.endTime * 1000)
  return {
    ...market,
    category: market.category || extractCategory(market.question),
    yesPrice: prices.yesPrice,
    noPrice: prices.noPrice,
    yesMultiplier: prices.yesPrice > 0 ? 100 / prices.yesPrice : 0,
    noMultiplier: prices.noPrice > 0 ? 100 / prices.noPrice : 0,
    isActive: market.status === 0 && endTime > now
  }
}

// --- Page Component ---
export default function MarketsPage() {
  const [selectedCategory, setSelectedCategory] = useState("All Markets")
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)

  const router = useRouter()
  const { account, connectWallet, isCorrectNetwork, isInitialized } = useWeb3Context()
  const { markets, isLoading, error, refreshMarkets } = useAllMarkets()
  const { isContractReady } = usePredictionMarket()

  const formattedMarkets = markets.map(m => convertToFrontendMarket(m))

  // Filter logic
  const filteredMarkets = formattedMarkets.filter((market) => {
    const cat = (market.category || "general").toLowerCase()
    const matchesCategory =
      selectedCategory.toLowerCase() === "all markets" || cat === selectedCategory.toLowerCase()
    const matchesSearch = market.question.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Light background animation */}
      <div className="fixed inset-0 z-0">
        <LightRays
          raysOrigin="top-center"
          raysColor="#6366f1"
          raysSpeed={1.5}
          lightSpread={0.8}
          rayLength={1.2}
          followMouse={true}
          noiseAmount={0.1}
          distortion={0.05}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 bg-black/80 min-h-screen">
        <Header />

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Top section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10">
            <h1 className="text-4xl font-bold mb-4 md:mb-0 text-white">All Markets</h1>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={refreshMarkets}
                variant="outline"
                disabled={isLoading}
                className="backdrop-blur-sm bg-card/80"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...
                  </>
                ) : (
                  "Refresh"
                )}
              </Button>

              <Button
                onClick={() => {
                  if (!account) {
                    connectWallet()
                  } else {
                    setShowCreateModal(true)
                  }
                }}
                className="bg-black text-white hover:bg-black/90"
                disabled={!account} // Disable if not connected
              >
                <Plus className="w-5 h-5 mr-2" /> Create Market
              </Button>
            </div>
          </div>

          {/* Connection Prompt for Trading */}
          {/* {!account && isInitialized && (
            <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <Trophy className="w-5 h-5 text-blue-500 mr-2" />
                <p className="text-blue-500 font-medium">Connect Wallet to Trade</p>
              </div>
              <p className="text-blue-400/80 text-sm mt-1">
                View all markets freely. Connect your wallet to place trades or create markets.
              </p>
              <Button 
                onClick={connectWallet} 
                variant="outline" 
                size="sm" 
                className="mt-2 border-blue-500 text-blue-500 hover:bg-blue-500/10"
              >
                Connect Wallet
              </Button>
            </div>
          )} */}

          {/* Network Warning for Connected Users */}
          {account && !isCorrectNetwork && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
                <p className="text-yellow-500 font-medium">Wrong Network</p>
              </div>
              <p className="text-yellow-400/80 text-sm mt-1">
                Please switch to the correct network to trade or create markets.
              </p>
            </div>
          )}

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white" />
              <input
                type="text"
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-black/10 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-sm"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mb-10">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat)}
                className={`backdrop-blur-sm bg-card/80 ${
                  selectedCategory === cat ? "bg-primary text-black" : ""
                }`}
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center py-12 backdrop-blur-sm bg-card/80 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading markets...</span>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-6">
              <p className="text-destructive font-medium">Error loading markets</p>
              <p className="text-destructive/80 text-sm mt-1">{error}</p>
              <Button onClick={refreshMarkets} variant="outline" size="sm" className="mt-2">
                Try Again
              </Button>
            </div>
          )}

          {/* Market Grid - ALWAYS show markets when available, regardless of connection */}
          {!isLoading && !error && (
            <>
              {filteredMarkets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMarkets.map((market) => (
                    <MarketCard
                      key={market.id}
                      market={market}
                      // Only disable trading actions, not viewing
                      // Remove the disabled prop entirely or set it based on specific conditions
                      disabled={!account || !isCorrectNetwork}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No markets found. {account && "Be the first to create one!"}
                </div>
              )}
            </>
          )}
        </div>

        <Footer />

        {showCreateModal && (
          <CreateMarketModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false)
              refreshMarkets()
            }}
          />
        )}
      </div>
    </main>
  )
}