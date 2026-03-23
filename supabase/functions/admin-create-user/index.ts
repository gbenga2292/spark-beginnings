import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header provided')
    }
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // 2. You could add additional logic here to verify the calling user has permission 
    // to create other users (e.g. check their profile privileges)

    const { email, password, name, privileges } = await req.json()

    if (!email || !password) {
      throw new Error('Email and password are required')
    }

    // 3. Create the Auth User securely
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for system-created users
      user_metadata: { name }
    })

    if (createError) throw createError

    // 4. Optionally, you can insert/update the profiles table here on the backend 
    // or rely on a Postgres trigger on `auth.users` to create the profile.
    if (authData?.user) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          name,
          privileges,
          is_active: true
        })
        .eq('id', authData.user.id)

      if (updateError) {
        // If profile creation fails, you might want to log it or handle cleanup, 
        // though typically `profiles` row is created via trigger.
        console.error('Failed to update profile privileges:', updateError)
      }
    }

    return new Response(JSON.stringify({ user: authData?.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
