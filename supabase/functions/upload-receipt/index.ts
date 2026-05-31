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
    const formData = await req.formData()
    const file = formData.get('file') as File
    const correlationID = formData.get('correlationID') as string

    if (!file || !correlationID) {
      return new Response(JSON.stringify({ error: 'Missing file or correlationID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate file size (7MB max)
    if (file.size > 7 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Arquivo muito grande (máx 7MB)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Formato não suportado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find the transaction by external_id (correlationID)
    const { data: tx, error: txErr } = await supabase
      .from('gateway_transactions')
      .select('id, metadata, user_id')
      .eq('external_id', correlationID)
      .single()

    if (txErr || !tx) {
      return new Response(JSON.stringify({ error: 'Transação não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upload file to storage
    const ext = file.name.split('.').pop() || 'jpg'
    const filePath = `${tx.user_id}/${tx.id}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadErr } = await supabase.storage
      .from('payment-receipts')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadErr) {
      console.error('Upload error:', uploadErr)
      return new Response(JSON.stringify({ error: 'Erro ao enviar arquivo' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Return a short-lived signed URL; keep the storage path in metadata for future signed access.
    const { data: signedData } = await supabase.storage
      .from('payment-receipts')
      .createSignedUrl(filePath, 60 * 60)

    const receiptUrl = signedData?.signedUrl || filePath

    // Update transaction metadata with receipt URL
    const currentMetadata = (tx.metadata as Record<string, any>) || {}
    await supabase
      .from('gateway_transactions')
      .update({
        metadata: { ...currentMetadata, receipt_path: filePath, receipt_url: filePath },
      })
      .eq('id', tx.id)

    return new Response(JSON.stringify({ receiptUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Receipt upload error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
