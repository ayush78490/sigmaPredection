"use client"

import { useState, useEffect } from "react"
import { useWeb3Context } from "@/lib/wallet-context"
import { usePredictionMarket } from "@/hooks/use-predection-market"
import Header from "@/components/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, TrendingDown } from "lucide-react"
import Link from "next/link"

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

  if (!account) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold mb-4">Your Portfolio</h1>
          <p className="text-muted-foreground mb-6">Connect your wallet to view your positions</p>
          <Button onClick={connectWallet}>Connect Wallet</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Your Portfolio</h1>
        <p className="text-muted-foreground mb-8">
          Connected: {account.slice(0, 6)}...{account.slice(-4)}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : positions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No positions yet. Start trading!</p>
            <Link href="/">
              <Button className="mt-4">Browse Markets</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4">
            {positions.map((position, index) => (
              <Card key={index} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Link href={`/market/${position.market.slug}`}>
                      <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                        {position.market.question}
                      </h3>
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1">
                      Market ID: {position.market.id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">YES Tokens</p>
                    <p className="text-lg font-bold text-green-500 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {parseFloat(position.yesBalance).toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">NO Tokens</p>
                    <p className="text-lg font-bold text-red-500 flex items-center gap-1">
                      <TrendingDown className="w-4 h-4" />
                      {parseFloat(position.noBalance).toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Invested</p>
                    <p className="text-lg font-bold">{position.totalInvested} BNB</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Current Odds</p>
                    <p className="text-sm">
                      YES: {position.market.yesPrice?.toFixed(1)}% / NO: {position.market.noPrice?.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Link href={`/market/${position.market.slug}`}>
                    <Button variant="outline" size="sm">View Market</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
