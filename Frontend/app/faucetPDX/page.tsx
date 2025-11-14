"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, ExternalLink, Droplets, Clock, Wallet, Shield, Coins, AlertCircle, } from "lucide-react"
import { SiDiscord } from "react-icons/si"
import Header from "@/components/header"
import Footer from "@/components/footer"
import LightRays from "@/components/LightRays"
import { ethers } from "ethers"

// Import the ABI
import FAUCET_ABI from "@/contracts/faucetabi.json"

const FAUCET_CONTRACT_ADDRESS = "0xD3561841A6dd046943739B704bcc737aAeE4cd77"
// Your PDX token address
const PDX_TOKEN_ADDRESS = "0xeE943aCCAa07ED556DfAc9d3a76015050fA78BC8" 

type EthereumProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>
  on: (event: string, callback: (...args: any[]) => void) => void
  removeListener: (event: string, callback: (...args: any[]) => void) => void
  isMetaMask?: boolean
}

const getEthereumProvider = (): EthereumProvider | undefined => {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return (window as any).ethereum
  }
  return undefined
}

export default function FaucetPage() {
  const [address, setAddress] = useState("")
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transactionHash, setTransactionHash] = useState("")
  const [error, setError] = useState("")
  const [userClaimInfo, setUserClaimInfo] = useState({
    lastClaim: 0,
    totalClaimedByUser: 0,
    timeUntilNext: 0,
    canClaimNow: false
  })
  const [faucetStats, setFaucetStats] = useState([
    { label: "PDX per Request", value: "100 PDX" },
    { label: "Cooldown Period", value: "24 hours" },
    { label: "Available Balance", value: "Loading..." },
    { label: "Total Distributed", value: "Loading..." }
  ])
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [tokenAdded, setTokenAdded] = useState(false)
  const [hasSufficientBNB, setHasSufficientBNB] = useState(true)

  // Check if wallet is connected on component mount
  useEffect(() => {
    checkWalletConnection()
  }, [])

  const checkWalletConnection = async () => {
    const ethereum = getEthereumProvider()
    if (ethereum) {
      try {
        const accounts = await ethereum.request({ method: "eth_accounts" }) as string[]
        if (accounts && accounts.length > 0) {
          const userAddr = accounts[0]
          setAddress(userAddr)
          setIsWalletConnected(true)
          // Check user's BNB balance
          await checkUserBNBBalance(userAddr)
          await loadUserClaimInfo(userAddr)
          await loadFaucetStats()
        }
      } catch (err) {
        console.error("Error checking wallet connection:", err)
      }
    }
  }

  const getProvider = () => {
    const ethereum = getEthereumProvider()
    if (ethereum) {
      return new ethers.BrowserProvider(ethereum)
    }
    throw new Error("No Ethereum provider found. Please install MetaMask.")
  }

  const getSigner = async () => {
    const provider = getProvider()
    return await provider.getSigner()
  }

  const getFaucetContract = async () => {
    const signer = await getSigner()
    return new ethers.Contract(FAUCET_CONTRACT_ADDRESS, FAUCET_ABI, signer)
  }

  const getFaucetContractReadOnly = () => {
    const provider = getProvider()
    return new ethers.Contract(FAUCET_CONTRACT_ADDRESS, FAUCET_ABI, provider)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const connectWallet = async () => {
    setIsConnecting(true)
    setError("")
    try {
      const ethereum = getEthereumProvider()
      if (ethereum) {
        const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[]
        const userAddress = accounts[0]
        setAddress(userAddress)

        const chainId = await ethereum.request({ method: 'eth_chainId' })
        if (chainId !== '0x61') {
          try {
            await ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x61' }],
            })
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              try {
                await ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [
                    {
                      chainId: '0x61',
                      chainName: 'BNB Smart Chain Testnet',
                      nativeCurrency: {
                        name: 'BNB',
                        symbol: 'BNB',
                        decimals: 18,
                      },
                      rpcUrls: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545/'],
                      blockExplorerUrls: ['https://testnet.bscscan.com'],
                    },
                  ],
                })
              } catch (addError) {
                throw new Error("Failed to add BNB Testnet. Please add it manually in your wallet.")
              }
            } else {
              throw new Error("Please switch to BNB Testnet in your wallet settings")
            }
          }
          const newChainId = await ethereum.request({ method: 'eth_chainId' })
          if (newChainId !== '0x61') {
            throw new Error("Please switch to BNB Testnet (not BNB Mainnet)")
          }
        }
        setIsWalletConnected(true)

        // Check user has enough tBNB
        await checkUserBNBBalance(userAddress)

        await loadUserClaimInfo(userAddress)
        await loadFaucetStats()
        await addTokenToWallet()

        return userAddress
      } else {
        throw new Error("Please install MetaMask or another Ethereum wallet")
      }
    } catch (err: any) {
      console.error("Wallet connection error:", err)
      setError(err.message || "Failed to connect wallet")
      return null
    } finally {
      setIsConnecting(false)
    }
  }

  // Check user's tBNB balance to ensure it is sufficient for gas
  const checkUserBNBBalance = async (userAddress: string) => {
    try {
      setError("")
      const provider = getProvider()
      const balanceBigInt = await provider.getBalance(userAddress)
      const balance = Number(ethers.formatEther(balanceBigInt))

      // Choose a threshold minimum for tBNB balance to enable faucet claim
      // e.g. 0.001 BNB (can be adjusted)
      if (balance < 0.001) {
        setHasSufficientBNB(false)
        setError("You have insufficient tBNB for gas fees. Please get testnet BNB from https://testnet.bnbchain.org/faucet-smart")
      } else {
        setHasSufficientBNB(true)
        setError("")
      }
    } catch (err: any) {
      console.error("Failed to check BNB balance:", err)
      setHasSufficientBNB(true) // Do not block if error occurs
    }
  }

  const addTokenToWallet = async () => {
    try {
      const ethereum = getEthereumProvider()
      if (!ethereum) return
      const wasAdded = await ethereum.request({
        method: 'wallet_watchAsset',
        params: [
          {
            type: 'ERC20',
            options: {
              address: PDX_TOKEN_ADDRESS,
              symbol: 'PDX',
              decimals: 18,
              image: '',
            },
          }
        ] as any,
      })
      if (wasAdded) {
        setTokenAdded(true)
        console.log('PDX token added to wallet')
      }
    } catch (error: any) {
      console.error('Error adding token to wallet:', error)
      if (error.code === 4001) {
        console.log('User rejected adding token')
      } else if (error.code === -32601 || error.code === -32602) {
        console.log('This wallet does not support automatic token addition')
        setTokenAdded(true)
      }
    }
  }

  const loadUserClaimInfo = async (userAddress: string) => {
    try {
      const contract = getFaucetContractReadOnly()
      const userInfo = await contract.getUserClaimInfo(userAddress)
      setUserClaimInfo({
        lastClaim: Number(userInfo[0]),
        totalClaimedByUser: Number(ethers.formatUnits(userInfo[1], 18)),
        timeUntilNext: Number(userInfo[2]),
        canClaimNow: userInfo[3]
      })
    } catch (err: any) {
      console.error("Error loading user claim info:", err)
      setError(`Failed to load claim info: ${err.message}`)
    }
  }

  const loadFaucetStats = async () => {
    try {
      const contract = getFaucetContractReadOnly()
      const stats = await contract.getFaucetStats()
      const formattedStats = [
        { label: "PDX per Request", value: `${ethers.formatUnits(stats[4], 18)} PDX` },
        { label: "Cooldown Period", value: `${Math.round(Number(stats[5]) / 3600)} hours` },
        { label: "Available Balance", value: `${Number(ethers.formatUnits(stats[0], 18)).toFixed(2)} PDX` },
        { label: "Total Distributed", value: `${Number(ethers.formatUnits(stats[1], 18)).toFixed(2)} PDX` }
      ]
      setFaucetStats(formattedStats)
      if (!stats[3]) {
        setError("Faucet is currently inactive. Please contact the administrator.")
      }
      if (Number(stats[0]) === 0) {
        setError("Faucet has no tokens. Please contact the administrator to fund the faucet.")
      }
    } catch (err: any) {
      console.error("Error loading faucet stats:", err)
      setError(`Failed to load faucet stats: ${err.message}`)
    }
  }

  const handleRequestTokens = async () => {
    if (!address) {
      setError("Please connect your wallet first")
      return
    }

    if (!hasSufficientBNB) {
      setError("Insufficient tBNB in wallet. Please get testnet BNB from https://testnet.bnbchain.org/faucet-smart")
      return
    }

    setIsLoading(true)
    setError("")
    setTransactionHash("")

    try {
      const contract = await getFaucetContract()
      const canClaim = await contract.canClaim(address)
      if (!canClaim) {
        const userInfo = await contract.getUserClaimInfo(address)
        if (Number(userInfo[2]) > 0) {
          throw new Error(`Please wait ${formatTimeRemaining(Number(userInfo[2]))} before claiming again`)
        }
        throw new Error("Cannot claim tokens at this time. Please check faucet status.")
      }

      const feeData = await (await getSigner()).provider.getFeeData()
      const tx = await contract.claimTokens({
        gasLimit: 300000,
        gasPrice: feeData.gasPrice
      })

      setTransactionHash(tx.hash)

      const receipt = await tx.wait()
      if (receipt.status === 1) {
        await loadUserClaimInfo(address)
        await loadFaucetStats()
      } else {
        throw new Error("Transaction failed")
      }
    } catch (err: any) {
      let errorMessage = "Failed to request tokens. Please try again."
      if (err.message?.includes("Cooldown not reached")) {
        errorMessage = "Cooldown period not reached. Please wait before claiming again."
      } else if (err.message?.includes("Faucet is empty")) {
        errorMessage = "Faucet is currently empty. Please try again later or contact support."
      } else if (err.message?.includes("Faucet is inactive")) {
        errorMessage = "Faucet is currently inactive. Please contact the administrator."
      } else if (err.code === "ACTION_REJECTED" || err.message?.includes("user rejected")) {
        errorMessage = "Transaction was rejected. Please try again."
      } else if (err.code === "INSUFFICIENT_FUNDS") {
        errorMessage = "Insufficient funds for gas. Please add BNB to your wallet from a testnet faucet."
      } else if (err.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient BNB for gas fees. Get testnet BNB from https://testnet.bnbchain.org/faucet-smart"
      } else if (err.message) {
        errorMessage = err.message
      }
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimeRemaining = (seconds: number) => {
    if (seconds === 0) return "Ready to claim!"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    }
    return `${minutes}m remaining`
  }

  const features = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Secure",
      description: "Completely secure token distribution with no private keys required"
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Fast",
      description: "Instant token delivery directly to your wallet within seconds"
    },
    {
      icon: <Coins className="w-8 h-8" />,
      title: "Free",
      description: "Get free PDX tokens to start trading on prediction markets"
    }
  ]

  const canClaim = address && userClaimInfo.canClaimNow && !isLoading && hasSufficientBNB

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Light background animation */}
      <div className="fixed inset-0 z-0">
        <LightRays
          raysOrigin="top-center"
          raysColor="#6366f1"
          raysSpeed={1.5}
          lightSpread={0.8}
          rayLength={1.2}
          followMouse={true}
          noiseAmount={0.1}
          distortion={0.05}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 bg-black/80 min-h-screen">
        <Header />

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="flex justify-center items-center mb-4">
              <div className="p-3 bg-primary/20 rounded-full">
                <Droplets className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">PDX Faucet</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get free PDX tokens to start trading on prediction markets. Perfect for testing and getting started with decentralized predictions.
            </p>

            {/* Network Warning */}
            <Alert className="mt-6 max-w-2xl mx-auto bg-yellow-900/20 border-yellow-500/50">
              {/* <AlertCircle className="h-4 w-4 text-yellow-500" /> */}
              <AlertDescription className="text-yellow-200">
                <strong>Important:</strong> Make sure you're connected to <strong>BNB Testnet</strong>not BNB Mainnet!
                The faucet will automatically prompt you to switch networks.
                <strong>Get tBNB</strong>
                Whitelist your wallet on our DIDCORD to get tBNB

                <Button variant="outline" size="icon" asChild>
                  <a href="https://discord.gg/predix" target="_blank" rel="noopener noreferrer">
                    <SiDiscord className="w-4 h-4" />
                  </a>
                </Button>
              </AlertDescription>
            </Alert>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Faucet Card */}
            <div className="lg:col-span-2">
              <Card className="backdrop-blur-sm bg-card/80 border-border">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Wallet className="w-6 h-6" />
                    Request PDX Tokens
                  </CardTitle>
                  <CardDescription>
                    Connect your wallet to receive 100 PDX tokens. You can request once every 24 hours.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Wallet Connection */}
                  <div className="space-y-2">
                    <label htmlFor="address" className="text-sm font-medium">
                      Your Wallet Address
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="address"
                        placeholder="0x..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="bg-black/20 border-border flex-1"
                        disabled={isLoading || isConnecting}
                        readOnly
                      />
                      <Button
                        onClick={connectWallet}
                        disabled={isLoading || isConnecting}
                        variant="outline"
                        className="whitespace-nowrap"
                      >
                        {isConnecting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                            Connecting...
                          </>
                        ) : isWalletConnected ? (
                          "Connected"
                        ) : (
                          "Connect Wallet"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Make sure you're connected to BNB Testnet
                    </p>
                  </div>

                  {/* User Claim Info */}
                  {address && (
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Last Claim</div>
                          <div className="font-medium">
                            {userClaimInfo.lastClaim > 0
                              ? new Date(userClaimInfo.lastClaim * 1000).toLocaleDateString()
                              : "Never"
                            }
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Total Claimed</div>
                          <div className="font-medium">{userClaimInfo.totalClaimedByUser.toFixed(2)} PDX</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-muted-foreground">Status</div>
                          <div className={`font-medium ${
                            userClaimInfo.canClaimNow ? "text-green-400" : "text-yellow-400"
                          }`}>
                            {formatTimeRemaining(userClaimInfo.timeUntilNext)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Token Added Success */}
                  {tokenAdded && (
                    <Alert className="bg-green-500/10 border-green-500/50">
                      <AlertDescription className="text-green-400">
                        ✓ PDX token added to your wallet!
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Manual Token Info (for wallets that don't support auto-add) */}
                  {/* {address && (
                    <Card className="bg-slate-900/50 border-slate-700">
                      <CardContent className="pt-4">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Token Contract:</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(PDX_TOKEN_ADDRESS)}
                              className="text-primary hover:text-primary/80"
                            >
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <code className="block bg-black/30 p-2 rounded text-xs break-all">
                            {PDX_TOKEN_ADDRESS}
                          </code>
                          <p className="text-xs text-muted-foreground">
                            If PDX doesn't appear automatically, copy this address and manually add it to your wallet.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )} */}

                  {/* Add Token Button (if not added and wallet supports it) */}
                  {address && !tokenAdded && (
                    <Button
                      onClick={addTokenToWallet}
                      variant="outline"
                      className="w-full hover:bg-black/80 hover:text-white"
                      size="sm"
                    >
                      Add PDX Token to Wallet
                    </Button>
                  )}

                  {/* Success Message */}
                  {transactionHash && (
                    <Alert className="bg-green-500/10 border-green-500/50">
                      <AlertDescription className="text-green-400">
                        <div className="flex items-center justify-between">
                          <span>100 PDX sent successfully!</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(transactionHash)}
                            className="text-green-400 hover:text-green-300"
                          >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <ExternalLink className="w-3 h-3" />
                          <a
                            href={`https://testnet.bscscan.com/tx/${transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            View on BscScan
                          </a>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Request Button */}
                  <Button
                    onClick={handleRequestTokens}
                    disabled={!canClaim}
                    className="w-full bg-primary text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Droplets className="w-5 h-5 mr-2" />
                        {userClaimInfo.canClaimNow ? "Get 100 PDX" : "Cannot Claim Yet"}
                      </>
                    )}
                  </Button>

                  {/* Faucet Stats */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    {faucetStats.map((stat, index) => (
                      <div key={index} className="text-center">
                        <div className="text-2xl font-bold text-primary">{stat.value}</div>
                        <div className="text-sm text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* How it Works */}
              <Card className="backdrop-blur-sm bg-card/80 border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    How it Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <div className="font-medium">Connect Your Wallet</div>
                      <div className="text-sm text-muted-foreground">
                        Make sure you're connected to BNB Testnet
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <div className="font-medium">Check Eligibility</div>
                      <div className="text-sm text-muted-foreground">
                        Verify you can claim tokens (24h cooldown)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <div className="font-medium">Receive Tokens</div>
                      <div className="text-sm text-muted-foreground">
                        Get 100 PDX instantly to start trading
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* Features */}
              <Card className="backdrop-blur-sm bg-card/80 border-border">
                <CardHeader>
                  <CardTitle>Why Use PDX Faucet?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 text-primary">{feature.icon}</div>
                      <div>
                        <div className="font-medium">{feature.title}</div>
                        <div className="text-sm text-muted-foreground">{feature.description}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Important Notes */}
              <Card className="backdrop-blur-sm bg-card/80 border-border border-yellow-500/50">
                <CardHeader>
                  <CardTitle className="text-yellow-500">Important Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-yellow-400/80">
                  <div>• Must be on BNB Testnet</div>
                  <div>• 24-hour cooldown between claims</div>
                  <div>• Tokens are for testing only</div>
                  <div>• No real monetary value</div>
                  <div>• You need BNB for gas fees</div>
                  <div className="pt-2 mt-2 border-t border-yellow-500/30">
                    <a
                      href="https://testnet.bnbchain.org/faucet-smart"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-300 hover:underline flex items-center gap-1"
                    >
                      Get Testnet BNB <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Additional Info Section */}
          <div className="mt-12 text-center">
            <Card className="backdrop-blur-sm bg-card/80 border-border">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Need More PDX?</h3>
                <p className="text-muted-foreground mb-4">
                  Participate in prediction markets to earn more PDX tokens through successful trades and market creation.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button variant="outline" className="backdrop-blur-sm bg-card/80">
                    View Markets
                  </Button>
                  <Button variant="outline" className="backdrop-blur-sm bg-card/80">
                    Create Market
                  </Button>
                  <Button variant="outline" className="backdrop-blur-sm bg-card/80">
                    Documentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  )
}
