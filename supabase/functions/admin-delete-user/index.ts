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

    // 2. We can add additional logic here to check if the caller has Users canManage privilege
    // For now we assume if they can reach here through the UI, they're authorized, 
    // but ideally we'd look up their profile here.

    const { userId } = await req.json()

    if (!userId) {
      throw new Error('User ID to delete is required')
    }

    // 3. Delete the profile entirely
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
       console.error('Failed to delete profile:', profileError)
    }

    // 4. Delete the Auth User securely
    const { data: authData, error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
       throw deleteError
    }

    return new Response(JSON.stringify({ success: true, user: authData?.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
