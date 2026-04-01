import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM_EMAIL = 'pay@zaplynxpro.online'
const FROM_NAME = 'ZapLynxPay'
const LOGO_URL = 'https://talkweave-pro.lovable.app/images/logo.png'

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buildPixGeneratedEmail(data: { customerName: string; amount: number; productName: string; brCode?: string }): { subject: string; html: string } {
  const amount = formatCurrency(data.amount)
  return {
    subject: `PIX gerado - ${amount} | ${data.productName}`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden">
  <tr><td style="padding:32px 32px 0;text-align:center">
    <img src="${LOGO_URL}" alt="ZapLynxPay" width="40" height="40" style="display:block;margin:0 auto 16px;border-radius:8px;background:#fff" />
    <p style="margin:0;color:#18181b;font-size:18px;font-weight:600">PIX Gerado</p>
  </td></tr>
  <tr><td style="padding:24px 32px 32px">
    <p style="color:#3f3f46;font-size:14px;margin:0 0 20px">Olá <strong>${data.customerName}</strong>, seu PIX foi gerado. Efetue o pagamento para concluir.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:6px;margin-bottom:20px">
      <tr><td style="padding:16px;border-bottom:1px solid #e4e4e7">
        <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px">Produto</p>
        <p style="color:#18181b;font-size:15px;font-weight:600;margin:0">${data.productName}</p>
      </td></tr>
      <tr><td style="padding:16px">
        <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px">Valor</p>
        <p style="color:#18181b;font-size:22px;font-weight:700;margin:0">${amount}</p>
      </td></tr>
    </table>
    ${data.brCode ? `<p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px">Código PIX (Copia e Cola)</p>
    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:4px;padding:10px;word-break:break-all;font-size:11px;color:#3f3f46;font-family:monospace;margin-bottom:20px">${data.brCode}</div>` : ''}
    <p style="color:#a1a1aa;font-size:12px;margin:0;text-align:center">Você receberá a confirmação após o pagamento.</p>
  </td></tr>
  <tr><td style="padding:16px 32px;text-align:center;border-top:1px solid #f4f4f5">
    <p style="color:#a1a1aa;font-size:11px;margin:0">ZapLynxPay</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  }
}

function buildApprovedEmail(data: { customerName: string; amount: number; productName: string; transactionId: string }): { subject: string; html: string } {
  const amount = formatCurrency(data.amount)
  return {
    subject: `✅ Pagamento aprovado - ${amount} | ${data.productName}`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <tr><td style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:30px;text-align:center">
    <img src="${LOGO_URL}" alt="ZapLynxPay" width="48" height="48" style="display:block;margin:0 auto 12px;border-radius:8px" />
    <h1 style="margin:0;color:#fff;font-size:22px">✅ Pagamento Aprovado!</h1>
  </td></tr>
  <tr><td style="padding:30px">
    <p style="color:#0f172a;font-size:16px;margin:0 0 20px">Olá <strong>${data.customerName}</strong>,</p>
    <p style="color:#64748b;font-size:14px;margin:0 0 25px">Seu pagamento foi confirmado com sucesso! Obrigado pela sua compra.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:25px">
      <tr><td>
        <p style="color:#64748b;font-size:12px;margin:0 0 4px">Produto</p>
        <p style="color:#0f172a;font-size:16px;font-weight:bold;margin:0 0 16px">${data.productName}</p>
        <p style="color:#64748b;font-size:12px;margin:0 0 4px">Valor pago</p>
        <p style="color:#16a34a;font-size:24px;font-weight:bold;margin:0 0 16px">${amount}</p>
        <p style="color:#64748b;font-size:12px;margin:0 0 4px">ID da transação</p>
        <p style="color:#334155;font-size:13px;margin:0">${data.transactionId}</p>
      </td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin:0;text-align:center">Guarde este email como comprovante da sua compra.</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="color:#94a3b8;font-size:11px;margin:0">ZapLynxPay • Pagamentos seguros</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { type, to, data } = await req.json()

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
