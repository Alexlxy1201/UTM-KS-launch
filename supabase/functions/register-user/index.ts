import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RegisterUserPayload = {
  username?: string
  fullName?: string
  email?: string
  phone?: string
  password?: string
}

function buildInternalAuthEmail() {
  return `user-${crypto.randomUUID()}@auth.utmks-launch.app`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase Edge Function environment variables are missing.')
    }

    const payload = (await request.json()) as RegisterUserPayload
    const username = String(payload.username ?? '').trim().toLowerCase()
    const fullName = String(payload.fullName ?? '').trim()
    const email = String(payload.email ?? '').trim()
    const phone = String(payload.phone ?? '').trim()
    const password = String(payload.password ?? '').trim()

    if (!username || !fullName || !password) {
      return new Response(JSON.stringify({ error: 'username, fullName and password are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters long.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: existingUsers, error: existingUsersError } = await adminClient
      .from('user_profiles')
      .select('user_id')
      .ilike('username', username)
      .limit(1)

    if (existingUsersError) {
      return new Response(JSON.stringify({ error: existingUsersError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if ((existingUsers ?? []).length > 0) {
      return new Response(JSON.stringify({ error: '用户名已存在，请更换后重试。' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authEmail = buildInternalAuthEmail()

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
        phone,
        profile_email: email,
      },
    })

    if (createUserError || !createdUser.user) {
      return new Response(JSON.stringify({ error: createUserError?.message ?? 'Failed to create user.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: profileUpsertError } = await adminClient.from('user_profiles').upsert(
      {
        user_id: createdUser.user.id,
        username,
        full_name: fullName,
        auth_email: authEmail,
        email,
        phone,
      },
      { onConflict: 'user_id' },
    )

    if (profileUpsertError) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id)

      return new Response(JSON.stringify({ error: profileUpsertError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        userId: createdUser.user.id,
        authEmail,
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
