"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import Link from "next/link"
import { useWeb3Context } from "@/lib/wallet-context"

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { account, connectWallet, disconnectWallet } = useWeb3Context()

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
          {/* Portfolio Link */}
          <Link href="/profile">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
              Portfolio
            </Button>
          </Link>

          {/* Wallet Section */}
          {account ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled>
                {displayAddress}
              </Button>
              <Button size="sm" variant="outline" onClick={disconnectWallet}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={connectWallet}>
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
