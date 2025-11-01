"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { ethers, type Eip1193Provider } from 'ethers'

// Proper TypeScript types for MetaMask/Ethereum provider
interface EthereumProvider extends Eip1193Provider {
  request(args: { method: 'eth_requestAccounts' }): Promise<string[]>
  request(args: { method: 'eth_getBalance'; params: [string, string] }): Promise<string>
  request(args: { method: 'wallet_switchEthereumChain'; params: [{ chainId: string }] }): Promise<null>
  request(args: { method: 'wallet_addEthereumChain'; params: [AddEthereumChainParameter] }): Promise<null>
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on(event: 'accountsChanged', handler: (accounts: string[]) => void): void
  on(event: 'chainChanged', handler: (chainId: string) => void): void
  on(event: string, handler: (...args: any[]) => void): void
  removeListener(event: 'accountsChanged', handler: (accounts: string[]) => void): void
  removeListener(event: 'chainChanged', handler: (chainId: string) => void): void
  removeListener(event: string, handler: (...args: any[]) => void): void
}

interface AddEthereumChainParameter {
  chainId: string
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
}

interface WalletContextType {
  account: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => void
  balance: string | null
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)

  // Check if we're in development and add a mock ethereum provider
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.ethereum && process.env.NODE_ENV === 'development') {
      console.warn('No Ethereum provider found. Install MetaMask or another Web3 wallet.')
    }
  }, [])

  const connect = async () => {
    const ethereum = window.ethereum as EthereumProvider | undefined
    
    if (!ethereum) {
      alert("Please install MetaMask or another Web3 wallet")
      return
    }

    if (typeof ethereum.request !== 'function') {
      alert("Ethereum provider is not properly initialized")
      return
    }

    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" })
      
      if (!accounts || accounts.length === 0) {
        alert("No accounts found. Please check your wallet.")
        return
      }
      
      setAccount(accounts[0])

      // Get balance
      const balanceWei = await ethereum.request({
        method: "eth_getBalance",
        params: [accounts[0], "latest"],
      })
      const balanceNum = Number.parseInt(balanceWei, 16) / 1e18
      setBalance(balanceNum.toFixed(4))

      // Switch to BNB Smart Chain (chainId 56)
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        })
      } catch (switchError: unknown) {
        if ((switchError as any).code === 4902) {
          // Chain not added, add it
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x38",
                chainName: "BNB Smart Chain",
                nativeCurrency: {
                  name: "BNB",
                  symbol: "BNB",
                  decimals: 18,
                },
                rpcUrls: ["https://bsc-dataseed1.binance.org:443"],
                blockExplorerUrls: ["https://bscscan.com"],
              },
            ],
          })
        }
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error)
      alert(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const disconnect = () => {
    setAccount(null)
    setBalance(null)
  }

  useEffect(() => {
    const ethereum = window.ethereum as EthereumProvider | undefined
    
    if (ethereum) {
      const handleAccountsChanged = (...args: any[]) => {
        const accounts = args[0] as string[]
        if (accounts.length === 0) {
          disconnect()
        } else {
          setAccount(accounts[0])
        }
      }

      const handleChainChanged = (...args: any[]) => {
        window.location.reload()
      }

      // Listen for account changes
      ethereum.on("accountsChanged", handleAccountsChanged)

      // Listen for chain changes
      ethereum.on("chainChanged", handleChainChanged)

      // Cleanup
      return () => {
        ethereum.removeListener("accountsChanged", handleAccountsChanged)
        ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [])

  return (
    <WalletContext.Provider
      value={{
        account,
        isConnected: !!account,
        connect,
        disconnect,
        balance,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider")
  }
  return context
}

// Helper function for getting accounts
export const getAccounts = async (): Promise<string[]> => {
  if (!window.ethereum) return []
  
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
    return accounts
  } catch (error) {
    console.error("Error getting accounts:", error)
    return []
  }
}

// Helper for creating ethers provider
export const getEthersProvider = () => {
  const ethereum = window.ethereum as EthereumProvider | undefined
  
  if (!ethereum) {
    throw new Error("Ethereum provider not found")
  }
  return new ethers.BrowserProvider(ethereum)
}