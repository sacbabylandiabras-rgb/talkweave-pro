import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Use the DB URL to execute raw SQL for table creation
async function ensureTable() {
  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    console.log('SUPABASE_DB_URL not set, cannot create table')
    return false
  }

  // Dynamic import of postgres
  try {
    const mod = await import("https://deno.land/x/postgres@v0.17.0/mod.ts")
    const client = new mod.Client(dbUrl)
    await client.connect()
    
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS public.gateway_platform_config (
        key text PRIMARY KEY,
        value text NOT NULL DEFAULT '',
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    
    await client.queryArray(`
      ALTER TABLE public.gateway_platform_config ENABLE ROW LEVEL SECURITY
    `)
    
    // Create policies (ignore if they already exist)
    const policies = [
      `CREATE POLICY "Anyone can read platform config" ON public.gateway_platform_config FOR SELECT TO public USING (true)`,
      `CREATE POLICY "Admins can update platform config" ON public.gateway_platform_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))`,
      `CREATE POLICY "Admins can insert platform config" ON public.gateway_platform_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'))`,
    ]
    
    for (const p of policies) {
      try { await client.queryArray(p) } catch { /* policy may already exist */ }
    }

    // Insert default
    await client.queryArray(`
      INSERT INTO public.gateway_platform_config (key, value)
      VALUES ('active_acquirer', 'openpix')
      ON CONFLICT (key) DO NOTHING
    `)

    await client.end()
    console.log('Table gateway_platform_config ensured')
    return true
  } catch (err) {
    console.error('Error ensuring table:', err)
    return false
  }
}

let tableReady = false

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Ensure table exists on first call
    if (!tableReady) {
      tableReady = await ensureTable()
    }

    if (req.method === 'GET') {
      if (!tableReady) {
        return new Response(JSON.stringify({ active_acquirer: 'openpix' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data } = await supabase
        .from('gateway_platform_config')
        .select('value')
        .eq('key', 'active_acquirer')
        .single()

      return new Response(JSON.stringify({ active_acquirer: data?.value || 'openpix' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'POST') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      })
      const { data: userData, error: userError } = await anonClient.auth.getUser()
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .eq('role', 'admin')
        .single()

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { acquirer } = await req.json()

      if (!acquirer || !['openpix', 'hubpague'].includes(acquirer)) {
        return new Response(JSON.stringify({ error: 'Invalid acquirer' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!tableReady) {
        tableReady = await ensureTable()
      }

      const { error: upsertErr } = await supabase
        .from('gateway_platform_config')
        .upsert({ key: 'active_acquirer', value: acquirer, updated_at: new Date().toISOString() }, { onConflict: 'key' })

      if (upsertErr) {
        return new Response(JSON.stringify({ error: 'Failed to update', details: upsertErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, active_acquirer: acquirer }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Platform config error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
