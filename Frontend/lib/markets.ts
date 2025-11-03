export interface Market {
  id?: number
  slug: string
  title: string
  description: string
  category: string
  yesOdds: number
  noOdds: number
  volume: number
  resolutionDate: string
}

export const MARKETS: Market[] = [
  {
    id: 1,
    slug: "trump-xi-meeting",
    title: "Will Trump meet with Xi Jinping by October?",
    description: "Will the US President meet with China President by end of October",
    category: "Politics",
    yesOdds: 78,
    noOdds: 22,
    volume: 2000000,
    resolutionDate: "2025-10-31",
  },
  {
    id: 2,
    slug: "tesla-earnings",
    title: "Will Tesla (TSLA) beat quarterly earnings?",
    description: "Will Tesla beat Q3 2025 earnings expectations",
    category: "Finance",
    yesOdds: 65,
    noOdds: 35,
    volume: 1500000,
    resolutionDate: "2025-10-15",
  },
  {
    id: 3,
    slug: "bitcoin-100k",
    title: "Bitcoin above $100k by year end?",
    description: "Will Bitcoin price reach or exceed $100,000 by December 31, 2025",
    category: "Crypto",
    yesOdds: 45,
    noOdds: 55,
    volume: 3200000,
    resolutionDate: "2025-12-31",
  },
  {
    id: 4,
    slug: "fed-rate-cut",
    title: "Fed will cut rates in Q4 2025?",
    description: "Will the Federal Reserve cut interest rates in Q4 2025",
    category: "Economy",
    yesOdds: 68,
    noOdds: 32,
    volume: 1800000,
    resolutionDate: "2025-12-31",
  },
  {
    id: 5,
    slug: "liverpool-premier-league",
    title: "Liverpool wins Premier League 2025-26?",
    description: "Will Liverpool FC win the Premier League title in 2025-26 season",
    category: "Sports",
    yesOdds: 33,
    noOdds: 67,
    volume: 900000,
    resolutionDate: "2026-05-31",
  },
  {
    id: 6,
    slug: "unemployment-below-4",
    title: "US unemployment below 4% by year end?",
    description: "Will US unemployment rate stay below 4% through December 2025",
    category: "Economy",
    yesOdds: 72,
    noOdds: 28,
    volume: 1100000,
    resolutionDate: "2025-12-31",
  },
  {
    id: 7,
    slug: "ethereum-5k",
    title: "Ethereum above $5,000 by next year?",
    description: "Will Ethereum price reach or exceed $5,000 by January 1, 2026",
    category: "Crypto",
    yesOdds: 38,
    noOdds: 62,
    volume: 2400000,
    resolutionDate: "2026-01-01",
  },
  {
    id: 8,
    slug: "openai-new-model",
    title: "New AI model release from OpenAI?",
    description: "Will OpenAI release a new major AI model by end of 2025",
    category: "Tech",
    yesOdds: 82,
    noOdds: 18,
    volume: 1200000,
    resolutionDate: "2025-12-31",
  },
]
