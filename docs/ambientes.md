# Ambientes

O Tríade usa o Firebase (Authentication + Firestore). **Dados reais só no projeto de produção, e só depois da lista "Antes do primeiro paciente real" estar completa.**

## Local (emuladores)

- `npm run emuladores` liga Authentication e Firestore na sua máquina, com o projeto fictício `demo-triade`. Nada sai para a internet.
- `npm run emuladores:semear` cria os usuários de exemplo. Os testes das regras (`npm run test:regras`) também rodam aqui.

## Teste

- **Firebase:** projeto `triade-01`. O Google Analytics foi desativado.
- **Firestore:** precisa ser criado na região São Paulo (`southamerica-east1`), em modo de produção. A região não muda depois.
- **Login:** e-mail e senha. Domínios autorizados: `localhost`, `triade-01.firebaseapp.com`, `triade-01.web.app` e `triade-hazel.vercel.app`.
- **Site:** <https://triade-hazel.vercel.app> (projeto `triade` na Vercel), com as variáveis `VITE_FIREBASE_*` apontando para `triade-01`.
- **Dados:** só fictícios. Para testar, crie uma conta pelo próprio site com um e-mail seu: o Firebase envia a confirmação para qualquer endereço.

### Configuração pendente

- [ ] Criar o banco Firestore (região `southamerica-east1`, modo de produção).
- [ ] Publicar as regras de `firestore.rules`: colar em Firestore → Rules → Publish, ou `npm run regras:publicar`.
- [ ] Opcional: em Authentication → Templates, "Customize action URL" → `https://triade-hazel.vercel.app/acao`, para os links dos e-mails abrirem as telas do Tríade.

## Produção (a criar no lançamento)

Um projeto Firebase separado, criado perto do lançamento, já no plano Blaze.

### Antes do primeiro paciente real

- [ ] Fase 1 concluída e testada.
- [ ] Projeto de produção no plano Blaze (cobra pelo uso; envolve pagamento: decisão do Henrique), com Firestore em `southamerica-east1`.
- [ ] Cópias de segurança agendadas do Firestore e recuperação a um ponto no tempo (Blaze).
- [ ] Regra de senha exigida pelo servidor (8+ caracteres, letras e números) e verificação em duas etapas (Identity Platform, no Blaze).
- [ ] App Check, para só o site do Tríade conseguir falar com o projeto.
- [ ] Domínio próprio, "Customize action URL" e domínio autorizado no Authentication.
- [ ] Contrato de tratamento de dados com Google e Vercel; termos de uso e política de privacidade revisados por advogado. A política precisa dizer que e-mail e senha (Firebase Authentication) ficam fora do Brasil; dados clínicos ficam no Firestore em São Paulo.
- [ ] Vercel Pro (o plano gratuito não permite uso comercial) ou outra hospedagem.
- [ ] Verificação em duas etapas nas contas do Google, da Vercel e do GitHub.

## Supabase (descontinuado em 15/11/2026)

O projeto começou no Supabase e trocou para o Firebase. Sobraram projetos que podem ser apagados pelo painel do Supabase: `llqunvzphflvrghvjmbb` ("triade-producao", São Paulo) e `roeqxevkplkumpcnndgj` ("Tríade", pausado; tem uma chave secreta que foi exposta). O projeto `fjadohwypqsarkyklsqh` ("Henricard0's Project") tem uma tabela de outro app e não é do Tríade.

## Acesso do Claude

- O Claude não tem acesso de administração ao Firebase. Ele testa tudo nos emuladores; criar o banco, publicar as regras e mudar configurações no console ficam com você.
- Nunca cole no chat chaves de "Service accounts" ("Generate new private key"). A configuração do app web (`apiKey`, `projectId`, `appId`...) é pública e pode ser compartilhada.
