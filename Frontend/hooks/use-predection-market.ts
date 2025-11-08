import { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import { useWeb3Context } from '@/lib/wallet-context'
import PREDICTION_MARKET_ABI from '../contracts/abi.json'

// Contract address
const PREDICTION_MARKET_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x52Ca4B7673646B8b922ea00ccef6DD0375B14619'

// Updated Types to match new contract
export enum MarketStatus {
  Open = 0,
  Closed = 1,
  ResolutionRequested = 2,
  Resolved = 3,
  Disputed = 4
}

export enum Outcome {
  Undecided = 0,
  Yes = 1,
  No = 2
}

export interface Market {
  id: number
  creator: string
  question: string
  category: string
  endTime: number
  status: MarketStatus
  outcome: Outcome
  yesToken: string
  noToken: string
  yesPool: string
  noPool: string
  lpTotalSupply: string
  totalBacking: string
  platformFees: string
  resolutionRequestedAt: number
  disputeDeadline: number
  resolutionReason: string
  resolutionConfidence: number
  yesPrice?: number
  noPrice?: number
  yesMultiplier?: number
  noMultiplier?: number
}

export interface MarketCreationParams {
  question: string
  category: string
  endTime: number
  initialYes: string
  initialNo: string
}

export interface MultiplierInfo {
  multiplier: number
  totalOut: string
  totalFee: string
}

export interface TradingInfo {
  yesMultiplier: number
  noMultiplier: number
  yesPrice: number
  noPrice: number
  totalLiquidity: string
}

export interface SwapMultiplierInfo {
  multiplier: number
  amountOut: string
  fee: string
}

// AI Validation Helper
async function validateMarketWithPerplexity(params: MarketCreationParams): Promise<{ valid: boolean, reason?: string, category?: string }> {
  try {
    const res = await fetch('https://sigma-predection.vercel.app/api/validate-market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    if (!res.ok) {
      let errorMessage = 'Failed to validate market with AI'
      try {
        const errorData = await res.json()
        errorMessage = errorData.reason || errorData.error || errorMessage
      } catch {
        errorMessage = res.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    return await res.json()
  } catch (error: any) {
    console.error('Validation request failed:', error)
    throw new Error(error.message || 'Network error during validation')
  }
}

export function usePredictionMarket() {
  const { account, provider, signer, isCorrectNetwork } = useWeb3Context()
  const [isLoading, setIsLoading] = useState(false)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [isContractReady, setIsContractReady] = useState(false)

  // Initialize contract
  useEffect(() => {
    const initializeContract = async () => {
      if (!provider) {
        console.log("❌ No provider available yet")
        setContract(null)
        setIsContractReady(false)
        return
      }

      try {
        console.log("🔍 Initializing contract with address:", PREDICTION_MARKET_ADDRESS)
        
        const network = await provider.getNetwork()
        console.log("🌐 Current network chain ID:", network.chainId)
        
        // BSC Testnet chain ID is 97
        if (network.chainId !== BigInt(97)) {
          console.warn("⚠️ Not on BSC Testnet. Current chain:", network.chainId)
          setContract(null)
          setIsContractReady(false)
          return
        }

        const predictionMarketContract = new ethers.Contract(
          PREDICTION_MARKET_ADDRESS,
          PREDICTION_MARKET_ABI,
          provider
        )
        
        try {
          const nextId = await (predictionMarketContract as any).nextMarketId()
          console.log("✅ Contract connection successful. Next market ID:", Number(nextId))
          setContract(predictionMarketContract)
          setIsContractReady(true)
        } catch (testError) {
          console.error("❌ Contract verification failed:", testError)
          setContract(null)
          setIsContractReady(false)
        }
        
      } catch (error) {
        console.error("❌ Error initializing contract:", error)
        setContract(null)
        setIsContractReady(false)
      }
    }

    initializeContract()
  }, [provider])

  // ==================== MARKET CREATION ====================

  const createMarket = useCallback(async (
    params: MarketCreationParams
  ): Promise<number> => {
    if (!signer || !account || !isCorrectNetwork) {
      throw new Error('Wallet not connected or wrong network')
    }
    if (!isContractReady) {
      throw new Error('Contract not ready - please ensure you\'re on BSC Testnet')
    }

    setIsLoading(true)
    try {
      console.log('🤖 Validating market question with AI...')
      const validation = await validateMarketWithPerplexity(params)
      if (!validation.valid) {
        console.error('❌ AI validation failed:', validation.reason)
        throw new Error(validation.reason || 'Market question did not pass AI validation')
      }
      console.log('✅ AI validation passed. Category:', validation.category)

      const contractWithSigner = new ethers.Contract(
        PREDICTION_MARKET_ADDRESS,
        PREDICTION_MARKET_ABI,
        signer
      )

      // Convert amounts to wei
      const initialYesWei = ethers.parseEther(params.initialYes)
      const initialNoWei = ethers.parseEther(params.initialNo)
      const totalValue = initialYesWei + initialNoWei

      console.log('📝 Creating market onchain...')
      const tx = await (contractWithSigner as any).createMarket(
        params.question,
        validation.category || 'OTHER', // Use AI-determined category
        BigInt(params.endTime),
        initialYesWei,
        initialNoWei,
        { value: totalValue }
      )

      console.log('⏳ Waiting for transaction confirmation...')
      const receipt = await tx.wait()

      let marketId: number
      const marketCreatedTopic = ethers.id('MarketCreated(uint256,string,string,address,address,uint256)')
      const event = receipt?.logs.find((log: any) => log.topics[0] === marketCreatedTopic)

      if (event) {
        const iface = new ethers.Interface(PREDICTION_MARKET_ABI)
        const decodedEvent = iface.parseLog(event)
        marketId = Number(decodedEvent?.args.id)
      } else {
        const nextId = await (contractWithSigner as any).nextMarketId()
        marketId = Number(nextId) - 1
      }

      console.log('✅ Market created successfully with ID:', marketId)
      return marketId

    } catch (error: any) {
      console.error('❌ Error creating market:', error)
      throw new Error(error.reason || error.message || 'Failed to create market')
    } finally {
      setIsLoading(false)
    }
  }, [signer, account, isCorrectNetwork, isContractReady])

  // ==================== MARKET DATA FETCHING ====================

  const getMarket = useCallback(async (marketId: number): Promise<Market> => {
    if (!contract) throw new Error('Contract not available')

    try {
      console.log(`📊 Fetching market ${marketId}...`)
      const marketData = await (contract as any).markets(BigInt(marketId))
      
      console.log(`Raw market data for ${marketId}:`, marketData)

      // FIX: Remove quotes from the question
      let question = marketData[1] || `Market ${marketId}`
      // Remove surrounding quotes if they exist
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

      const market: Market = {
        id: marketId,
        creator: marketData[0] || "0x0000000000000000000000000000000000000000",
        question: question, // Use the cleaned question
        category: marketData[2] || "General",
        endTime: Number(marketData[3] || 0),
        status: marketData[4] || MarketStatus.Open,
        outcome: marketData[5] || Outcome.Undecided,
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

      console.log(`Processed market ${marketId}:`, market)
      return market

    } catch (error) {
      console.error('❌ Error fetching market:', error)
      throw error
    }
  }, [contract])

  // ==================== MULTIPLIER & PRICE CALCULATIONS ====================

  const getBuyYesMultiplier = useCallback(async (
    marketId: number, 
    bnbAmount: string
  ): Promise<MultiplierInfo> => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      const amountInWei = ethers.parseEther(bnbAmount)
      const result = await (contract as any).getBuyYesMultiplier(BigInt(marketId), amountInWei)
      
      return {
        multiplier: Number(result[0]) / 10000, // Convert from scaled value (15000 = 1.5x)
        totalOut: ethers.formatEther(result[1]),
        totalFee: ethers.formatEther(result[2])
      }
    } catch (error) {
      console.error('❌ Error calculating YES multiplier:', error)
      throw error
    }
  }, [contract])

  const getBuyNoMultiplier = useCallback(async (
    marketId: number, 
    bnbAmount: string
  ): Promise<MultiplierInfo> => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      const amountInWei = ethers.parseEther(bnbAmount)
      const result = await (contract as any).getBuyNoMultiplier(BigInt(marketId), amountInWei)
      
      return {
        multiplier: Number(result[0]) / 10000,
        totalOut: ethers.formatEther(result[1]),
        totalFee: ethers.formatEther(result[2])
      }
    } catch (error) {
      console.error('❌ Error calculating NO multiplier:', error)
      throw error
    }
  }, [contract])

  const getCurrentMultipliers = useCallback(async (
    marketId: number
  ): Promise<{ yesMultiplier: number; noMultiplier: number; yesPrice: number; noPrice: number }> => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      const result = await (contract as any).getCurrentMultipliers(BigInt(marketId))
      
      return {
        yesMultiplier: Number(result[0]) / 10000,
        noMultiplier: Number(result[1]) / 10000,
        yesPrice: Number(result[2]) / 100, // Convert from basis points to percentage
        noPrice: Number(result[3]) / 100
      }
    } catch (error) {
      console.error('❌ Error fetching current multipliers:', error)
      throw error
    }
  }, [contract])

  const getTradingInfo = useCallback(async (marketId: number): Promise<TradingInfo> => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      const result = await (contract as any).getTradingInfo(BigInt(marketId))
      
      return {
        yesMultiplier: Number(result[0]) / 10000,
        noMultiplier: Number(result[1]) / 10000,
        yesPrice: Number(result[2]) / 100,
        noPrice: Number(result[3]) / 100,
        totalLiquidity: ethers.formatEther(result[4])
      }
    } catch (error) {
      console.error('❌ Error fetching trading info:', error)
      throw error
    }
  }, [contract])

  const getSwapMultiplier = useCallback(async (
    marketId: number,
    amountIn: string,
    isYesIn: boolean
  ): Promise<SwapMultiplierInfo> => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      const amountInWei = ethers.parseEther(amountIn)
      const result = await (contract as any).getSwapMultiplier(BigInt(marketId), amountInWei, isYesIn)
      
      return {
        multiplier: Number(result[0]) / 10000,
        amountOut: ethers.formatEther(result[1]),
        fee: ethers.formatEther(result[2])
      }
    } catch (error) {
      console.error('❌ Error calculating swap multiplier:', error)
      throw error
    }
  }, [contract])

  // ==================== PRICE CALCULATIONS ====================

  const getYesPrice = useCallback(async (marketId: number): Promise<number> => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      const price = await (contract as any).getYesPrice(BigInt(marketId))
      return Number(price) / 100 // Convert from basis points to percentage
    } catch (error) {
      console.error('❌ Error fetching YES price:', error)
      throw error
    }
  }, [contract])

  const getNoPrice = useCallback(async (marketId: number): Promise<number> => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      const price = await (contract as any).getNoPrice(BigInt(marketId))
      return Number(price) / 100 // Convert from basis points to percentage
    } catch (error) {
      console.error('❌ Error fetching NO price:', error)
      throw error
    }
  }, [contract])

  // ==================== TRADING FUNCTIONS ====================

  const buyYesWithBNB = useCallback(async (
    marketId: number,
    minTokensOut: string,
    amountIn: string
  ) => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected or wrong network')
    
    const contractWithSigner = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      signer
    )
    
    const amountInWei = ethers.parseEther(amountIn)
    const minOutWei = ethers.parseEther(minTokensOut)
    
    const tx = await (contractWithSigner as any).buyYesWithBNB(
      BigInt(marketId),
      minOutWei,
      { value: amountInWei }
    )
    
    return await tx.wait()
  }, [signer, isCorrectNetwork])

  const buyNoWithBNB = useCallback(async (
    marketId: number,
    minTokensOut: string,
    amountIn: string
  ) => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected or wrong network')
    
    const contractWithSigner = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      signer
    )
    
    const amountInWei = ethers.parseEther(amountIn)
    const minOutWei = ethers.parseEther(minTokensOut)
    
    const tx = await (contractWithSigner as any).buyNoWithBNB(
      BigInt(marketId),
      minOutWei,
      { value: amountInWei }
    )
    
    return await tx.wait()
  }, [signer, isCorrectNetwork])

  const swapTokens = useCallback(async (
    marketId: number, 
    amountIn: string, 
    minOut: string, 
    isYesIn: boolean
  ) => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected or wrong network')
    
    const contractWithSigner = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      signer
    )
    
    const amountInWei = ethers.parseEther(amountIn)
    const minOutWei = ethers.parseEther(minOut)
    
    let tx
    if (isYesIn) {
      tx = await (contractWithSigner as any).swapYesForNo(
        BigInt(marketId), 
        amountInWei, 
        minOutWei
      )
    } else {
      tx = await (contractWithSigner as any).swapNoForYes(
        BigInt(marketId), 
        amountInWei, 
        minOutWei
      )
    }
    
    return await tx.wait()
  }, [signer, isCorrectNetwork])

  // ==================== AI RESOLUTION SYSTEM ====================

  const requestResolution = useCallback(async (marketId: number) => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected or wrong network')
    
    const contractWithSigner = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      signer
    )
    
    const tx = await (contractWithSigner as any).requestResolution(BigInt(marketId))
    return await tx.wait()
  }, [signer, isCorrectNetwork])

  const initiateDispute = useCallback(async (marketId: number, reason: string) => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected or wrong network')
    
    const contractWithSigner = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      signer
    )
    
    const tx = await (contractWithSigner as any).initiateDispute(BigInt(marketId), reason)
    return await tx.wait()
  }, [signer, isCorrectNetwork])

  const redeem = useCallback(async (marketId: number) => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected or wrong network')
    
    const contractWithSigner = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      signer
    )
    
    const tx = await (contractWithSigner as any).redeem(BigInt(marketId))
    return await tx.wait()
  }, [signer, isCorrectNetwork])

  // ==================== STATUS CHECKS ====================

  const canRequestResolution = useCallback(async (marketId: number): Promise<boolean> => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      return await (contract as any).canRequestResolution(BigInt(marketId))
    } catch (error) {
      console.error('❌ Error checking resolution status:', error)
      return false
    }
  }, [contract])

  const canDispute = useCallback(async (marketId: number): Promise<boolean> => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      return await (contract as any).canDispute(BigInt(marketId))
    } catch (error) {
      console.error('❌ Error checking dispute status:', error)
      return false
    }
  }, [contract])

  // ==================== USER POSITIONS ====================

  const getUserPositions = useCallback(async (userAddress: string) => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      const nextId = await (contract as any).nextMarketId()
      const marketCount = Number(nextId)
      const positions = []
      
      for (let i = 0; i < marketCount; i++) {
        try {
          const market = await getMarket(i)
          
          const yesTokenContract = new ethers.Contract(
            market.yesToken,
            ['function balanceOf(address) view returns (uint256)'],
            provider
          )
          const noTokenContract = new ethers.Contract(
            market.noToken,
            ['function balanceOf(address) view returns (uint256)'],
            provider
          )
          
          const yesBalance = await yesTokenContract.balanceOf(userAddress)
          const noBalance = await noTokenContract.balanceOf(userAddress)
          
          const yesBalanceFormatted = ethers.formatEther(yesBalance)
          const noBalanceFormatted = ethers.formatEther(noBalance)
          
          if (parseFloat(yesBalanceFormatted) > 0 || parseFloat(noBalanceFormatted) > 0) {
            positions.push({
              market,
              yesBalance: yesBalanceFormatted,
              noBalance: noBalanceFormatted,
              totalInvested: (parseFloat(yesBalanceFormatted) + parseFloat(noBalanceFormatted)).toFixed(4)
            })
          }
        } catch (err) {
          console.warn(`Failed to get position for market ${i}:`, err)
        }
      }
      
      return positions
    } catch (error) {
      console.error('Error fetching user positions:', error)
      throw error
    }
  }, [contract, getMarket, provider])

  return {
    // Core functions
    createMarket,
    getMarket,
    
    // Multiplier & Price calculations
    getBuyYesMultiplier,
    getBuyNoMultiplier,
    getCurrentMultipliers,
    getTradingInfo,
    getSwapMultiplier,
    getYesPrice,
    getNoPrice,
    
    // Trading functions
    buyYesWithBNB,
    buyNoWithBNB,
    swapTokens,
    
    // AI Resolution system
    requestResolution,
    initiateDispute,
    redeem,
    
    // Status checks
    canRequestResolution,
    canDispute,
    
    // User positions
    getUserPositions,
    
    // State
    isLoading,
    contract,
    contractAddress: PREDICTION_MARKET_ADDRESS,
    isContractReady,
    
    // Constants
    MarketStatus,
    Outcome,
  }
}