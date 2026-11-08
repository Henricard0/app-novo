// Edge Function "ai" — ponte segura entre o app e a API da Anthropic (Claude).
// A chave ANTHROPIC_API_KEY fica só aqui no servidor (secret do Supabase), nunca no app.
// O Supabase exige um JWT válido (verify_jwt = true) e, além disso, a função confere
// que o token é de um usuário logado — a chave anônima pública do app não basta.
//
// Ações:
//   summary    → resumo em Markdown
//   detailed   → texto de estudo completo em Markdown (+ título sugerido)
//   flashcards → lista de perguntas e respostas (JSON estruturado)
//   ocr        → lê uma foto (escrita à mão, quadro, diagrama) e devolve Markdown editável

import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { betaJSONSchemaOutputFormat } from 'npm:@anthropic-ai/sdk@1.6.0/helpers/beta/json-schema';

const MODEL = 'claude-opus-5-5';
// Se o modelo principal recusar um pedido por política, a API refaz o pedido no modelo
// de reserva adequado automaticamente (fallback no servidor).
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

const MAX_TEXT_CHARS = 300_000;
const MAX_IMAGE_BASE64 = 7_000_000; // ~5 MB de JPEG

const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Action = 'summary' | 'detailed' | 'flashcards' | 'ocr';

interface Body {
  action: Action;
  text?: string;
  title?: string;
  imageBase64?: string;
  language?: string;
  maxCards?: number;
}

class UserError extends Error {}

/** Só usuários logados podem gastar créditos de IA (a chave anônima é pública). */
async function isSignedIn(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) return false;
  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  return !error && Boolean(data.user);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function languageRule(language: string | undefined) {
  if (!language || language === 'mesmo idioma da nota') {
    return 'Escreva no mesmo idioma das anotações do estudante.';
  }
  return `Escreva em ${language}, mesmo que as anotações estejam em outro idioma.`;
}

const BASE_SYSTEM =
  'Você é um tutor que ajuda um estudante a transformar as próprias anotações (digitadas, ditadas por voz ' +
  'ou fotografadas) em material de estudo. Anotações ditadas podem ter erros de transcrição: corrija-os pelo ' +
  'contexto, sem inventar conteúdo que não esteja nas anotações ou que não seja conhecimento consolidado do tema. ' +
  'Use Markdown simples (títulos ##, listas, **negrito**, tabelas quando ajudarem).';

function notesBlock(title: string | undefined, text: string) {
  return `<anotacoes${title ? ` titulo="${title.replace(/"/g, "'")}"` : ''}>\n${text}\n</anotacoes>`;
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]) {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

function ensureNotRefused(msg: { stop_reason: string | null }) {
  if (msg.stop_reason === 'refusal') {
    throw new UserError('A IA não pôde processar este conteúdo.');
  }
}

async function summary(body: Body) {
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low' },
    ...FALLBACK,
    system: `${BASE_SYSTEM}\n${languageRule(body.language)}`,
    messages: [
      {
        role: 'user',
        content:
          `${notesBlock(body.title, body.text!)}\n\n` +
          'Faça um resumo para revisão rápida destas anotações: os conceitos centrais em tópicos curtos, ' +
          'definições importantes em negrito e, ao final, uma seção "## Para lembrar" com 3 a 5 pontos-chave. ' +
          'Responda só com o resumo em Markdown.',
      },
    ],
  });
  ensureNotRefused(msg);
  return { text: textOf(msg.content) };
}

async function detailed(body: Body) {
  // Texto longo: usa streaming para não estourar o tempo limite da requisição.
  const msg = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 32000,
      output_config: { effort: 'medium' },
      ...FALLBACK,
      system: `${BASE_SYSTEM}\n${languageRule(body.language)}`,
      messages: [
        {
          role: 'user',
          content:
            `${notesBlock(body.title, body.text!)}\n\n` +
            'Escreva um texto de estudo completo a partir destas anotações, para quem vai estudar só por ele. ' +
            'Organize em seções com títulos, explique cada conceito com clareza, conecte as ideias, inclua ' +
            'exemplos e, quando houver, fórmulas, datas ou etapas de processos. Preencha lacunas óbvias das ' +
            'anotações com o conhecimento padrão do tema. Comece com uma linha "TÍTULO: <título curto>" e depois ' +
            'o texto em Markdown.',
        },
      ],
    })
    .finalMessage();
  ensureNotRefused(msg);
  const raw = textOf(msg.content);
  const match = raw.match(/^\s*T[ÍI]TULO:\s*(.+)\n+/i);
  return {
    title: match?.[1]?.replace(/[#*]/g, '').trim(),
    text: match ? raw.slice(match[0].length).trim() : raw,
  };
}

const FLASHCARDS_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          front: { type: 'string', description: 'Pergunta objetiva' },
          back: { type: 'string', description: 'Resposta curta e completa' },
        },
        required: ['front', 'back'],
        additionalProperties: false,
      },
    },
  },
  required: ['cards'],
  additionalProperties: false,
} as const;

async function flashcards(body: Body) {
  const max = Math.min(Math.max(Number(body.maxCards) || 15, 3), 40);
  const msg = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium', format: betaJSONSchemaOutputFormat(FLASHCARDS_SCHEMA) },
    ...FALLBACK,
    system: `${BASE_SYSTEM}\n${languageRule(body.language)}`,
    messages: [
      {
        role: 'user',
        content:
          `${notesBlock(body.title, body.text!)}\n\n` +
          `Crie até ${max} flashcards para revisão com repetição espaçada. Cada cartão testa uma única ideia ` +
          '(conceito, definição, causa e efeito, fórmula, data, comparação). A pergunta deve fazer sentido sozinha, ' +
          'sem depender de "segundo o texto". Respostas curtas (1 a 3 frases). Cubra os pontos mais importantes ' +
          'primeiro e não repita perguntas.',
      },
    ],
  });
  ensureNotRefused(msg);
  const cards = (msg.parsed_output?.cards ?? [])
    .map((c) => ({ front: c.front.trim(), back: c.back.trim() }))
    .filter((c) => c.front && c.back)
    .slice(0, max);
  if (!cards.length) throw new UserError('Não consegui criar flashcards com este conteúdo.');
  return { cards };
}

async function ocr(body: Body) {
  const data = body.imageBase64!.replace(/^data:image\/\w+;base64,/, '');
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    ...FALLBACK,
    system:
      'Você transcreve fotos de anotações de estudo (escrita à mão, quadro, livro, slide) para texto editável em ' +
      `Markdown. ${languageRule(body.language)} Mantenha o conteúdo original; não resuma.`,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          {
            type: 'text',
            text:
              'Transcreva tudo o que estiver escrito nesta foto, preservando a estrutura (títulos, listas, ' +
              'numeração, tabelas, fórmulas em notação simples). Para diagramas, setas, mapas mentais ou esquemas ' +
              'desenhados à mão, descreva a estrutura em uma lista indentada que preserve as ligações entre as ' +
              'partes (ex.: "A → B"). Marque com [ilegível] o que não der para ler. Se não houver texto nem ' +
              'diagrama, responda apenas: (sem texto). Responda só com a transcrição.',
          },
        ],
      },
    ],
  });
  ensureNotRefused(msg);
  const text = textOf(msg.content);
  return { text: text === '(sem texto)' ? '' : text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  if (!(await isSignedIn(req))) return json({ error: 'Entre na sua conta para usar a IA.' }, 401);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Pedido inválido.' }, 400);
  }

  try {
    switch (body.action) {
      case 'summary':
      case 'detailed':
      case 'flashcards': {
        if (typeof body.text !== 'string' || body.text.trim().length < 20) {
          throw new UserError('Conteúdo insuficiente para a IA.');
        }
        if (body.text.length > MAX_TEXT_CHARS) throw new UserError('A nota é longa demais. Divida em notas menores.');
        const fn = { summary, detailed, flashcards }[body.action];
        return json(await fn(body));
      }
      case 'ocr': {
        if (typeof body.imageBase64 !== 'string' || !body.imageBase64) throw new UserError('Imagem ausente.');
        if (body.imageBase64.length > MAX_IMAGE_BASE64) throw new UserError('A foto é grande demais.');
        return json(await ocr(body));
      }
      default:
        return json({ error: 'Ação desconhecida.' }, 400);
    }
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 422);
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: 'Muitos pedidos à IA agora. Tente de novo em instantes.' }, 429);
    }
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('ANTHROPIC_API_KEY inválida ou ausente');
      return json({ error: 'A IA não está configurada no servidor.' }, 500);
    }
    if (e instanceof Anthropic.APIError) {
      console.error('Erro da API Anthropic', e.status, e.message);
      return json({ error: 'A IA está indisponível no momento. Tente de novo.' }, 502);
    }
    console.error(e);
    return json({ error: 'Erro inesperado na IA.' }, 500);
  }
});
