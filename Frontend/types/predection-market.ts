// types/prediction-market.ts
export interface MarketData {
  creator: string
  question: string
  endTime: bigint
  status: number
  outcome: number
  yesToken: string
  noToken: string
  yesPool: bigint
  noPool: bigint
  lpTotalSupply: bigint
  totalBacking: bigint
}

export interface MarketInfo {
  creator: string
  question: string
  endTime: number
  status: number
  outcome: number
  yesToken: string
  noToken: string
  yesPool: string
  noPool: string
  lpTotalSupply: string
  totalBacking: string
}