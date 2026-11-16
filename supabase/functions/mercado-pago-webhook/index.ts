// Avisos (webhooks) do Mercado Pago sobre assinaturas (Fase 3).
//
// Não exige login (quem chama é o Mercado Pago), por isso:
//   1. confere a assinatura x-signature com o segredo MP_WEBHOOK_SECRET;
//   2. nunca confia no corpo do aviso: busca a situação direto na API do
//      Mercado Pago antes de mudar qualquer plano.

import { createClient } from 'npm:@supabase/supabase-js@2'

const MP = 'https://api.mercadopago.com'
const SITUACAO: Record<string, string> = { authorized: 'ativa', paused: 'pausada', cancelled: 'cancelada', pending: 'pendente' }

async function hmacHex(segredo: string, mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(mensagem))
  return [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferenca === 0
}

async function assinaturaValida(req: Request, dataId: string): Promise<boolean> {
  const segredo = Deno.env.get('MP_WEBHOOK_SECRET')
  const cabecalho = req.headers.get('x-signature') ?? ''
  const requestId = req.headers.get('x-request-id') ?? ''
  if (!segredo || !cabecalho) return false
  const partes = Object.fromEntries(cabecalho.split(',').map((p) => p.trim().split('=') as [string, string]))
  if (!partes.ts || !partes.v1) return false
  const manifesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${partes.ts};`
  return iguais(await hmacHex(segredo, manifesto), partes.v1)
}

async function mp(caminho: string) {
  const resp = await fetch(`${MP}${caminho}`, { headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN') ?? ''}` } })
  return resp.ok ? await resp.json() : null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  const url = new URL(req.url)
  let corpo: { type?: string; data?: { id?: string } } = {}
  try {
    corpo = await req.json()
  } catch {
    // Alguns avisos vêm só na URL.
  }
  const tipo = corpo.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''
  const dataId = String(url.searchParams.get('data.id') ?? corpo.data?.id ?? '')
  if (!dataId) return new Response('sem id', { status: 400 })
  if (!(await assinaturaValida(req, dataId))) return new Response('assinatura inválida', { status: 401 })

  // Descobre a assinatura (preapproval) a que o aviso se refere.
  let preapprovalId: string | null = null
  if (tipo === 'subscription_preapproval' || tipo === 'preapproval') preapprovalId = dataId
  if (tipo === 'subscription_authorized_payment') {
    const pagamento = await mp(`/authorized_payments/${dataId}`)
    preapprovalId = pagamento?.preapproval_id ?? null
  }
  if (!preapprovalId) return new Response('ignorado')

  const assinatura = await mp(`/preapproval/${preapprovalId}`)
  if (!assinatura) return new Response('não encontrada', { status: 404 })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const status = SITUACAO[assinatura.status] ?? 'pendente'
  const { data: linha } = await admin
    .from('subscriptions')
    .update({ status, next_payment_at: assinatura.next_payment_date ?? null })
    .eq('provider_id', assinatura.id)
    .eq('user_id', assinatura.external_reference)
    .select('user_id')
    .maybeSingle()
  if (linha) {
    const { count } = await admin
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', linha.user_id)
      .eq('status', 'ativa')
    await admin.from('profiles').update({ plan: (count ?? 0) > 0 ? 'essencial' : 'gratuito' }).eq('id', linha.user_id)
  }
  return new Response('ok')
})
