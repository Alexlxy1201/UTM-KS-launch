import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
}

type ManageUserPayload = {
  userId?: string
  username?: string
  fullName?: string
  email?: string
  phone?: string
  password?: string
  resetTemporaryPassword?: boolean
}

function generateTemporaryPassword() {
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return `Temp@${suffix}`
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authHeader =
      request.headers.get('x-supabase-auth') ??
      request.headers.get('Authorization') ??
      ''

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

    const { data: isAdmin, error: isAdminError } = await userClient.rpc('is_admin')

    if (isAdminError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = (await request.json()) as ManageUserPayload
    const userId = String(payload.userId ?? '').trim()
    const username = String(payload.username ?? '').trim().toLowerCase()
    const fullName = String(payload.fullName ?? '').trim()
    const email = String(payload.email ?? '').trim().toLowerCase()
    const phone = String(payload.phone ?? '').trim()
    const password = String(payload.password ?? '').trim()
    const resetTemporaryPassword = Boolean(payload.resetTemporaryPassword)
    const nextPassword = resetTemporaryPassword ? generateTemporaryPassword() : password

    if (!userId || !username || !fullName || !email) {
      return new Response(JSON.stringify({ error: 'userId, username, fullName and email are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (nextPassword && nextPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters long.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const {
      data: targetUserData,
      error: targetUserError,
    } = await adminClient.auth.admin.getUserById(userId)

    if (targetUserError || !targetUserData.user) {
      return new Response(JSON.stringify({ error: targetUserError?.message ?? 'User not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const currentAuthEmail = String(targetUserData.user.email ?? '').trim().toLowerCase()
    const adminEmailToCheck = currentAuthEmail || email

    const [{ data: adminByUserId, error: adminByUserIdError }, { data: adminByEmail, error: adminByEmailError }] =
      await Promise.all([
        adminClient.from('admin_users').select('email, user_id').eq('user_id', userId).maybeSingle(),
        adminEmailToCheck
          ? adminClient
              .from('admin_users')
              .select('email, user_id')
              .ilike('email', adminEmailToCheck)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

    if (adminByUserIdError || adminByEmailError) {
      return new Response(
        JSON.stringify({ error: adminByUserIdError?.message ?? adminByEmailError?.message ?? 'Admin lookup failed.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (adminByUserId || adminByEmail) {
      return new Response(JSON.stringify({ error: '管理员账户不支持在用户管理中重置密码。' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const shouldUpdateAuthEmail = isEmailLike(email) && email !== currentAuthEmail

    const authUpdatePayload: Record<string, unknown> = {
      user_metadata: {
        username,
        full_name: fullName,
        phone,
        profile_email: email,
      },
    }

    if (shouldUpdateAuthEmail) {
      authUpdatePayload.email = email
    }

    if (nextPassword) {
      authUpdatePayload.password = nextPassword
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, authUpdatePayload)

    if (authUpdateError) {
      return new Response(JSON.stringify({ error: authUpdateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: profileUpdateError } = await adminClient
      .from('user_profiles')
      .update({
        username,
        full_name: fullName,
        auth_email: shouldUpdateAuthEmail ? email : currentAuthEmail,
        email,
        phone,
      })
      .eq('user_id', userId)

    if (profileUpdateError) {
      return new Response(JSON.stringify({ error: profileUpdateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: updatedProfile, error: fetchProfileError } = await adminClient
      .from('user_profiles')
      .select('user_id, username, full_name, email, phone, created_at, updated_at')
      .eq('user_id', userId)
      .single()

    if (fetchProfileError) {
      return new Response(JSON.stringify({ error: fetchProfileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        profile: updatedProfile,
        temporaryPassword: resetTemporaryPassword ? nextPassword : null,
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
