"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, OUTCOME_TOKEN_ABI, CHAIN_CONFIG } from "@/lib/web3/config";

// Simple provider detection
const getEthereumProvider = () => {
  if (typeof window === 'undefined') return null;
  return window.ethereum || null;
};

export function useWeb3() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    const ethereumProvider = getEthereumProvider();
    if (!ethereumProvider) {
      setError("Please install MetaMask");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Use explicit typing for provider responses
      const existingAccounts = (await ethereumProvider.request({
        method: "eth_accounts",
      })) as string[];

      let accounts = existingAccounts as string[];

      if (!accounts || accounts.length === 0) {
        try {
          accounts = (await ethereumProvider.request({
            method: "eth_requestAccounts",
          })) as string[];
        } catch (requestError: any) {
          if (requestError.code === -32002) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            accounts = (await ethereumProvider.request({
              method: "eth_requestAccounts",
            })) as string[];
          } else {
            throw requestError;
          }
        }
      }

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }

      // Create provider and get signer
      const web3Provider = new ethers.BrowserProvider(ethereumProvider);
      const web3Signer = await web3Provider.getSigner();
      const address = await web3Signer.getAddress();
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setChainId(Number(network.chainId));

      // Check if we're on the correct network
      if (Number(network.chainId) !== CHAIN_CONFIG.chainId) {
        await switchNetwork();
      }
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      
      // Provide more user-friendly error messages
      if (err.code === 4001) {
        setError("Connection rejected by user");
      } else if (err.code === -32002) {
        setError("Connection already pending. Please check MetaMask.");
      } else {
        setError(err.message || "Failed to connect wallet");
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const switchNetwork = async () => {
    const ethereumProvider = getEthereumProvider();
    if (!ethereumProvider) return;

    try {
      await ethereumProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereumProvider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}`,
                chainName: CHAIN_CONFIG.chainName,
                rpcUrls: [CHAIN_CONFIG.rpcUrl],
                blockExplorerUrls: [CHAIN_CONFIG.blockExplorer],
                nativeCurrency: CHAIN_CONFIG.nativeCurrency,
              },
            ],
          });
        } catch (addError) {
          console.error("Error adding network:", addError);
        }
      }
    }
  };

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
  }, []);

  // Initialize wallet connection on component mount if already connected
  useEffect(() => {
    const initializeWallet = async () => {
      const ethereumProvider = getEthereumProvider();
      if (!ethereumProvider) return;

      try {
        const accounts = (await ethereumProvider.request({
          method: "eth_accounts",
        })) as string[];

        if (accounts && accounts.length > 0) {
          const web3Provider = new ethers.BrowserProvider(ethereumProvider);
          const web3Signer = await web3Provider.getSigner();
          const address = await web3Signer.getAddress();
          const network = await web3Provider.getNetwork();

          setProvider(web3Provider);
          setSigner(web3Signer);
          setAccount(address);
          setChainId(Number(network.chainId));
        }
      } catch (error) {
        console.error("Error initializing wallet:", error);
      }
    };

    initializeWallet();
  }, []);

  // Use polling instead of event listeners to avoid the addListener issue
  useEffect(() => {
    const ethereumProvider = getEthereumProvider();
    if (!ethereumProvider || !account) return;

    let mounted = true;
    let lastAccounts: string[] = [account!];
    let lastChainId: string = chainId ? `0x${chainId.toString(16)}` : "";

    const pollForChanges = async () => {
      if (!mounted) return;

      try {
        const accounts = (await ethereumProvider.request({
          method: "eth_accounts",
        })) as string[];

        if (JSON.stringify(accounts) !== JSON.stringify(lastAccounts)) {
          lastAccounts = accounts;
          if (accounts.length === 0) {
            disconnectWallet();
          } else if (accounts[0] !== account) {
            setAccount(accounts[0]);
            const web3Provider = new ethers.BrowserProvider(ethereumProvider);
            const web3Signer = await web3Provider.getSigner();
            setSigner(web3Signer);
          }
        }

        const currentChainId = (await ethereumProvider.request({
          method: "eth_chainId",
        })) as string;

        if (currentChainId !== lastChainId) {
          lastChainId = currentChainId;
          const newChainId = parseInt(currentChainId, 16);
          setChainId(newChainId);
        }
      } catch (error) {
        console.warn("Error polling provider:", error);
      }

      if (mounted) {
        setTimeout(pollForChanges, 2000);
      }
    };

    pollForChanges();

    return () => {
      mounted = false;
    };
  }, [account, chainId, disconnectWallet]);

  return {
    provider,
    signer,
    account,
    chainId,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    isCorrectNetwork: chainId === CHAIN_CONFIG.chainId,
    switchNetwork,
  };
}
// Hook for interacting with the prediction market contract
export function usePredictionMarket() {
  const { signer, provider, account } = useWeb3();

  const getContract = useCallback(
    (withSigner = true) => {
      if (!provider) return null;
      const signerOrProvider = withSigner && signer ? signer : provider;
      return new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, signerOrProvider);
    },
    [provider, signer]
  );

  const getTokenContract = useCallback(
    (tokenAddress: string, withSigner = true) => {
      if (!provider) return null;
      const signerOrProvider = withSigner && signer ? signer : provider;
      return new ethers.Contract(tokenAddress, OUTCOME_TOKEN_ABI, signerOrProvider);
    },
    [provider, signer]
  );

  // Create a new market
  const createMarket = async (
    question: string,
    endTime: number,
    initialYes: string,
    initialNo: string
  ) => {
    const contract = getContract();
    if (!contract) throw new Error("Contract not initialized");

    const yesAmount = ethers.parseEther(initialYes);
    const noAmount = ethers.parseEther(initialNo);
    const totalValue = yesAmount + noAmount;

    const tx = await contract.createMarket(question, endTime, yesAmount, noAmount, {
      value: totalValue,
    });

    const receipt = await tx.wait();
    
    // Parse the MarketCreated event to get the market ID
    const event = receipt.logs.find((log: any) => {
      try {
        return contract.interface.parseLog(log)?.name === "MarketCreated";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = contract.interface.parseLog(event);
      return Number(parsed?.args[0]); // Return market ID
    }

    throw new Error("Market creation event not found");
  };

  // Mint complete sets
  const mintCompleteSets = async (marketId: number, amount: string) => {
    const contract = getContract();
    if (!contract) throw new Error("Contract not initialized");

    const value = ethers.parseEther(amount);
    const tx = await contract.mintCompleteSets(marketId, value, { value });
    return await tx.wait();
  };

  // Burn complete sets
  const burnCompleteSets = async (marketId: number, amount: string) => {
    const contract = getContract();
    if (!contract) throw new Error("Contract not initialized");

    const value = ethers.parseEther(amount);
    const tx = await contract.burnCompleteSets(marketId, value);
    return await tx.wait();
  };

  // Buy YES tokens (swap NO for YES or mint complete sets and sell NO)
  const buyYes = async (marketId: number, amount: string, slippage = 1) => {
    const contract = getContract();
    if (!contract) throw new Error("Contract not initialized");

    const amountIn = ethers.parseEther(amount);
    
    // Get expected output with slippage
    const [amountOut] = await contract.getAmountOut(marketId, amountIn, false);
    const minOut = (amountOut * BigInt(100 - slippage)) / BigInt(100);

    // First mint complete sets
    const mintTx = await contract.mintCompleteSets(marketId, amountIn, { value: amountIn });
    await mintTx.wait();

    // Then swap NO for YES
    const swapTx = await contract.swapNoForYes(marketId, amountIn, minOut);
    return await swapTx.wait();
  };

  // Buy NO tokens (swap YES for NO or mint complete sets and sell YES)
  const buyNo = async (marketId: number, amount: string, slippage = 1) => {
    const contract = getContract();
    if (!contract) throw new Error("Contract not initialized");

    const amountIn = ethers.parseEther(amount);
    
    // Get expected output with slippage
    const [amountOut] = await contract.getAmountOut(marketId, amountIn, true);
    const minOut = (amountOut * BigInt(100 - slippage)) / BigInt(100);

    // First mint complete sets
    const mintTx = await contract.mintCompleteSets(marketId, amountIn, { value: amountIn });
    await mintTx.wait();

    // Then swap YES for NO
    const swapTx = await contract.swapYesForNo(marketId, amountIn, minOut);
    return await swapTx.wait();
  };

  // Sell YES tokens
  const sellYes = async (marketId: number, amount: string, slippage = 1) => {
    const contract = getContract();
    if (!contract) throw new Error("Contract not initialized");

    const amountIn = ethers.parseEther(amount);
    const [amountOut] = await contract.getAmountOut(marketId, amountIn, true);
    const minOut = (amountOut * BigInt(100 - slippage)) / BigInt(100);

    const tx = await contract.swapYesForNo(marketId, amountIn, minOut);
    return await tx.wait();
  };

  // Sell NO tokens
  const sellNo = async (marketId: number, amount: string, slippage = 1) => {
    const contract = getContract();
    if (!contract) throw new Error("Contract not initialized");

    const amountIn = ethers.parseEther(amount);
    const [amountOut] = await contract.getAmountOut(marketId, amountIn, false);
    const minOut = (amountOut * BigInt(100 - slippage)) / BigInt(100);

    const tx = await contract.swapNoForYes(marketId, amountIn, minOut);
    return await tx.wait();
  };

  // Get market data
  const getMarket = async (marketId: number) => {
    const contract = getContract(false);
    if (!contract) throw new Error("Contract not initialized");

    const market = await contract.getMarket(marketId);
    const [yesPrice, noPrice] = await contract.getPrice(marketId);

    return {
      creator: market[0],
      question: market[1],
      endTime: Number(market[2]),
      status: Number(market[3]),
      outcome: Number(market[4]),
      yesToken: market[5],
      noToken: market[6],
      yesPool: market[7],
      noPool: market[8],
      lpTotalSupply: market[9],
      totalBacking: market[10],
      yesPrice: Number(yesPrice) / 100, // Convert from basis points
      noPrice: Number(noPrice) / 100,
    };
  };

  // Get token balances
  const getTokenBalances = async (marketId: number) => {
    if (!account) return { yes: "0", no: "0" };

    const contract = getContract(false);
    if (!contract) throw new Error("Contract not initialized");

    const market = await contract.getMarket(marketId);
    const yesTokenContract = getTokenContract(market[5], false);
    const noTokenContract = getTokenContract(market[6], false);

    if (!yesTokenContract || !noTokenContract) {
      return { yes: "0", no: "0" };
    }

    const [yesBalance, noBalance] = await Promise.all([
      yesTokenContract.balanceOf(account),
      noTokenContract.balanceOf(account),
    ]);

    return {
      yes: ethers.formatEther(yesBalance),
      no: ethers.formatEther(noBalance),
    };
  };

  // Redeem winning tokens
  const redeem = async (marketId: number) => {
    const contract = getContract();
    if (!contract) throw new Error("Contract not initialized");

    const tx = await contract.redeem(marketId);
    return await tx.wait();
  };

  return {
    createMarket,
    mintCompleteSets,
    burnCompleteSets,
    buyYes,
    buyNo,
    sellYes,
    sellNo,
    getMarket,
    getTokenBalances,
    redeem,
    contract: getContract(false),
  };
}