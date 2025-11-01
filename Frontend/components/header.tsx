"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/lib/wallet-context"

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { account, isConnected, connect, disconnect, balance } = useWallet()

  const categories = ["All Markets", "Politics", "Finance", "Crypto", "Sports", "Tech", "Economy"]

  const displayAddress = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"

  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">Σ</span>
            </div>
            <span className="text-xl font-bold">PredictMarket</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {categories.slice(0, 4).map((cat) => (
              <Button key={cat} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                {cat}
              </Button>
            ))}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setIsOpen(!isOpen)}
              >
                More
                <ChevronDown className="w-4 h-4" />
              </Button>
              {isOpen && (
                <div className="absolute top-full left-0 mt-2 bg-card border border-border rounded-lg shadow-lg py-2 z-50">
                  {categories.slice(4).map((cat) => (
                    <Button
                      key={cat}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground hover:text-foreground"
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
            <span className="text-sm font-medium">Portfolio:</span>
            <span className="text-sm font-bold">{balance ? `${balance} BNB` : "$0.00"}</span>
          </div>
          {isConnected ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled>
                {displayAddress}
              </Button>
              <Button size="sm" variant="outline" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={connect}>
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
