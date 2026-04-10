import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ExpiredPaymentRow = {
  proof_path: string | null
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authHeader = request.headers.get('Authorization') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Supabase Edge Function environment variables are missing.')
    }

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: { user: currentUser },
      error: currentUserError,
    } = await userClient.auth.getUser()

    if (currentUserError || !currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: expiredPayments, error: expiredPaymentsError } = await adminClient
      .from('payments')
      .select('proof_path')
      .lt('uploaded_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    if (expiredPaymentsError) {
      return new Response(JSON.stringify({ error: expiredPaymentsError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const proofPaths = Array.from(
      new Set(
        ((expiredPayments ?? []) as ExpiredPaymentRow[])
          .map((row) => row.proof_path?.trim() ?? '')
          .filter((path) => path.length > 0),
      ),
    )

    if (proofPaths.length === 0) {
      return new Response(JSON.stringify({ ok: true, deletedCount: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let deletedCount = 0

    for (const group of chunkArray(proofPaths, 100)) {
      const { error: removeError } = await adminClient.storage.from('payment-proofs').remove(group)

      if (removeError) {
        return new Response(JSON.stringify({ error: removeError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      deletedCount += group.length
    }

    return new Response(JSON.stringify({ ok: true, deletedCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
