"use client"

import { useState, useEffect } from "react"
import Header from "@/components/header"
import MarketCard from "@/components/market-card"
import CreateMarketModal from "../components/createMarketModal"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Plus, Wallet } from "lucide-react"
import { useWeb3Context } from "@/lib/wallet-context"
import { usePredictionMarket } from "@/hooks/use-predection-market"

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

// Convert market data to frontend format
const convertToFrontendMarket = (market: any) => {
  const category = extractCategory(market.question)
  const resolutionDate = new Date(market.endTime * 1000)
  const now = new Date()

  return {
    id: market.id.toString(),
    title: market.question.length > 60 ? market.question.substring(0, 60) + "..." : market.question,
    description: market.question,
    category,
    yesOdds: market.yesPrice || 50,
    noOdds: market.noPrice || 50,
    volume: parseFloat(market.totalBacking?.toString() || "0") * 2000,
    resolutionDate: resolutionDate.toISOString(),
    slug: `market-${market.id}`,
    onChainData: market,
    status: market.status,
    isActive: resolutionDate > now // ✅ ONLY check resolution date
  }
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("All Markets")
  const [searchQuery, setSearchQuery] = useState("")
  const [markets, setMarkets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { account, connectWallet, isCorrectNetwork, isConnecting, error: web3Error, isInitialized } = useWeb3Context()
  const { getAllMarkets, isContractReady } = usePredictionMarket()

  // Load markets from blockchain
  const loadMarkets = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      console.log("🔄 Loading markets...")
      console.log("Contract Ready:", isContractReady)
      console.log("Account:", account)

      if (!isContractReady) {
        console.log("❌ Contract not ready")
        setError("Contract not ready. Please ensure you're connected to the correct network.")
        return
      }

      console.log("✅ Fetching markets from blockchain...")
      const onChainMarkets = await getAllMarkets()
      
      // Convert to frontend format
      const formattedMarkets = onChainMarkets.map(market => 
        convertToFrontendMarket(market)
      )
      
      setMarkets(formattedMarkets)
      console.log(`✅ Loaded ${formattedMarkets.length} markets`)
      console.log("Markets active status:", formattedMarkets.map(m => ({
        id: m.id,
        isActive: m.isActive,
        resolutionDate: m.resolutionDate,
        now: new Date().toISOString()
      })))
      
    } catch (err: any) {
      console.error("❌ Failed to load markets:", err)
      setError(err.message || "Failed to load markets from blockchain")
    } finally {
      setIsLoading(false)
    }
  }

  // Effect to load markets when ready
  useEffect(() => {
    console.log("=== Home Page State ===")
    console.log("Initialized:", isInitialized)
    console.log("Contract Ready:", isContractReady)
    console.log("Account:", account)
    console.log("Correct Network:", isCorrectNetwork)
    
    // Wait for initialization
    if (!isInitialized) {
      console.log("⏳ Waiting for initialization...")
      return
    }

    // If wrong network, show network error
    if (!isCorrectNetwork) {
      setIsLoading(false)
      setError("Please switch to the correct network")
      return
    }

    // If contract is ready, load markets
    if (isContractReady) {
      console.log("✅ All conditions met, loading markets...")
      loadMarkets()
    } else {
      setIsLoading(false)
      setError("Contract not ready. Please check your network connection.")
    }
  }, [isInitialized, isContractReady, isCorrectNetwork])

  // Filter markets based on category and search
  const filteredMarkets = markets.filter((market) => {
    const matchesCategory = selectedCategory === "All Markets" || market.category === selectedCategory
    const matchesSearch = market.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         market.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Handle market creation success
  const handleMarketCreated = (marketId: number) => {
    setShowCreateModal(false)
    // Reload markets to show the new one
    loadMarkets()
  }

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
                onClick={loadMarkets} 
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
        {account && isCorrectNetwork && !isLoading && !error && markets.length === 0 && (
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
            <Button onClick={loadMarkets} variant="outline" size="sm" className="mt-2">
              Try Again
            </Button>
          </div>
        )}

        {/* Markets Grid */}
        {account && isCorrectNetwork && !isLoading && !error && markets.length > 0 && (
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
        {account && isCorrectNetwork && !isLoading && !error && markets.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">{markets.length}</span> total markets
              </div>
              <div>
                <span className="font-medium">
                  {markets.filter(m => m.isActive).length}
                </span> active markets
              </div>
              <div>
                <span className="font-medium">
                  {markets.filter(m => m.status === 4).length}
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
