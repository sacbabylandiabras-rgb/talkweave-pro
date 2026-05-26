import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM_EMAIL = 'pay@zaplynxpro.online'
const FROM_NAME = 'ZapLynxPay'
const BRAND_NAME = 'ZapLynxPay'

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buildShell(params: {
  eyebrow?: string
  title: string
  intro: string
  content: string
  footer: string
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
  <tr><td style="padding:28px 32px 12px;text-align:center">
    <div style="display:inline-block;padding:6px 12px;border:1px solid #e4e4e7;border-radius:999px;color:#18181b;font-size:12px;font-weight:600;letter-spacing:0.3px;margin-bottom:14px">${BRAND_NAME}</div>
    ${params.eyebrow ? `<div style="color:#71717a;font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:8px">${params.eyebrow}</div>` : ''}
    <h1 style="margin:0;color:#18181b;font-size:24px;line-height:1.2;font-weight:700">${params.title}</h1>
  </td></tr>
  <tr><td style="padding:12px 32px 32px">
    <p style="color:#3f3f46;font-size:14px;line-height:1.6;margin:0 0 20px">${params.intro}</p>
    ${params.content}
    <p style="color:#a1a1aa;font-size:12px;line-height:1.5;margin:20px 0 0;text-align:center">${params.footer}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function buildDetailsCard(rows: Array<{ label: string; value: string; valueStyle?: string }>): string {
  const renderedRows = rows.map((row, index) => `
    <tr><td style="padding:16px${index < rows.length - 1 ? ';border-bottom:1px solid #e4e4e7' : ''}">
      <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px">${row.label}</p>
      <p style="margin:0;color:#18181b;font-size:15px;font-weight:600;${row.valueStyle ?? ''}">${row.value}</p>
    </td></tr>
  `).join('')

  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:8px;margin-bottom:20px">${renderedRows}</table>`
}

function buildPixGeneratedEmail(data: { customerName: string; amount: number; productName: string; brCode?: string }): { subject: string; html: string } {
  const amount = formatCurrency(data.amount)
  const details = buildDetailsCard([
    { label: 'Produto', value: data.productName },
    { label: 'Valor', value: amount, valueStyle: 'font-size:22px;font-weight:700;' },
  ])

  const pixCode = data.brCode
    ? `<p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px">Código PIX (Copia e Cola)</p>
       <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:6px;padding:12px;word-break:break-all;font-size:11px;line-height:1.5;color:#3f3f46;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-bottom:20px">${data.brCode}</div>`
    : ''

  return {
    subject: `PIX gerado - ${amount} | ${data.productName}`,
    html: buildShell({
      eyebrow: 'Pagamento pendente',
      title: 'PIX gerado',
      intro: `Olá <strong>${data.customerName}</strong>, seu PIX foi gerado. Efetue o pagamento para concluir sua compra.`,
      content: `${details}${pixCode}`,
      footer: 'Você receberá a confirmação automaticamente após o pagamento.',
    }),
  }
}

function buildApprovedEmail(data: { customerName: string; amount: number; productName: string; transactionId: string }): { subject: string; html: string } {
  const amount = formatCurrency(data.amount)
  const details = buildDetailsCard([
    { label: 'Produto', value: data.productName },
    { label: 'Valor pago', value: amount, valueStyle: 'font-size:22px;font-weight:700;' },
    { label: 'Transação', value: data.transactionId, valueStyle: 'font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;color:#3f3f46;' },
  ])

  return {
    subject: `Pagamento aprovado - ${amount} | ${data.productName}`,
    html: buildShell({
      eyebrow: 'Pagamento confirmado',
      title: 'Pagamento aprovado',
      intro: `Olá <strong>${data.customerName}</strong>, seu pagamento foi confirmado com sucesso. Obrigado pela compra.`,
      content: details,
      footer: 'Guarde este email como comprovante da sua compra.',
    }),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { type, to, data, userId } = await req.json()

    if (!type || !to) {
      return new Response(JSON.stringify({ error: 'Missing type or to' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let email: { subject: string; html: string }

    switch (type) {
      case 'pix_generated':
        email = buildPixGeneratedEmail(data)
        break
      case 'approved':
        email = buildApprovedEmail(data)
        break
      default:
        return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.hostinger.com'
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465')
    const smtpUser = Deno.env.get('SMTP_USER') || FROM_EMAIL
    const smtpPass = Deno.env.get('SMTP_PASS') || ''

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    })

    await client.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject: email.subject,
      html: email.html,
    })

    await client.close()

    console.log(`Email sent: ${type} to ${to}`)

    return new Response(JSON.stringify({ ok: true, type, to }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Send email error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})