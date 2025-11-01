"use client"

import { useState } from "react"
import Header from "@/components/header"
import MarketCard from "@/components/market-card"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { MARKETS } from "@/lib/markets"

interface Market {
  id: string
  title: string
  description: string
  category: string
  yesOdds: number
  noOdds: number
  volume: number
  resolutionDate: string
  slug: string
}

const CATEGORIES = ["All Markets", "Politics", "Finance", "Crypto", "Sports", "Tech", "Economy"]

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("All Markets")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredMarkets = MARKETS.filter((market) => {
    const matchesCategory = selectedCategory === "All Markets" || market.category === selectedCategory
    const matchesSearch = market.title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-balance">Predict Market Outcomes</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Trade your predictions on major events. Buy YES or NO tokens based on your beliefs about the future.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? "bg-primary text-primary-foreground" : ""}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Markets Grid */}
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
      </div>
    </main>
  )
}
