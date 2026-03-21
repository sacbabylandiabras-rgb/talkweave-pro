import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')!
    
    // Use postgres connection via fetch to Supabase REST API with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Execute raw SQL via PostgREST rpc
    const sql = `
      CREATE TABLE IF NOT EXISTS public.group_welcome_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        group_id text NOT NULL,
        group_name text NOT NULL DEFAULT '',
        message text NOT NULL DEFAULT 'Olá {{nome}}! 👋 Bem-vindo ao grupo!',
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id, group_id)
      );
    `

    // Connect directly using Deno's postgres
    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts")
    const client = new Client(dbUrl)
    await client.connect()
    
    await client.queryObject(sql)
    
    await client.queryObject(`ALTER TABLE public.group_welcome_config ENABLE ROW LEVEL SECURITY`)
    
    // Create policies (ignore if exists)
    const policies = [
      `DO $$ BEGIN CREATE POLICY "Users can view own group_welcome_config" ON public.group_welcome_config FOR SELECT TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN CREATE POLICY "Users can create own group_welcome_config" ON public.group_welcome_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN CREATE POLICY "Users can update own group_welcome_config" ON public.group_welcome_config FOR UPDATE TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      `DO $$ BEGIN CREATE POLICY "Users can delete own group_welcome_config" ON public.group_welcome_config FOR DELETE TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    ]
    
    for (const p of policies) {
      await client.queryObject(p)
    }
    
    // Create trigger
    await client.queryObject(`
      DO $$ BEGIN
        CREATE TRIGGER update_group_welcome_config_updated_at 
        BEFORE UPDATE ON public.group_welcome_config 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `)
    
    await client.end()

    return new Response(JSON.stringify({ success: true, message: 'Table created' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Setup error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
