import { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import { Market, MarketStatus, Outcome } from './use-predection-market'
import contractABI from '@/contracts/abi.json'

// Get contract address and RPC URL from environment variables
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545' // BSC Testnet fallback

export function useAllMarkets() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create a read-only provider and contract instance
  const getReadOnlyContract = useCallback(() => {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured in environment variables')
    }

    try {
      // Create provider without wallet connection - for reading only
      const provider = new ethers.JsonRpcProvider(RPC_URL)
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
      return contract
    } catch (error) {
      console.error('Error creating read-only contract:', error)
      throw error
    }
  }, [])

  const getMarket = useCallback(async (marketId: number): Promise<Market | null> => {
    try {
      const contract = getReadOnlyContract()
      const marketData = await contract.markets(marketId)
      
      // Remove surrounding quotes from question if they exist
      let question = marketData[1] || `Market ${marketId}`
      if (typeof question === 'string' && question.startsWith('"') && question.endsWith('"')) {
        question = question.slice(1, -1)
      }

      // Calculate prices and multipliers
      const yesPool = parseFloat(ethers.formatEther(marketData[8] || 0))
      const noPool = parseFloat(ethers.formatEther(marketData[9] || 0))
      const totalPool = yesPool + noPool
      
      const yesPrice = totalPool > 0 ? (yesPool / totalPool) * 100 : 50
      const noPrice = totalPool > 0 ? (noPool / totalPool) * 100 : 50
      
      const yesMultiplier = yesPrice > 0 ? 100 / yesPrice : 0
      const noMultiplier = noPrice > 0 ? 100 / noPrice : 0
      
      // Convert to Market type matching the interface exactly
      return {
        id: marketId,
        creator: marketData[0] || "0x0000000000000000000000000000000000000000",
        question: question,
        category: marketData[2] || "General",
        endTime: Number(marketData[3] || 0),
        status: Number(marketData[4] || 0) as MarketStatus,
        outcome: Number(marketData[5] || 0) as Outcome,
        yesToken: marketData[6] || "0x0000000000000000000000000000000000000000",
        noToken: marketData[7] || "0x0000000000000000000000000000000000000000",
        yesPool: ethers.formatEther(marketData[8] || 0),
        noPool: ethers.formatEther(marketData[9] || 0),
        lpTotalSupply: ethers.formatEther(marketData[10] || 0),
        totalBacking: ethers.formatEther(marketData[11] || 0),
        platformFees: ethers.formatEther(marketData[12] || 0),
        resolutionRequestedAt: Number(marketData[13] || 0),
        disputeDeadline: Number(marketData[14] || 0),
        resolutionReason: marketData[15] || '',
        resolutionConfidence: Number(marketData[16] || 0),
        yesPrice,
        noPrice,
        yesMultiplier,
        noMultiplier
      }
    } catch (error) {
      console.error(`Error fetching market ${marketId}:`, error)
      return null
    }
  }, [getReadOnlyContract])

  const getAllMarkets = useCallback(async (): Promise<Market[]> => {
    if (!CONTRACT_ADDRESS) {
      console.error("Contract address not configured")
      return []
    }

    try {
      console.log("📋 Fetching all markets from contract...")
      const contract = getReadOnlyContract()
      
      // Get the next market ID to know how many markets exist
      const nextId = await contract.nextMarketId()
      const marketCount = Number(nextId)
      console.log(`Found ${marketCount} markets on chain`)
      
      if (marketCount === 0) {
        console.log("No markets found on chain")
        return []
      }

      // Fetch all markets in parallel for better performance
      const marketPromises: Promise<Market | null>[] = []
      for (let i = 0; i < marketCount; i++) {
        marketPromises.push(getMarket(i))
      }

      const marketsData = await Promise.all(marketPromises)
      
      // Filter out null values (failed fetches) and ensure valid markets
      const validMarkets = marketsData.filter((market): market is Market => 
        market !== null && market.question !== undefined && market.question !== ''
      )
      
      console.log(`✅ Successfully loaded ${validMarkets.length} valid markets`)
      return validMarkets
      
    } catch (error) {
      console.error("❌ Error fetching all markets:", error)
      throw error
    }
  }, [CONTRACT_ADDRESS, getReadOnlyContract, getMarket])

  const loadMarkets = useCallback(async () => {
    if (!CONTRACT_ADDRESS) {
      setError("Contract address not configured. Please check environment variables.")
      setMarkets([])
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const marketsData = await getAllMarkets()
      setMarkets(marketsData)
      
      if (marketsData.length === 0) {
        setError("No markets found on the blockchain")
      }
    } catch (err: any) {
      console.error('Error loading markets:', err)
      setError(err.message || 'Failed to load markets from blockchain')
      setMarkets([])
    } finally {
      setIsLoading(false)
    }
  }, [CONTRACT_ADDRESS, getAllMarkets])

  // Auto-load markets on mount
  useEffect(() => {
    loadMarkets()
  }, [loadMarkets])

  const refreshMarkets = useCallback(async () => {
    await loadMarkets()
  }, [loadMarkets])

  return {
    markets,
    isLoading,
    error,
    refreshMarkets,
    getAllMarkets,
    isContractReady: !!CONTRACT_ADDRESS // Contract is ready if address is configured
  }
}