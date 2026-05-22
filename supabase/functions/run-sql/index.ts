import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

serve(async (req) => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return new Response("Missing SUPABASE_DB_URL", { status: 500 });

  const sql = postgres(dbUrl);

  try {
    const { query } = await req.json();
    console.log("Executing query:", query);
    const result = await sql.unsafe(query);
    return new Response(JSON.stringify({ result }), { status: 200 });
  } catch (err) {
    console.error("SQL Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  } finally {
    await sql.end();
  }
});
