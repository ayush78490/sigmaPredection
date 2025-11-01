"use client"
import { Card } from "@/components/ui/card"
import { TrendingUp, Volume2 } from "lucide-react"
import Link from "next/link"
import type { MARKETS } from "@/lib/markets"

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

interface MarketCardProps {
  market: (typeof MARKETS)[0]
}

export default function MarketCard({ market }: MarketCardProps) {
  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}m`
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}k`
    return `$${vol}`
  }

  const resolutionDate = new Date(market.resolutionDate)
  const daysLeft = Math.max(0, Math.ceil((resolutionDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))

  return (
    <Link href={`/market/${market.slug}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
        <div className="p-4">
          {/* Category Badge */}
          <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            {market.category}
          </div>

          {/* Title */}
          <h3 className="font-bold text-base mb-2 line-clamp-2 text-card-foreground">{market.title}</h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{market.description}</p>

          {/* Odds Section */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* YES */}
            <div className="bg-green-950/30 rounded-lg p-3 border border-green-900">
              <div className="text-xs text-muted-foreground mb-1">YES</div>
              <div className="text-2xl font-bold text-green-500">{market.yesOdds}%</div>
              <div className="text-xs text-green-400 mt-1">{(market.yesOdds / 100).toFixed(2)} price</div>
            </div>

            {/* NO */}
            <div className="bg-red-950/30 rounded-lg p-3 border border-red-900">
              <div className="text-xs text-muted-foreground mb-1">NO</div>
              <div className="text-2xl font-bold text-red-500">{market.noOdds}%</div>
              <div className="text-xs text-red-400 mt-1">{(market.noOdds / 100).toFixed(2)} price</div>
            </div>
          </div>

          {/* Volume & Days Left */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-4 border-b border-border">
            <div className="flex items-center gap-1">
              <Volume2 className="w-4 h-4" />
              <span>{formatVolume(market.volume)} Vol</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              <span>{daysLeft}d left</span>
            </div>
          </div>

          {/* Placeholder for action area */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">Click to trade</p>
          </div>
        </div>
      </Card>
    </Link>
  )
}
