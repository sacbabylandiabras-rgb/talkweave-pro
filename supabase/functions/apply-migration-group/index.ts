import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const sql = `
    ALTER TABLE public.redirect_links
    ADD COLUMN IF NOT EXISTS group_message_type text NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS group_message_template_id uuid,
    ADD COLUMN IF NOT EXISTS group_message_flow_id uuid,
    ADD COLUMN IF NOT EXISTS group_message_instance_id uuid;

    UPDATE public.redirect_links
    SET group_message_type = 'text'
    WHERE group_message_enabled = true AND group_message_text != '';
  `;

  const { error } = await supabase.rpc("exec_sql", { sql_text: sql }).maybeSingle();
  
  // Direct approach via postgres
  const pgUrl = Deno.env.get("SUPABASE_DB_URL");
  if (pgUrl) {
    const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const pool = new Pool(pgUrl, 1, true);
    const conn = await pool.connect();
    try {
      await conn.queryObject(sql);
      conn.release();
      await pool.end();
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      conn.release();
      await pool.end();
      return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ error: "no db url" }), { status: 500 });
});
