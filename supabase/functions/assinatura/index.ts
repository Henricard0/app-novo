// Assinatura do plano Essencial pelo Mercado Pago (Fase 3).
//
// Ações (POST, com o login do usuário):
//   { acao: 'criar', ciclo: 'mensal' | 'anual', recemFormado: boolean, retorno: string }
//     → cria a assinatura (preapproval) e devolve a URL de pagamento do Mercado Pago.
//   { acao: 'sincronizar' } → consulta o Mercado Pago e atualiza o plano.
//   { acao: 'cancelar' }    → cancela a assinatura.
//
// Segurança: o preço é calculado aqui, não vem do navegador; a chave do Mercado
// Pago (MP_ACCESS_TOKEN) só existe no servidor; o plano só muda depois de
// confirmar a situação direto na API do Mercado Pago.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const MP = 'https://api.mercadopago.com'
const PRECOS = { mensal: 38.3, anual: 383 } as const
const ORIGENS_PERMITIDAS = (Deno.env.get('SITE_ORIGINS') ??
  'https://triade-hazel.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:4173')
  .split(',')
  .map((o) => o.trim())

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

type Preapproval = { id: string; status: string; external_reference?: string; next_payment_date?: string; init_point?: string }

const SITUACAO: Record<string, string> = { authorized: 'ativa', paused: 'pausada', cancelled: 'cancelada', pending: 'pendente' }

async function chamarMP(caminho: string, init: RequestInit = {}) {
  const token = Deno.env.get('MP_ACCESS_TOKEN')
  if (!token) throw new Error('MP_ACCESS_TOKEN não configurado')
  return fetch(`${MP}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

/** Aplica no banco a situação confirmada pelo Mercado Pago. */
export async function aplicarSituacao(admin: SupabaseClient, mp: Preapproval) {
  const status = SITUACAO[mp.status] ?? 'pendente'
  const { data: assinatura } = await admin
    .from('subscriptions')
    .update({ status, next_payment_at: mp.next_payment_date ?? null })
    .eq('provider_id', mp.id)
    .select('user_id')
    .maybeSingle()
  if (!assinatura) return null
  // Essencial enquanto houver alguma assinatura ativa do usuário.
  const { count } = await admin
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', assinatura.user_id)
    .eq('status', 'ativa')
  await admin.from('profiles').update({ plan: (count ?? 0) > 0 ? 'essencial' : 'gratuito' }).eq('id', assinatura.user_id)
  return status
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const usuarioCliente = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const {
    data: { user },
  } = await usuarioCliente.auth.getUser()
  if (!user) return resposta({ erro: 'Entre na sua conta.' }, 401)
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let corpo: { acao?: string; ciclo?: string; recemFormado?: boolean; retorno?: string }
  try {
    corpo = await req.json()
  } catch {
    return resposta({ erro: 'Pedido inválido.' }, 400)
  }

  try {
    if (corpo.acao === 'criar') {
      const ciclo = corpo.ciclo === 'anual' ? 'anual' : corpo.ciclo === 'mensal' ? 'mensal' : null
      if (!ciclo) return resposta({ erro: 'Escolha mensal ou anual.' }, 400)
      let retorno: URL
      try {
        retorno = new URL(corpo.retorno ?? '')
      } catch {
        return resposta({ erro: 'Endereço de retorno inválido.' }, 400)
      }
      if (!ORIGENS_PERMITIDAS.includes(retorno.origin)) return resposta({ erro: 'Endereço de retorno não permitido.' }, 400)

      const recemFormado = corpo.recemFormado === true
      const valor = Math.round(PRECOS[ciclo] * (recemFormado ? 0.5 : 1) * 100) / 100
      const resp = await chamarMP('/preapproval', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          reason: `Tríade Essencial (${ciclo})${recemFormado ? ' · recém-formado' : ''}`,
          external_reference: user.id,
          // No modo de teste, o pagador precisa ser a conta de teste "Comprador".
          payer_email: Deno.env.get('MP_PAYER_EMAIL_TESTE') ?? user.email,
          back_url: retorno.toString(),
          status: 'pending',
          auto_recurring: {
            frequency: ciclo === 'anual' ? 12 : 1,
            frequency_type: 'months',
            transaction_amount: valor,
            currency_id: 'BRL',
          },
        }),
      })
      const mp = (await resp.json()) as Preapproval & { message?: string }
      if (!resp.ok || !mp.init_point) {
        console.error('Mercado Pago recusou a assinatura', resp.status, mp.message)
        return resposta({ erro: 'O Mercado Pago não aceitou criar a assinatura. Tente de novo em instantes.', detalhe: mp.message ?? null }, 502)
      }
      const { error } = await admin.from('subscriptions').insert({
        user_id: user.id,
        provider_id: mp.id,
        cycle: ciclo,
        amount: valor,
        new_graduate_discount: recemFormado,
        discount_until: recemFormado ? new Date(Date.now() + 365 * 864e5).toISOString() : null,
        status: 'pendente',
      })
      if (error) {
        console.error('Erro ao gravar assinatura', error.message)
        return resposta({ erro: 'Não foi possível registrar a assinatura.' }, 500)
      }
      return resposta({ url: mp.init_point })
    }

    if (corpo.acao === 'sincronizar' || corpo.acao === 'cancelar') {
      const { data: assinaturas } = await admin
        .from('subscriptions')
        .select('provider_id, status')
        .eq('user_id', user.id)
        .neq('status', 'cancelada')
        .order('created_at', { ascending: false })
      const lista = (assinaturas ?? []).filter((a) => a.provider_id)
      if (!lista.length) return resposta({ situacao: null })

      let ultima: string | null = null
      for (const a of lista) {
        const resp = corpo.acao === 'cancelar'
          ? await chamarMP(`/preapproval/${a.provider_id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) })
          : await chamarMP(`/preapproval/${a.provider_id}`)
        const mp = (await resp.json()) as Preapproval
        if (!resp.ok || mp.external_reference !== user.id) continue
        ultima = await aplicarSituacao(admin, mp)
      }
      return resposta({ situacao: ultima })
    }

    return resposta({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    console.error('Falha na assinatura', e instanceof Error ? e.message : e)
    return resposta({ erro: 'Algo deu errado. Tente de novo em instantes.' }, 500)
  }
})
