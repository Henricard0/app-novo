# Ambientes

**Decisão do Henrique (16/11/2026): tudo do Tríade fica no projeto `fjadohwypqsarkyklsqh` ("Henricard0's Project") do Supabase.** O projeto `llqunvzphflvrghvjmbb` ("triade-producao", organização "Tríade") deixou de ser do Tríade e vai ser reaproveitado para outra coisa: não aplicar migrations do Tríade nele nem apontar o site para ele.

## Projeto do Tríade

- **Supabase:** projeto `fjadohwypqsarkyklsqh` ("Henricard0's Project"), região us-east-1, plano gratuito.
- **URL:** `https://fjadohwypqsarkyklsqh.supabase.co`. A chave pública (publishable) está no painel, em Project Settings → API Keys.
- **Dados:** por enquanto só fictícios e as contas do Henrique e do pai. Todas as migrations de `supabase/migrations/` e os usuários de exemplo do `seed.sql` estão aplicados.
- **Edge Functions:** `assinatura` e `mercado-pago-webhook` (Mercado Pago em modo de teste). Storage: bucket privado `guias`.
- **Site:** <https://triade-hazel.vercel.app> (projeto `triade` na Vercel), com as variáveis `VITE_SUPABASE_*` apontando para este projeto.
- **Login:** senha mínima de 8 caracteres com letras e números, confirmação de e-mail ligada, verificação em duas etapas (TOTP) ligada, redirecionamentos liberados para `localhost:5173`, `127.0.0.1:5173` e o site da Vercel.

### Antes do primeiro paciente real (no mesmo projeto)

- [ ] **Região:** o projeto está nos EUA (us-east-1). Dado de saúde é sensível na LGPD; hospedar no Brasil simplifica. O Supabase não muda a região de um projeto existente: se for preciso, criar um projeto novo em São Paulo e migrar antes de entrar dado real. Decisão do Henrique.
- [ ] Apagar os dados e usuários fictícios (Marina, Paulo, Bianca, Carla) antes de abrir para usuários reais.
- [ ] Plano Pro do Supabase (cópias de segurança diárias, sem pausa, bloqueio de senhas vazadas, tempo limite de sessão). Envolve pagamento: decisão do Henrique.
- [ ] Envio de e-mail próprio (SMTP) e domínio, com os textos de `supabase/templates/`. O domínio depende do nome final do produto.
- [ ] Contrato de tratamento de dados (DPA) com Supabase e Vercel; termos de uso e política de privacidade revisados por advogado.
- [ ] Vercel Pro e domínio próprio; `site_url` e redirecionamentos com o domínio oficial.
- [ ] Credenciais de produção do Mercado Pago (exige CNPJ) e retirar `MP_PAYER_EMAIL_TESTE`.
- [ ] Exigir SSL nas conexões diretas com o banco (Project Settings → Database).
- [ ] Verificação em duas etapas nas contas do Supabase, da Vercel e do GitHub.

## Outros projetos

- `llqunvzphflvrghvjmbb` ("triade-producao", São Paulo): **não é mais do Tríade** (será reaproveitado pelo Henrique). Tem só a estrutura da Fase 0, sem dados.
- `roeqxevkplkumpcnndgj` ("Tríade", us-east-1): descartado e pausado. Apagar pelo painel; isso apaga também a chave secreta dele, que foi exposta numa conversa.

## Acesso do Claude

- O Claude aplica migrations e consulta o banco do projeto do Tríade pela conexão do Supabase. Configurações de login e segredos das Edge Functions ficam no painel.
- Nunca cole no chat chaves secretas (`sb_secret_...`, `service_role`) nem a senha do banco. A chave pública (`sb_publishable_...`) e a URL do projeto podem ser compartilhadas.
