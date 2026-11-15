# Ambientes

O Tríade tem dois ambientes no Supabase. **Dados reais só no de produção, e só depois da lista "Antes do primeiro paciente real" estar completa.**

## Teste

- **Supabase:** projeto `fjadohwypqsarkyklsqh` ("Henricard0's Project"), região us-east-1, plano gratuito.
- **Dados:** só fictícios. A migration e o `seed.sql` (usuários de exemplo) estão aplicados.
- **Site:** <https://triade-hazel.vercel.app> (projeto `triade` na Vercel), com as variáveis `VITE_SUPABASE_*` apontando para este projeto.
- **Login:** senha mínima de 8 caracteres com letras e números, confirmação de e-mail ligada, redirecionamentos liberados para `localhost:5173`, `127.0.0.1:5173` e o site da Vercel.

## Produção (em preparação)

- **Supabase:** projeto `llqunvzphflvrghvjmbb` ("triade-producao"), organização "Tríade" (plano gratuito), região São Paulo (`sa-east-1`), criado em 15/11/2026.
- **URL:** `https://llqunvzphflvrghvjmbb.supabase.co`. A chave pública (publishable) está no painel, em Project Settings → API Keys.
- **Senha do banco:** gerada automaticamente na criação. Para usar o Supabase CLI (`supabase link`), redefinir em Project Settings → Database.
- **Site:** nenhum aponta para ele ainda.
- **Projeto descartado:** `roeqxevkplkumpcnndgj` ("Tríade", us-east-1) foi criado fora de São Paulo e está pausado. Apagar pelo painel; isso apaga também a chave secreta dele, que foi exposta numa conversa.

### Configuração inicial (sem custo)

- [x] Região São Paulo.
- [x] Migrations de `supabase/migrations/` aplicadas, com a mesma versão do arquivo em `supabase_migrations.schema_migrations`. O `seed.sql` **não** foi rodado: usuários fictícios não entram em produção.
- [x] RLS, policies, permissões, triggers e funções conferidos com consultas de leitura: idênticos ao teste. Os verificadores de segurança e desempenho do Supabase não apontaram problemas. Os testes pgTAP rodam no teste e no ambiente local, não em produção.
- [ ] Login, no painel (Authentication): **cadastro desligado** até o lançamento ("Allow new users to sign up"); confirmação de e-mail ligada; troca de senha segura ligada; senha com no mínimo 8 caracteres, letras e números.
- [ ] Exigir SSL nas conexões diretas com o banco (Project Settings → Database).
- [ ] Apagar o projeto descartado `roeqxevkplkumpcnndgj`.

### Antes do primeiro paciente real

- [ ] Fase 1 concluída e testada.
- [ ] Plano Pro na organização de produção (cópias de segurança diárias, sem pausa, bloqueio de senhas vazadas, tempo limite de sessão). Envolve pagamento: decisão do Henrique.
- [ ] Envio de e-mail próprio (SMTP) e domínio, com os textos de `supabase/templates/`. O domínio depende do nome final do produto.
- [ ] Contrato de tratamento de dados (DPA) com Supabase e Vercel; termos de uso e política de privacidade revisados por advogado.
- [ ] Vercel Pro e domínio próprio. O site de produção aponta para este projeto; o site de teste continua no projeto de teste.
- [ ] `site_url` e redirecionamentos com o domínio oficial; cadastro liberado.
- [ ] Verificação em duas etapas nas contas do Supabase, da Vercel e do GitHub.

## Acesso do Claude

- O Claude configura o Supabase pela conexão em <https://claude.ai/customize/connectors>, que precisa incluir a organização do projeto. Hoje a conexão alcança a organização "Tríade" (produção): dá para aplicar migrations e consultar o banco, mas não mudar as configurações de login, que ficam no painel.
- Nunca cole no chat chaves secretas (`sb_secret_...`, `service_role`) nem a senha do banco. A chave pública (`sb_publishable_...`) e a URL do projeto podem ser compartilhadas.
