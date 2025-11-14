"use client"

import { useState } from "react"
import Header from "@/components/header"
import CreateMarketModal from "@/components/createMarketModal"
import { Button } from "@/components/ui/button"
import { Loader2, Trophy } from "lucide-react"
import { useWeb3Context } from "@/lib/wallet-context"
import Footer from "@/components/footer"
import { useRouter } from "next/navigation"
import LightRays from "@/components/LightRays"

export default function LandingPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const router = useRouter()

  const { account, connectWallet, isCorrectNetwork, isConnecting, isInitialized } = useWeb3Context()

  const handleExplore = () => {
    router.push("/markets")
  }
  const handleLeaderboardClick = () => {
    router.push('/leaderboard')
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

      {/* Content overlay for better readability */}
      <div className="relative z-10 bg-black/80 min-h-screen">
        <Header />

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Initializing State */}
          {!isInitialized && (
            <div className="flex justify-center items-center py-12 backdrop-blur-sm bg-card/80 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Initializing Web3...</span>
            </div>
          )}

          {/* Landing Page Content - Always shown after initialization */}
          {isInitialized && (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              {/* GOPREDIX header */}
              <h1 className="text-4xl md:text-5xl font-bold mb-10 tracking-widest text-white">GOPREDIX</h1>
              
              {/* Centered design from reference image */}
              <div className="max-w-2xl w-full text-center flex flex-col items-center">
                <p className="text-base md:text-lg text-white mb-10" style={{ fontFamily: 'monospace' }}>
                  Predict the outcome of future events and earn rewards for your accuracy.
                  Create your own markets on any topic you can imagine.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <button
                    className="px-8 py-3 rounded-full bg-[#ECFEFF]/50 text-white font-medium text-lg shadow hover:bg-[#ECFEFF] hover:text-black transition"
                    onClick={handleExplore}
                  >
                    Explore Markets
                  </button>
                  <button
                    className="px-8 py-3 rounded-full border border-[#ECFEFF] font-medium text-lg text-white bg-transparent hover:bg-[#ECFEFF] hover:text-black transition"
                    onClick={() => connectWallet()}
                  >
                    Create Market
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <Footer/>

        {/* Create Market Modal */}
        {showCreateModal && (
          <CreateMarketModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => setShowCreateModal(false)}
          />
        )}
      </div>
    </main>
  )
}