# Lumen: notas de estudo com IA

App de estudos para **iPhone, Android e web**, feito em **React Native (Expo)**. Você escreve, dita ou fotografa suas anotações. A IA gera **resumos**, um **texto de estudo detalhado** e **flashcards** com repetição espaçada. Tudo funciona **offline** e sincroniza entre aparelhos quando há internet.

## Funcionalidades

| Recurso | Como funciona |
| --- | --- |
| 📝 Notas em Markdown | Editor com barra de formatação (títulos, negrito, listas, checklists, código, tabelas) e modo de leitura renderizado |
| 🎤 Ditado por voz | Reconhecimento de fala nativo (Apple / Google) em modo contínuo, bom para transcrever uma aula inteira |
| 📷 Câmera + leitura por IA | Fotografe o caderno ou um diagrama feito à mão. A IA transcreve tudo para texto editável dentro da nota |
| ✨ Resumo por IA | Pontos principais e uma seção "Para lembrar" |
| 📖 Texto detalhado por IA | Um texto completo, organizado e explicado, para estudar só por ele |
| 🃏 Flashcards por IA | Perguntas e respostas geradas da nota, revisadas com o algoritmo SM-2 (o mesmo princípio do Anki) |
| 📴 Offline-first | Tudo fica salvo no aparelho (SQLite). Pedidos de IA feitos sem internet entram numa fila e rodam quando a conexão volta |
| 🔄 Sincronização | iPhone ↔ Android ↔ web via Supabase. A alteração mais recente de cada item vence |
| ☁️ Backup na nuvem | Notas, flashcards, tarefas **e fotos** ficam salvos na sua conta. Também há backup e restauração por arquivo JSON |
| 📤 Exportação | Nota em **PDF, Markdown, TXT, HTML e JSON**. Flashcards em **CSV/TSV** (Anki, Quizlet, planilhas) e JSON |
| 🔔 Notificações inteligentes | Aviso antes do prazo das tarefas e lembrete diário **só nos dias** com revisões ou tarefas pendentes, com a contagem real |
| 🎨 Personalização | Tema claro, escuro ou automático, 8 cores de destaque, 4 tamanhos de texto, 3 fontes de editor e escolha do que aparece no painel |
| 🏠 Painel minimalista | Saudação, números do dia, botão "hora de revisar", atalhos (nota, ditado, foto), próximas tarefas e notas recentes |

## Arquitetura

```
┌───────────────────────────┐        ┌──────────────────────────────┐
│ App (Expo / React Native) │        │ Supabase                     │
│  iPhone · Android · Web   │  sync  │  Auth (e-mail e senha)       │
│                           ├───────►│  Postgres: tabela `records`  │
│  SQLite local (offline)   │        │  Storage: bucket de fotos    │
│  Fila de IA offline       │  IA    │  Edge Function `ai` ─────────┼──► API da Anthropic (Claude)
│  Notificações locais      ├───────►│  (guarda a chave da API)     │
└───────────────────────────┘        └──────────────────────────────┘
```

- A **chave da API da Anthropic nunca fica no app**. Ela fica como *secret* da Edge Function, e só usuários logados podem chamar a função.
- As regras **RLS** do banco garantem que cada usuário só acesse os próprios dados e fotos.

```
src/
  app/                 telas (Expo Router)
    (tabs)/            Início, Notas, Flashcards, Tarefas, Ajustes
    note/[id].tsx      editor da nota (ditado, fotos, IA, exportação)
    review.tsx         sessão de revisão de flashcards
    auth.tsx           login e conta
  components/          UI, editor e visualizador de Markdown
  lib/
    store.ts           dados locais (Zustand + SQLite)
    sync.ts            sincronização com o Supabase
    ai.ts              chamadas de IA e fila offline
    speech.ts          ditado por voz
    attachments.ts     câmera, galeria e arquivos de fotos
    export.ts          exportação, backup e restauração
    notifications.ts   lembretes inteligentes
    srs.ts             repetição espaçada (SM-2)
supabase/
  migrations/          tabelas, regras de segurança e bucket de fotos
  functions/ai/        Edge Function que conversa com o Claude
```

---

## 1. Rodar no computador

Pré-requisito: [Node.js 22+](https://nodejs.org).

```bash
npm install
cp .env.example .env      # preencha depois do passo 2 (opcional para testar offline)
npx expo start
```

- Tecle **`w`** para abrir no navegador. Notas, flashcards, tarefas, temas e exportação já funcionam lá.
- O **Expo Go** abre o app no celular, mas **não tem** o módulo nativo de ditado. Para usar o microfone, gere um *development build* (passo 3).

Comandos úteis: `npm run typecheck`, `npx expo-doctor`.

## 2. Ativar nuvem, sincronização, backup e IA (Supabase + Claude)

Sem esta etapa o app funciona 100% offline, mas sem sincronização e sem IA.

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. **Banco de dados:** abra *SQL Editor*, cole o conteúdo de `supabase/migrations/20261108000000_init.sql` e execute.
   Pelo terminal também funciona: `npx supabase link --project-ref SEU_REF` e depois `npx supabase db push`.
3. **Chave da IA:** crie uma chave em [console.anthropic.com](https://console.anthropic.com) e salve como *secret* (nunca no `.env` do app):
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
4. **Publique a função de IA:**
   ```bash
   npx supabase functions deploy ai
   ```
5. **Conecte o app:** em *Project Settings → API*, copie a URL e a chave `anon`/`publishable` para o `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```
6. *(Opcional)* Em *Authentication → Sign In / Providers → Email*, desligue "Confirm email" se não quiser confirmar o e-mail ao criar a conta.

Reinicie o `npx expo start`, vá em **Ajustes → Entrar ou criar conta**, e pronto.

> A IA usa o modelo **Claude Opus 5.5** (`claude-opus-5-5`), configurado em `supabase/functions/ai/index.ts`. O custo é por uso, cobrado na sua conta da Anthropic. Se o modelo recusar um pedido, o fallback automático do servidor (`fallbacks: "default"`) refaz o pedido em outro modelo.

## 3. Instalar no iPhone e no Android

Os builds são feitos na nuvem pelo **EAS (Expo Application Services)**, então **não precisa de Mac**.

```bash
npm install -g eas-cli
eas login                 # conta grátis em expo.dev
eas init                  # vincula o projeto (preenche o projectId no app.json)
```

O `.env` não é enviado para o build. Cadastre as variáveis no EAS uma vez:

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" \
  --environment development --environment preview --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sua-chave" \
  --environment development --environment preview --environment production --visibility plaintext
```

### iPhone

A Apple exige o **Apple Developer Program (US$ 99/ano)** para instalar um app próprio num iPhone de verdade.

| Objetivo | Comando |
| --- | --- |
| Instalar direto no seu iPhone (link/QR code) | `eas device:create` (cadastra o iPhone) e depois `npm run build:preview -- --platform ios` |
| TestFlight / App Store | `npm run build:ios` e depois `npm run submit:ios` |
| Desenvolvimento com recarga ao vivo | `npm run build:dev -- --platform ios` e depois `npx expo start` |

Antes do primeiro build, troque o `bundleIdentifier` em `app.json` (hoje `com.henricard0.lumen`) se quiser outro identificador.

### Android

| Objetivo | Comando |
| --- | --- |
| APK para instalar direto (não precisa de conta paga) | `npm run build:preview -- --platform android` |
| Google Play | `npm run build:android` e depois `npm run submit:android` |

### Pelo GitHub (sem terminal)

O workflow **Build do app** (`.github/workflows/eas-build.yml`) dispara o build pelo GitHub:

1. Crie um token em *expo.dev → Account settings → Access tokens*.
2. No GitHub: *Settings → Secrets and variables → Actions → New secret* com o nome `EXPO_TOKEN`.
3. Em *Actions → Build do app → Run workflow*, escolha plataforma e perfil.

A cada push ou pull request, o workflow **CI** verifica os tipos e empacota o app para iOS, Android e web.

---

## Como usar

- **Painel → Ditar:** cria uma nota e já começa a ouvir. Fale normalmente. Cada frase reconhecida entra no texto.
- **Painel → Foto:** tire uma foto do caderno. O app pergunta se a IA deve ler a foto e insere o texto na nota.
- Na nota, o botão **✨** gera o resumo, o texto detalhado ou os flashcards. Sem internet, o pedido fica na fila.
- **⋯ → Exportar** gera PDF, Markdown, TXT, HTML ou JSON e abre o compartilhamento do sistema (Arquivos, AirDrop, e-mail, Drive…).
- **Flashcards → Começar revisão:** toque para ver a resposta e avalie (Errei / Difícil / Bom / Fácil). O app agenda a próxima revisão.
- **Ajustes:** tema, cores, fonte, widgets do painel, idioma do ditado e da IA, horário dos lembretes e backup.

## Limitações conhecidas

- **Conflitos:** se a mesma nota for editada em dois aparelhos offline, vale a versão salva por último. Não há mesclagem linha a linha.
- **Ditado:** precisa do app instalado (development build ou loja). No Android, o modo contínuo exige Android 13+.
- **Versão web:** serve para usar no computador e testar. Notificações e ditado dependem do navegador.
- **Trocar de conta no mesmo aparelho:** os dados locais continuam no aparelho e são enviados para a conta em que você entrar. Use *Ajustes → Apagar dados deste aparelho* antes de entrar com outra conta.
