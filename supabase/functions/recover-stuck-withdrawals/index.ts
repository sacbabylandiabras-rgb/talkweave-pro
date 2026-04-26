import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Saques em 'processing' há mais de 10 minutos sem reviewed_at confirmado
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    const { data: stuck, error } = await supabase
      .from('gateway_withdrawals')
      .select('id, user_id, amount, pix_key, created_at, updated_at, reviewed_at')
      .eq('status', 'processing')
      .lt('updated_at', cutoff)

    if (error) {
      console.error('Erro ao buscar saques travados:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!stuck || stuck.length === 0) {
      console.log('Nenhum saque travado encontrado')
      return new Response(JSON.stringify({ ok: true, recovered: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Filtra os que não têm reviewed_at (não foram concluídos pela adquirente)
    const toRecover = stuck.filter((w: any) => !w.reviewed_at)

    console.log(`Encontrados ${toRecover.length} saques travados há +10min`)

    let recovered = 0
    const results: any[] = []

    for (const w of toRecover) {
      const { error: updErr } = await supabase
        .from('gateway_withdrawals')
        .update({
          status: 'pending',
          admin_notes: `Auto-recuperação: function process-withdrawal travou (timeout) sem completar transferência. Saque liberado para reprocessamento em ${new Date().toISOString()}.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', w.id)
        .eq('status', 'processing') // proteção contra race condition

      if (updErr) {
        console.error(`Erro ao reverter saque ${w.id}:`, updErr)
        results.push({ id: w.id, error: updErr.message })
      } else {
        console.log(`✅ Saque ${w.id} (R$ ${(w.amount / 100).toFixed(2)}) revertido para pending`)
        recovered++
        results.push({ id: w.id, amount: w.amount, recovered: true })
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: stuck.length, recovered, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro recover-stuck-withdrawals:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})