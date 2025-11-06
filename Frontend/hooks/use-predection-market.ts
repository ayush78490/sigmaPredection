import { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import { useWeb3Context } from '@/lib/wallet-context'
import PREDICTION_MARKET_ABI from '../contracts/abi.json'

// Contract address
const PREDICTION_MARKET_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x52Ca4B7673646B8b922ea00ccef6DD0375B14619'

// Types
export enum MarketStatus {
  Open = 0,
  Closed = 1,
  Proposed = 2,
  Disputed = 3,
  Resolved = 4
}

export enum Outcome {
  Undecided = 0,
  Yes = 1,
  No = 2,
  Invalid = 3
}

export interface Market {
  id: number
  creator: string
  question: string
  endTime: number
  status: MarketStatus
  outcome: Outcome
  yesToken: string
  noToken: string
  yesPool: string
  noPool: string
  lpTotalSupply: string
  totalBacking: string
  yesPrice?: number
  noPrice?: number
}

export interface MarketCreationParams {
  question: string
  endTime: number
  initialYes: string
  initialNo: string
}

// Add this helper function at the top of the file, after imports
async function validateMarketWithPerplexity(params: MarketCreationParams): Promise<{ valid: boolean, reason?: string }> {
  try {
    const res = await fetch('http://localhost:3001/api/validate-market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    if (!res.ok) {
      // Try to get error message from response
      let errorMessage = 'Failed to validate market with AI'
      try {
        const errorData = await res.json()
        errorMessage = errorData.reason || errorData.error || errorMessage
      } catch {
        // If response isn't JSON, use status text
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
        
        // Check if we're on the correct network
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
          signer
        )
        
        // Test the contract connection
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

  // Market Creation
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
      console.log('✅ AI validation passed')

      // Create contract instance with signer
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
        BigInt(params.endTime),
        initialYesWei,
        initialNoWei,
        { value: totalValue }
      )

      console.log('⏳ Waiting for transaction confirmation...')
      const receipt = await tx.wait()

      let marketId: number
      const marketCreatedTopic = ethers.id('MarketCreated(uint256,string,address,address,uint256)')
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

  // Get Single Market
  const getMarket = useCallback(async (marketId: number): Promise<Market> => {
    if (!contract) throw new Error('Contract not available')

    try {
      console.log(`📊 Fetching market ${marketId}...`)
      // Use type assertion for the method call
      const marketData = await (contract as any).getMarket(BigInt(marketId))
      
      // Calculate prices
      const yesPool = parseFloat(ethers.formatEther(marketData[7]))
      const noPool = parseFloat(ethers.formatEther(marketData[8]))
      const totalPool = yesPool + noPool
      const yesPrice = totalPool > 0 ? (noPool / totalPool) * 100 : 50
      const noPrice = totalPool > 0 ? (yesPool / totalPool) * 100 : 50

      return {
        id: marketId,
        creator: marketData[0],
        question: marketData[1],
        endTime: Number(marketData[2]),
        status: marketData[3],
        outcome: marketData[4],
        yesToken: marketData[5],
        noToken: marketData[6],
        yesPool: ethers.formatEther(marketData[7]),
        noPool: ethers.formatEther(marketData[8]),
        lpTotalSupply: ethers.formatEther(marketData[9]),
        totalBacking: ethers.formatEther(marketData[10]),
        yesPrice,
        noPrice
      }
    } catch (error) {
      console.error('❌ Error fetching market:', error)
      throw error
    }
  }, [contract])

  // Get All Markets
  const getAllMarkets = useCallback(async (): Promise<Market[]> => {
    if (!contract || !isContractReady) {
      console.error("❌ Contract not available or not ready")
      throw new Error("Contract not available - please connect to BSC Testnet and ensure contract is deployed")
    }

    try {
      console.log("📋 Fetching all markets...")
      const nextId = await (contract as any).nextMarketId()
      const marketCount = Number(nextId)
      console.log(`Found ${marketCount} markets on chain`)
      
      if (marketCount === 0) {
        console.log("ℹ️ No markets created yet - this is normal for new deployment")
        return []
      }

      const markets: Market[] = []
      for (let i = 0; i < marketCount; i++) {
        try {
          const market = await getMarket(i)
          markets.push(market)
          console.log(`✅ Loaded market ${i}`)
        } catch (error) {
          console.warn(`⚠️ Failed to fetch market ${i}:`, error)
          // Continue with other markets even if one fails
        }
      }
      
      console.log(`✅ Successfully loaded ${markets.length} markets`)
      return markets
      
    } catch (error) {
      console.error("❌ Error fetching all markets:", error)
      throw error
    }
  }, [contract, isContractReady, getMarket])

  // Get output amount for swap
  const getAmountOut = useCallback(async (
    marketId: number, 
    amountIn: string, 
    isYesIn: boolean
  ) => {
    if (!contract) throw new Error('Contract not available')
    
    try {
      const amountInWei = ethers.parseEther(amountIn)
      const result = await (contract as any).getAmountOut(BigInt(marketId), amountInWei, isYesIn)
      
      return {
        amountOut: ethers.formatEther(result[0]),
        fee: ethers.formatEther(result[1])
      }
    } catch (error) {
      console.error('❌ Error calculating amount out:', error)
      throw error
    }
  }, [contract])

  // Trading functions
  const mintCompleteSets = useCallback(async (marketId: number, amount: string) => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected or wrong network')
    
    const contractWithSigner = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      signer
    )
    
    const amountWei = ethers.parseEther(amount)
    
    const tx = await (contractWithSigner as any).mintCompleteSets(BigInt(marketId), amountWei, {
      value: amountWei
    })
    return await tx.wait()
  }, [signer, isCorrectNetwork])

  const burnCompleteSets = useCallback(async (marketId: number, amount: string) => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected or wrong network')
    
    const contractWithSigner = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      signer
    )
    
    const amountWei = ethers.parseEther(amount)
    
    const tx = await (contractWithSigner as any).burnCompleteSets(BigInt(marketId), amountWei)
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
  // Get user's positions across all markets
const getUserPositions = useCallback(async (userAddress: string) => {
  if (!contract) throw new Error('Contract not available')
  
  try {
    const nextId = await contract.nextMarketId()
    const marketCount = Number(nextId)
    const positions = []
    
    for (let i = 0; i < marketCount; i++) {
      try {
        const market = await getMarket(i)
        
        // Get YES and NO token balances for this user
        const yesTokenContract = new ethers.Contract(
          market.yesToken,
          ['function balanceOf(address) view returns (uint256)'],
          provider || signer
        )
        const noTokenContract = new ethers.Contract(
          market.noToken,
          ['function balanceOf(address) view returns (uint256)'],
          provider || signer
        )
        
        const yesBalance = await yesTokenContract.balanceOf(userAddress)
        const noBalance = await noTokenContract.balanceOf(userAddress)
        
        const yesBalanceFormatted = ethers.formatEther(yesBalance)
        const noBalanceFormatted = ethers.formatEther(noBalance)
        
        // Only include markets where user has a position
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
}, [contract, getMarket, provider, signer])



  return {
    // Core functions
    createMarket,
    getMarket,
    getAllMarkets,
    getAmountOut,
    getUserPositions,
    
    // Trading functions
    mintCompleteSets,
    burnCompleteSets,
    swapTokens,
    
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
