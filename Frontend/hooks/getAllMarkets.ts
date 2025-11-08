import { useState, useCallback, useEffect } from 'react'
import { Market, MarketStatus, Outcome } from './use-predection-market'
import { usePredictionMarket } from './use-predection-market'

export function useAllMarkets() {
  const { getMarket, contract, isContractReady } = usePredictionMarket()
  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getAllMarkets = useCallback(async (): Promise<Market[]> => {
    if (!contract || !isContractReady) {
      throw new Error("Contract not available - please connect to BSC Testnet")
    }

    try {
      console.log("📋 Fetching all markets...")
      const nextId = await (contract as any).nextMarketId()
      const marketCount = Number(nextId)
      console.log(`Found ${marketCount} markets on chain`)
      
      if (marketCount === 0) return []

      const markets: Market[] = []
      for (let i = 0; i < marketCount; i++) {
        try {
          const market = await getMarket(i)
          markets.push(market)
        } catch (error) {
          console.warn(`⚠️ Failed to fetch market ${i}:`, error)
        }
      }
      
      console.log(`✅ Successfully loaded ${markets.length} markets`)
      return markets
      
    } catch (error) {
      console.error("❌ Error fetching all markets:", error)
      throw error
    }
  }, [contract, isContractReady, getMarket])

  const loadMarkets = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const marketsData = await getAllMarkets()
      setMarkets(marketsData)
    } catch (err: any) {
      setError(err.message || 'Failed to load markets')
      console.error('Error loading markets:', err)
    } finally {
      setIsLoading(false)
    }
  }, [getAllMarkets])

  // Auto-load markets when hook is used
  useEffect(() => {
    loadMarkets()
  }, [loadMarkets])

  const refreshMarkets = useCallback(() => {
    loadMarkets()
  }, [loadMarkets])

  return {
    markets,
    isLoading,
    error,
    refreshMarkets,
    getAllMarkets
  }
}