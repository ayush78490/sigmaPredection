// components/market-list.tsx
import { usePredictionMarket } from '../hooks/use-predection-market'
import { useEffect, useState } from 'react'

export function MarketList() {
  const { getAllMarkets, isLoading } = usePredictionMarket()
  const [markets, setMarkets] = useState<any[]>([])

  useEffect(() => {
    const loadMarkets = async () => {
      try {
        const marketData = await getAllMarkets()
        setMarkets(marketData)
      } catch (error) {
        console.error('Failed to load markets:', error)
      }
    }

    loadMarkets()
  }, [getAllMarkets])

  if (isLoading) return <div>Loading markets...</div>

  return (
    <div>
      {markets.map(market => (
        <div key={market.id} className="market-card">
          <h3>{market.question}</h3>
          <p>YES: {market.yesPrice}% | NO: {market.noPrice}%</p>
          <p>Ends: {new Date(market.endTime * 1000).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  )
}