import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  console.log('=== TESTE WEBHOOK ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))
  
  if (req.method === 'POST') {
    try {
      const body = await req.text()
      console.log('Body:', body)
    } catch (e) {
      console.log('Erro ao ler body:', e)
    }
  }
  
  return new Response('Webhook funcionando! Verifique os logs.', { 
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  })
})