# Ambientes

O Tríade tem dois ambientes no Supabase. **Dados reais só no de produção, e só depois da lista "Antes do primeiro paciente real" estar completa.**

## Teste

- **Supabase:** projeto `fjadohwypqsarkyklsqh` ("Henricard0's Project"), região us-east-1, plano gratuito.
- **Dados:** só fictícios. A migration e o `seed.sql` (usuários de exemplo) estão aplicados.
- **Site:** <https://triade-hazel.vercel.app> (projeto `triade` na Vercel), com as variáveis `VITE_SUPABASE_*` apontando para este projeto.
- **Login:** senha mínima de 8 caracteres com letras e números, confirmação de e-mail ligada, redirecionamentos liberados para `localhost:5173`, `127.0.0.1:5173` e o site da Vercel.

## Produção (em preparação)

- **Supabase:** projeto `roeqxevkplkumpcnndgj`, criado em 15/11/2026 numa organização separada da de teste.
- **Região:** precisa ser São Paulo (`sa-east-1`), por causa da LGPD. Conferir antes de qualquer configuração: a região não muda depois de criado o projeto.
- **Site:** nenhum aponta para ele ainda.

### Configuração inicial (sem custo)

1. Conferir a região. Se não for `sa-east-1`, recriar o projeto.
2. Apagar a chave secreta (`sb_secret_...`) criada junto com o projeto: ela foi exposta numa conversa. Se algum dia precisar de uma, criar outra. O app não usa chave secreta.
3. Aplicar as migrations de `supabase/migrations/` e registrá-las em `supabase_migrations.schema_migrations`. **Não** rodar o `seed.sql`: usuários fictícios não entram em produção.
4. Conferir, só com consultas de leitura, que RLS e policies estão iguais às do teste. Os testes pgTAP rodam no teste e no ambiente local, não em produção.
5. Login: as mesmas regras de senha e de confirmação de e-mail do teste. **Cadastro desligado** (`disable_signup`) até o lançamento.
6. Exigir SSL nas conexões com o banco.

### Antes do primeiro paciente real

- [ ] Fase 1 concluída e testada.
- [ ] Plano Pro na organização de produção (cópias de segurança diárias, sem pausa, bloqueio de senhas vazadas, tempo limite de sessão). Envolve pagamento: decisão do Henrique.
- [ ] Envio de e-mail próprio (SMTP) e domínio, com os textos de `supabase/templates/`. O domínio depende do nome final do produto.
- [ ] Contrato de tratamento de dados (DPA) com Supabase e Vercel; termos de uso e política de privacidade revisados por advogado.
- [ ] Vercel Pro e domínio próprio. O site de produção aponta para este projeto; o site de teste continua no projeto de teste.
- [ ] `site_url` e redirecionamentos com o domínio oficial; cadastro liberado.
- [ ] Verificação em duas etapas nas contas do Supabase, da Vercel e do GitHub.

## Acesso do Claude

- O Claude configura o Supabase pela conexão em <https://claude.ai/customize/connectors>, que precisa incluir a organização do projeto. Conexões só são lidas quando a sessão começa.
- Nunca cole no chat chaves secretas (`sb_secret_...`, `service_role`) nem a senha do banco. A chave pública (`sb_publishable_...`) e a URL do projeto podem ser compartilhadas.
