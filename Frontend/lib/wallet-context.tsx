"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// Proper TypeScript types for MetaMask/Ethereum provider
interface EthereumProvider {
  request(args: { method: 'eth_requestAccounts' }): Promise<string[]>
  request(args: { method: 'eth_getBalance'; params: [string, string] }): Promise<string>
  request(args: { method: 'wallet_switchEthereumChain'; params: [{ chainId: string }] }): Promise<null>
  request(args: { method: 'wallet_addEthereumChain'; params: [AddEthereumChainParameter] }): Promise<null>
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on?(event: string, handler: (...args: any[]) => void): void
  removeListener?(event: string, handler: (...args: any[]) => void): void
  isMetaMask?: boolean
  providers?: EthereumProvider[]
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

  const connect = async () => {
    try {
      // Check if MetaMask is installed
      if (typeof window === 'undefined' || !window.ethereum) {
        alert("Please install MetaMask or another Web3 wallet")
        return
      }

      let provider = window.ethereum as EthereumProvider

      // Handle multiple wallet providers (e.g., MetaMask + Coinbase)
      if (provider.providers && Array.isArray(provider.providers)) {
        // Prefer MetaMask if available
        const metamaskProvider = provider.providers.find(p => p.isMetaMask)
        provider = metamaskProvider || provider.providers[0]
      }

      // Request account access
      const accounts = await provider.request({ 
        method: "eth_requestAccounts" 
      }) as string[]
      
      if (!accounts || accounts.length === 0) {
        alert("No accounts found. Please check your wallet.")
        return
      }
      
      setAccount(accounts[0])

      // Get balance
      try {
        const balanceWei = await provider.request({
          method: "eth_getBalance",
          params: [accounts[0], "latest"],
        }) as string
        
        const balanceNum = Number.parseInt(balanceWei, 16) / 1e18
        setBalance(balanceNum.toFixed(4))
      } catch (balanceError) {
        console.warn("Could not fetch balance:", balanceError)
        setBalance("0.0000")
      }

      // Switch to BNB Smart Chain (chainId 56)
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        })
      } catch (switchError: any) {
        // Chain not added yet, try to add it
        if (switchError.code === 4902) {
          try {
            await provider.request({
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
                  rpcUrls: ["https://bsc-dataseed1.binance.org"],
                  blockExplorerUrls: ["https://bscscan.com"],
                },
              ],
            })
          } catch (addError) {
            console.error("Failed to add BNB Smart Chain:", addError)
          }
        } else {
          console.warn("Failed to switch to BNB Smart Chain:", switchError)
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
    if (typeof window === 'undefined' || !window.ethereum) {
      return
    }

    let provider = window.ethereum as EthereumProvider

    // Handle multiple wallet providers
    if (provider.providers && Array.isArray(provider.providers)) {
      const metamaskProvider = provider.providers.find(p => p.isMetaMask)
      provider = metamaskProvider || provider.providers[0]
    }

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        setAccount(accounts[0])
      }
    }

    const handleChainChanged = () => {
      window.location.reload()
    }

    // Setup event listeners
    if (provider.on) {
      provider.on("accountsChanged", handleAccountsChanged)
      provider.on("chainChanged", handleChainChanged)
    }

    // Cleanup
    return () => {
      if (provider.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged)
        provider.removeListener("chainChanged", handleChainChanged)
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
  if (typeof window === 'undefined' || !window.ethereum) return []
  
  try {
    let provider = window.ethereum as EthereumProvider
    
    if (provider.providers && Array.isArray(provider.providers)) {
      const metamaskProvider = provider.providers.find(p => p.isMetaMask)
      provider = metamaskProvider || provider.providers[0]
    }
    
    const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[]
    return accounts
  } catch (error) {
    console.error("Error getting accounts:", error)
    return []
  }
}

// Helper for creating a simple provider wrapper (without ethers.js dependency)
export const getProvider = () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error("Ethereum provider not found")
  }
  
  let provider = window.ethereum as EthereumProvider
  
  if (provider.providers && Array.isArray(provider.providers)) {
    const metamaskProvider = provider.providers.find(p => p.isMetaMask)
    provider = metamaskProvider || provider.providers[0]
  }
  
  return provider
}