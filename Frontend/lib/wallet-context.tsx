"use client";

import { createContext, useContext, ReactNode } from "react";
import { useWeb3 } from "@/hooks/use-web3";
import { ethers } from "ethers";

interface Web3ContextType {
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  account: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isCorrectNetwork: boolean;
  switchNetwork: () => Promise<void>;
  isInitialized: boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const web3 = useWeb3();

  return (
    <Web3Context.Provider value={web3}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3Context() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3Context must be used within Web3Provider");
  }
  return context;
}

// Backward compatibility - if you still use useWallet somewhere
export function useWallet() {
  const { account, connectWallet, disconnectWallet } = useWeb3Context();
  return {
    account,
    isConnected: !!account,
    connect: connectWallet,
    disconnect: disconnectWallet,
    balance: null, // If needed, calculate from provider
  };
}

// Helper function for getting accounts
export const getAccounts = async (): Promise<string[]> => {
  if (typeof window === "undefined" || !window.ethereum) return [];

  try {
    let provider = window.ethereum as any;
    if (provider.providers && Array.isArray(provider.providers)) {
      const metamaskProvider = provider.providers.find(
        (p: any) => p.isMetaMask
      );
      provider = metamaskProvider || provider.providers[0];
    }
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    return accounts;
  } catch (error) {
    console.error("Error getting accounts:", error);
    return [];
  }
};

// Helper for getting Ethereum provider
export const getProvider = () => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Ethereum provider not found");
  }

  let provider = window.ethereum as any;
  if (provider.providers && Array.isArray(provider.providers)) {
    const metamaskProvider = provider.providers.find(
      (p: any) => p.isMetaMask
    );
    provider = metamaskProvider || provider.providers[0];
  }

  return provider;
};