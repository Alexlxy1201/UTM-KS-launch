const DAILY_RATE_URL = 'https://open.er-api.com/v6/latest/MYR'

type ExchangeRateApiResponse = {
  result: string
  provider?: string
  time_last_update_utc?: string
  rates?: Record<string, number>
}

type ExchangeRateResult = {
  rate: number
  publishedOn: string
  source: string
}

export async function fetchLatestRmToCnyRate(): Promise<ExchangeRateResult | null> {
  try {
    const response = await fetch(DAILY_RATE_URL, { method: 'GET' })
    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as ExchangeRateApiResponse
    const rate = data.rates?.CNY

    if (data.result !== 'success' || typeof rate !== 'number' || !Number.isFinite(rate)) {
      return null
    }

    return {
      rate: Number(rate.toFixed(4)),
      publishedOn: data.time_last_update_utc ?? '',
      source: data.provider ?? 'ExchangeRate API',
    }
  } catch {
    return null
  }
}
