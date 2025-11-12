import { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import { useWeb3Context } from '@/lib/wallet-context'
import PREDICTION_MARKET_ABI from '../contracts/abi.json'
import HELPER_CONTRACT_ARTIFACT from '../contracts/helperABI.json'

// Extract ABI from helper contract artifact
const HELPER_CONTRACT_ABI = (HELPER_CONTRACT_ARTIFACT as any).abi || HELPER_CONTRACT_ARTIFACT

// Contract addresses
const PREDICTION_MARKET_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x9d8462A5A9CA9d4398069C67FEb378806fD10fAA'
const HELPER_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HELPER_CONTRACT_ADDRESS || '0x00B4af3a7950CF31DdB1dCC4D8413193713CD2b5'

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

export interface UserPosition {
  market: Market
  yesBalance: string
  noBalance: string
  totalInvested: string
  bnbInvested: string
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
  const [helperContract, setHelperContract] = useState<ethers.Contract | null>(null)
  const [isContractReady, setIsContractReady] = useState(false)

  // Initialize contracts
  useEffect(() => {
    const initializeContracts = async () => {
      if (!provider) {
        setContract(null)
        setHelperContract(null)
        setIsContractReady(false)
        return
      }

      try {
        const network = await provider.getNetwork()
        
        // BSC Testnet chain ID is 97
        if (network.chainId !== BigInt(97)) {
          console.warn("⚠️ Not on BSC Testnet. Current chain:", network.chainId)
          setContract(null)
          setHelperContract(null)
          setIsContractReady(false)
          return
        }

        // Initialize main contract
        const predictionMarketContract = new ethers.Contract(
          PREDICTION_MARKET_ADDRESS,
          PREDICTION_MARKET_ABI,
          provider
        )

        // Initialize helper contract
        const helperContractInstance = new ethers.Contract(
          HELPER_CONTRACT_ADDRESS,
          HELPER_CONTRACT_ABI,
          provider
        )
        
        try {
          // Test both contracts
          const nextId = await (predictionMarketContract as any).nextMarketId()
          console.log('✅ Main contract connected. Next market ID:', nextId.toString())
          
          // Test helper contract by calling a simple view function
          await (helperContractInstance as any).predictionMarket()
          console.log('✅ Helper contract connected')
          
          setContract(predictionMarketContract)
          setHelperContract(helperContractInstance)
          setIsContractReady(true)
        } catch (testError) {
          console.error('❌ Contract initialization test failed:', testError)
          setContract(null)
          setHelperContract(null)
          setIsContractReady(false)
        }
        
      } catch (error) {
        console.error('❌ Error initializing contracts:', error)
        setContract(null)
        setHelperContract(null)
        setIsContractReady(false)
      }
    }

    initializeContracts()
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
      const validation = await validateMarketWithPerplexity(params)
      if (!validation.valid) {
        throw new Error(validation.reason || 'Market question did not pass AI validation')
      }

      const contractWithSigner = new ethers.Contract(
        PREDICTION_MARKET_ADDRESS,
        PREDICTION_MARKET_ABI,
        signer
      )

      const initialYesWei = ethers.parseEther(params.initialYes)
      const initialNoWei = ethers.parseEther(params.initialNo)
      const totalValue = initialYesWei + initialNoWei

      const tx = await (contractWithSigner as any).createMarket(
        params.question,
        validation.category || 'OTHER',
        BigInt(params.endTime),
        initialYesWei,
        initialNoWei,
        { value: totalValue }
      )

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
    if (!contract || !helperContract) throw new Error('Contracts not available')

    try {
      const marketData = await (contract as any).markets(BigInt(marketId))

      // Remove quotes from question
      let question = marketData[1] || `Market ${marketId}`
      if (typeof question === 'string' && question.startsWith('"') && question.endsWith('"')) {
        question = question.slice(1, -1)
      }

      // Get enhanced trading info from helper contract
      const tradingInfo = await (helperContract as any).getTradingInfo(BigInt(marketId))
      
      const market: Market = {
        id: marketId,
        creator: marketData[0] || "0x0000000000000000000000000000000000000000",
        question: question,
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
        disputeDeadline: Number(marketData[17] || 0),
        resolutionReason: marketData[15] || '',
        resolutionConfidence: Number(marketData[16] || 0),
        // Use helper contract data for prices and multipliers
        yesPrice: Number(tradingInfo[2]) / 100,
        noPrice: Number(tradingInfo[3]) / 100,
        yesMultiplier: Number(tradingInfo[0]) / 10000,
        noMultiplier: Number(tradingInfo[1]) / 10000
      }

      return market

    } catch (error) {
      console.error('❌ Error fetching market:', error)
      throw error
    }
  }, [contract, helperContract])

  // ==================== USER INVESTMENT FUNCTIONS (USING HELPER) ====================

  const getMarketInvestment = useCallback(async (
    userAddress: string, 
    marketId: number
  ): Promise<string> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      // Use helper contract's getMarketInvestment function
      const investment = await (helperContract as any).getMarketInvestment(BigInt(marketId), userAddress)
      const investmentBNB = ethers.formatEther(investment)
      console.log(`📊 Market ${marketId} investment for ${userAddress}: ${investmentBNB} BNB`)
      return investmentBNB
      
    } catch (error) {
      console.error('❌ Error fetching market investment:', error)
      return "0"
    }
  }, [helperContract])

  const getTotalInvestment = useCallback(async (userAddress: string): Promise<string> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      // Use helper contract's getUserTotalInvestment function
      const totalInvestment = await (helperContract as any).getUserTotalInvestment(userAddress)
      const totalInvestmentBNB = ethers.formatEther(totalInvestment)
      console.log(`💰 Total investment for ${userAddress}: ${totalInvestmentBNB} BNB`)
      return totalInvestmentBNB
      
    } catch (error) {
      console.error('❌ Error fetching total investment:', error)
      return "0"
    }
  }, [helperContract])

  // ==================== USER POSITIONS (USING HELPER) ====================

  const getUserPositions = useCallback(async (userAddress: string): Promise<UserPosition[]> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      console.log('🔍 Fetching user positions from helper contract...')
      
      // Use helper contract's getUserPositions function
      const helperPositions = await (helperContract as any).getUserPositions(userAddress)
      const positions: UserPosition[] = []
      
      for (const pos of helperPositions) {
        const marketId = Number(pos.marketId)
        
        try {
          const market = await getMarket(marketId)
          
          const yesBalanceFormatted = ethers.formatEther(pos.yesBalance)
          const noBalanceFormatted = ethers.formatEther(pos.noBalance)
          const bnbInvested = ethers.formatEther(pos.bnbInvested)
          
          const position: UserPosition = {
            market,
            yesBalance: yesBalanceFormatted,
            noBalance: noBalanceFormatted,
            totalInvested: (parseFloat(yesBalanceFormatted) + parseFloat(noBalanceFormatted)).toFixed(4),
            bnbInvested
          }
          
          positions.push(position)
          console.log(`✅ Position for market ${marketId}:`, position)
          
        } catch (err) {
          console.warn(`⚠️ Failed to get full data for market ${marketId}:`, err)
        }
      }
      
      console.log(`📊 Total positions found: ${positions.length}`)
      return positions
      
    } catch (error) {
      console.error('❌ Error fetching user positions:', error)
      throw error
    }
  }, [helperContract, getMarket])

  // ==================== MULTIPLIER & PRICE CALCULATIONS (USING HELPER) ====================

  const getBuyYesMultiplier = useCallback(async (
    marketId: number, 
    bnbAmount: string
  ): Promise<MultiplierInfo> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      const amountInWei = ethers.parseEther(bnbAmount)
      const result = await (helperContract as any).getBuyYesMultiplier(BigInt(marketId), amountInWei)
      
      return {
        multiplier: Number(result[0]) / 10000,
        totalOut: ethers.formatEther(result[1]),
        totalFee: ethers.formatEther(result[2])
      }
    } catch (error) {
      console.error('❌ Error calculating YES multiplier:', error)
      throw error
    }
  }, [helperContract])

  const getBuyNoMultiplier = useCallback(async (
    marketId: number, 
    bnbAmount: string
  ): Promise<MultiplierInfo> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      const amountInWei = ethers.parseEther(bnbAmount)
      const result = await (helperContract as any).getBuyNoMultiplier(BigInt(marketId), amountInWei)
      
      return {
        multiplier: Number(result[0]) / 10000,
        totalOut: ethers.formatEther(result[1]),
        totalFee: ethers.formatEther(result[2])
      }
    } catch (error) {
      console.error('❌ Error calculating NO multiplier:', error)
      throw error
    }
  }, [helperContract])

  const getCurrentMultipliers = useCallback(async (
    marketId: number
  ): Promise<{ yesMultiplier: number; noMultiplier: number; yesPrice: number; noPrice: number }> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      const result = await (helperContract as any).getCurrentMultipliers(BigInt(marketId))
      
      return {
        yesMultiplier: Number(result[0]) / 10000,
        noMultiplier: Number(result[1]) / 10000,
        yesPrice: Number(result[2]) / 100,
        noPrice: Number(result[3]) / 100
      }
    } catch (error) {
      console.error('❌ Error fetching current multipliers:', error)
      throw error
    }
  }, [helperContract])

  const getTradingInfo = useCallback(async (marketId: number): Promise<TradingInfo> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      const result = await (helperContract as any).getTradingInfo(BigInt(marketId))
      
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
  }, [helperContract])

  const getSwapMultiplier = useCallback(async (
    marketId: number,
    amountIn: string,
    isYesIn: boolean
  ): Promise<SwapMultiplierInfo> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      const amountInWei = ethers.parseEther(amountIn)
      const result = await (helperContract as any).getSwapMultiplier(BigInt(marketId), amountInWei, isYesIn)
      
      return {
        multiplier: Number(result[0]) / 10000,
        amountOut: ethers.formatEther(result[1]),
        fee: ethers.formatEther(result[2])
      }
    } catch (error) {
      console.error('❌ Error calculating swap multiplier:', error)
      throw error
    }
  }, [helperContract])

  // ==================== PRICE CALCULATIONS (USING HELPER) ====================

  const getYesPrice = useCallback(async (marketId: number): Promise<number> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      const price = await (helperContract as any).getYesPrice(BigInt(marketId))
      return Number(price) / 100
    } catch (error) {
      console.error('❌ Error fetching YES price:', error)
      throw error
    }
  }, [helperContract])

  const getNoPrice = useCallback(async (marketId: number): Promise<number> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      const price = await (helperContract as any).getNoPrice(BigInt(marketId))
      return Number(price) / 100
    } catch (error) {
      console.error('❌ Error fetching NO price:', error)
      throw error
    }
  }, [helperContract])

  // ==================== STATUS CHECKS (USING HELPER) ====================

  const canRequestResolution = useCallback(async (marketId: number): Promise<boolean> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      return await (helperContract as any).canRequestResolution(BigInt(marketId))
    } catch (error) {
      console.error('❌ Error checking resolution status:', error)
      return false
    }
  }, [helperContract])

  const canDispute = useCallback(async (marketId: number): Promise<boolean> => {
    if (!helperContract) throw new Error('Helper contract not available')
    
    try {
      return await (helperContract as any).canDispute(BigInt(marketId))
    } catch (error) {
      console.error('❌ Error checking dispute status:', error)
      return false
    }
  }, [helperContract])

  // ==================== TRADING FUNCTIONS (USING MAIN CONTRACT) ====================

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

  const requestResolution = useCallback(async (marketId: number, reason: string = '') => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected or wrong network')
    
    const contractWithSigner = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      signer
    )
    
    const tx = await (contractWithSigner as any).requestResolution(BigInt(marketId), reason)
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
    
    const tx = await (contractWithSigner as any).claimRedemption(BigInt(marketId))
    return await tx.wait()
  }, [signer, isCorrectNetwork])

  return {
    // Core functions
    createMarket,
    getMarket,
    
    // Investment tracking functions (from helper)
    getMarketInvestment,
    getTotalInvestment,
    
    // Multiplier & Price calculations (from helper)
    getBuyYesMultiplier,
    getBuyNoMultiplier,
    getCurrentMultipliers,
    getTradingInfo,
    getSwapMultiplier,
    getYesPrice,
    getNoPrice,
    
    // Trading functions (main contract)
    buyYesWithBNB,
    buyNoWithBNB,
    swapTokens,
    
    // AI Resolution system (main contract)
    requestResolution,
    initiateDispute,
    redeem,
    
    // Status checks (from helper)
    canRequestResolution,
    canDispute,
    
    // User positions (from helper)
    getUserPositions,
    
    // State
    isLoading,
    contract,
    helperContract,
    contractAddress: PREDICTION_MARKET_ADDRESS,
    helperContractAddress: HELPER_CONTRACT_ADDRESS,
    isContractReady,
    
    // Constants
    MarketStatus,
    Outcome,
  }
}