import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DAILY_RATE_URL = 'https://open.er-api.com/v6/latest/MYR'

type ExchangeRateApiResponse = {
  result: string
  provider?: string
  rates?: Record<string, number>
  time_last_update_utc?: string
}

function formatShanghaiTime(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-')
}

function decodeJwtRole(authHeader: string) {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { role?: string }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authHeader = request.headers.get('Authorization') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Supabase Edge Function environment variables are missing.')
    }

    if (authHeader) {
      const authRole = decodeJwtRole(authHeader)

      if (authRole !== 'anon' && authRole !== 'service_role') {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })

        const {
          data: { user },
          error: userError,
        } = await userClient.auth.getUser()

        if (userError || !user) {
          return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')

        if (adminError || !isAdmin) {
          return new Response(JSON.stringify({ error: 'Forbidden.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const response = await fetch(DAILY_RATE_URL, { method: 'GET' })
    if (!response.ok) {
      throw new Error(`Exchange rate upstream returned ${response.status}.`)
    }

    const data = (await response.json()) as ExchangeRateApiResponse
    const rate = data.rates?.CNY

    if (data.result !== 'success' || typeof rate !== 'number' || !Number.isFinite(rate)) {
      throw new Error('Exchange rate payload is invalid.')
    }

    const formattedRate = Number(rate.toFixed(4))
    const updatedAt = formatShanghaiTime(new Date())
    const upstreamPublishedOn = data.time_last_update_utc
      ? formatShanghaiTime(new Date(data.time_last_update_utc))
      : updatedAt
    const source = data.provider ?? 'ExchangeRate API'

    const rows = [
      { key: 'RM_TO_CNY', value: String(formattedRate), is_public: true },
      { key: 'RM_TO_CNY_SOURCE', value: source, is_public: true },
      { key: 'RM_TO_CNY_UPDATED_AT', value: upstreamPublishedOn, is_public: true },
      { key: 'RM_TO_CNY_AUTO_UPDATE_HOUR', value: '0', is_public: true },
    ]

    const { error: upsertError } = await adminClient.from('app_config').upsert(rows, {
      onConflict: 'key',
    })

    if (upsertError) {
      throw upsertError
    }

    return new Response(
      JSON.stringify({
        ok: true,
        rate: formattedRate,
        source,
        publishedOn: upstreamPublishedOn,
        syncedAt: updatedAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
