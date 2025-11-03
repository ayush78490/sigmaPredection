// hooks/use-prediction-market.ts
import { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import { useWeb3 } from './use-web3'
import PREDICTION_MARKET_ABI from '../contracts/abi.json'

// Contract address
const PREDICTION_MARKET_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'YOUR_DEPLOYED_CONTRACT_ADDRESS'

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

export function usePredictionMarket() {
  const { account, provider, signer, isCorrectNetwork } = useWeb3()
  const [isLoading, setIsLoading] = useState(false)
  const [contract, setContract] = useState<ethers.Contract | null>(null)

  // Initialize contract
  useEffect(() => {
    if (provider) {
      const predictionMarketContract = new ethers.Contract(
        PREDICTION_MARKET_ADDRESS,
        PREDICTION_MARKET_ABI,
        provider
      )
      setContract(predictionMarketContract)
    }
  }, [provider])

  // Market Creation - Simple approach with type assertions
  const createMarket = useCallback(async (
    params: MarketCreationParams
  ): Promise<number> => {
    if (!signer || !account || !isCorrectNetwork) {
      throw new Error('Wallet not connected or wrong network')
    }

    setIsLoading(true)
    try {
      // Create a new contract instance with signer (simpler approach)
      const contractWithSigner = new ethers.Contract(
        PREDICTION_MARKET_ADDRESS,
        PREDICTION_MARKET_ABI,
        signer
      )
      
      // Convert BNB amounts to wei
      const initialYesWei = ethers.parseEther(params.initialYes)
      const initialNoWei = ethers.parseEther(params.initialNo)
      const totalValue = initialYesWei + initialNoWei

      console.log('Creating market...', {
        question: params.question,
        endTime: params.endTime,
        initialYes: params.initialYes,
        initialNo: params.initialNo
      })

      // Use type assertion for the method call
      const tx = await (contractWithSigner as any).createMarket(
        params.question,
        BigInt(params.endTime),
        initialYesWei,
        initialNoWei,
        { 
          value: totalValue 
        }
      )

      console.log('Transaction sent:', tx.hash)

      // Wait for confirmation
      const receipt = await tx.wait()
      
      // Get market ID from events or fallback
      let marketId: number
      const marketCreatedTopic = ethers.id('MarketCreated(uint256,string,address,address,uint256)')
      const event = receipt?.logs.find((log: any) => log.topics[0] === marketCreatedTopic)
      
      if (event) {
        const iface = new ethers.Interface(PREDICTION_MARKET_ABI)
        const decodedEvent = iface.parseLog(event)
        marketId = Number(decodedEvent?.args.id)
      } else {
        // Fallback: get the latest market ID
        const nextId = await (contractWithSigner as any).nextMarketId()
        marketId = Number(nextId) - 1
      }

      console.log('Market created with ID:', marketId)
      return marketId

    } catch (error: any) {
      console.error('Error creating market:', error)
      throw new Error(error.reason || error.message || 'Failed to create market')
    } finally {
      setIsLoading(false)
    }
  }, [signer, account, isCorrectNetwork])

  // Get Single Market
  const getMarket = useCallback(async (marketId: number): Promise<Market> => {
    if (!contract) throw new Error('Contract not available')

    try {
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
      console.error('Error fetching market:', error)
      throw error
    }
  }, [contract])

  // Get All Markets
  const getAllMarkets = useCallback(async (): Promise<Market[]> => {
    if (!contract) throw new Error('Contract not available')

    try {
      const nextId = await (contract as any).nextMarketId()
      const marketCount = Number(nextId)
      
      if (marketCount === 0) return []

      const markets: Market[] = []
      for (let i = 0; i < marketCount; i++) {
        try {
          const market = await getMarket(i)
          markets.push(market)
        } catch (error) {
          console.warn(`Failed to fetch market ${i}:`, error)
        }
      }
      
      return markets
    } catch (error) {
      console.error('Error fetching all markets:', error)
      throw error
    }
  }, [contract, getMarket])

  // Get output amount for swap
  const getAmountOut = useCallback(async (
    marketId: number, 
    amountIn: string, 
    isYesIn: boolean
  ) => {
    if (!contract) throw new Error('Contract not available')
    
    const amountInWei = ethers.parseEther(amountIn)
    const result = await (contract as any).getAmountOut(BigInt(marketId), amountInWei, isYesIn)
    
    return {
      amountOut: ethers.formatEther(result[0]),
      fee: ethers.formatEther(result[1])
    }
  }, [contract])

  // Trading functions
  const mintCompleteSets = useCallback(async (marketId: number, amount: string) => {
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected')
    
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
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected')
    
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
    if (!signer || !isCorrectNetwork) throw new Error('Wallet not connected')
    
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

  return {
    // Core functions
    createMarket,
    getMarket,
    getAllMarkets,
    getAmountOut,
    
    // Trading functions
    mintCompleteSets,
    burnCompleteSets,
    swapTokens,
    
    // State
    isLoading,
    contract,
    contractAddress: PREDICTION_MARKET_ADDRESS,
    
    // Constants
    MarketStatus,
    Outcome
  }
}