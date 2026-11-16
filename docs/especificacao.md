# Especificação — Tríade (nome provisório)

## 1. Produto

Sistema web para psicólogos organizarem o consultório (agenda, pacientes, prontuário, financeiro, documentos) com dois módulos que diferenciam o produto:

- **Supervisão clínica:** o psicólogo leva casos anonimizados para o supervisor, recebe devolutivas com encaminhamentos e acumula horas de supervisão com declaração.
- **Validação de registros de estágio:** o supervisor de estágio revisa, comenta e valida os registros dos estagiários antes que eles entrem no prontuário.

Referência de mercado: o PsicoManager já cobre bem a gestão de consultório (agenda, prontuário, IA para evolução, Receita Saúde, NFS-e, sala virtual, escalas). Não copiar marca, textos nem visual dele. O diferencial aqui é a supervisão e o estágio.

## 2. Papéis

- **Psicólogo:** dono dos seus pacientes e prontuários. Quando tem supervisor, também é **supervisionando**.
- **Supervisor:** psicólogo que supervisiona outros, individualmente ou em grupo. Um mesmo usuário pode ser psicólogo e supervisor.
- **Estagiário:** estudante em estágio supervisionado. Os registros dele dependem de validação do supervisor de estágio.
- **Clínica ou instituição** (futuro): vários profissionais sob uma conta.

## 3. Planos

| Plano | Para quem | O que libera |
|---|---|---|
| Gratuito | Quem supervisiona ou está começando | Supervisão completa e consultório com até 10 pacientes ativos |
| Básico, Essencial, Profissional (pagos) | Psicólogos | Ver abaixo |

- O supervisor escolhe se assina ou não. Sem assinar, as áreas de consultório aparecem bloqueadas com convite para o Essencial (ver `docs/referencia-telas/Supervisor.dc.html`).
- Implementação: `profiles.plan` (só o servidor muda), `plano_efetivo()`, `limite_de_pacientes()` e gatilho no banco; assinaturas em `subscriptions`.
- **Planos e preços (decididos pelo Henrique em 16/11/2026):**
  - **Gratuito** (R$ 0): supervisão completa (rede, casos, devolutivas, horas, grupos) e até **10 pacientes ativos**. Substitui o antigo "Supervisor grátis".
  - **Básico** (R$ 29,90/mês ou R$ 299/ano): até **30 pacientes ativos**.
  - **Essencial** (R$ 39,90/mês ou R$ 399/ano): pacientes ilimitados e **emissão de NFS-e**.
  - **Profissional** (R$ 49,90/mês ou R$ 499/ano): tudo do Essencial + financeiro, recibos, declarações em PDF e assinatura digital.
  - **30 dias grátis do Profissional** ao se cadastrar, sem cartão; **50% no primeiro ano para recém-formados** em qualquer plano pago.
  - Arquivados não contam no limite de pacientes. O limite é aplicado no banco.
- **Supervisionando não precisa de plano pago** para usar a plataforma, encontrar supervisor e levar casos. A supervisão é cobrada pelo supervisor, combinada entre os dois, fora da plataforma.
- **Pagamento dos planos:** Mercado Pago (assinatura). Até haver CNPJ, só em modo de teste.

## 4. Fluxos

### 4.1 Rede de supervisores e vínculo de supervisão
1. **Rede:** qualquer psicólogo com CRP pode ligar "Ofereço supervisão" em "Meu perfil" e preencher apresentação, formação, abordagens, áreas, anos de experiência, modalidade, formato, cidade/UF e valor (só informativo; o pagamento é combinado fora da plataforma). Só usuários logados veem a rede.
2. **Encontrar e pedir:** o psicólogo busca na rede (texto, abordagem, modalidade, UF), abre o perfil, confere o CRP pela consulta pública do CFP e envia um pedido com mensagem curta. O supervisor vê nome, CRP e mensagem e aceita ou recusa. Avisos dentro do site (contador no menu).
3. **Convite por link:** para quem já tem supervisor fora da plataforma, qualquer um dos dois gera um link (vale 14 dias, uso único) e manda por WhatsApp ou e-mail. Quem fica como supervisor precisa ter CRP.
4. Ao aceitar (pedido ou convite), nasce um `supervision_link` ativo. Qualquer uma das pontas pode encerrar.
5. Quem não tem conta faz cadastro a partir do convite (o plano Supervisor grátis entra na Fase 3).
6. **Grupos (decisão do Henrique, opção B):** o supervisor monta grupos e marca encontros do grupo; cada supervisionando leva os próprios casos e **só o supervisor lê os casos** — os colegas do grupo não veem os casos uns dos outros. As horas do encontro são registradas para cada presente.
7. **Depois:** selo "CRP verificado", foto no perfil, feed e chat ficam para fases futuras.

### 4.2 Levar caso para supervisão (tela `LevarCaso.dc.html`)
1. A partir do paciente, o psicólogo escolhe um ou mais registros do prontuário.
2. O sistema gera a versão anonimizada (seção 5) e mostra lado a lado: "No prontuário" (só ele vê) e "O que o supervisor vai ver".
3. Opções: manter a idade; trocar datas exatas por mês e ano; manter o setor de trabalho sem o nome da empresa. Nomes, contatos e endereços são sempre removidos.
4. Lista dos trechos identificáveis encontrados. Revisão humana obrigatória.
5. Ele escreve a pergunta ("O que você quer discutir?") e envia para a pauta da próxima supervisão.
6. Ao enviar, o sistema grava uma **cópia anonimizada** (snapshot). Nunca uma referência ao registro original.

Status do caso: `rascunho` → `na_pauta` → `discutido` → `devolutiva_recebida`.

### 4.3 Pauta e sala de supervisão (telas `Supervisor.dc.html` e `Sessao.dc.html`)
- O supervisor vê a pauta da semana agrupada por sessão (individual ou grupo).
- Na sala: caso anonimizado + pergunta à esquerda; à direita, a devolutiva com "O que você observou", "Hipóteses e caminhos", lista de encaminhamentos e a opção de registrar a hora de supervisão.
- Ao enviar, a devolutiva aparece no espaço de supervisão do supervisionando (`Supervisao.dc.html`).
- **A devolutiva não entra no prontuário do paciente.**
- Chamada de vídeo: fora do MVP (pode ser link externo no começo).

### 4.4 Horas de supervisão
- Cada sessão concluída registra os minutos para cada supervisionando presente.
- O supervisionando gera uma declaração de horas em PDF, assinada pelo supervisor. Provedor de assinatura digital: [A DEFINIR].

### 4.5 Estágio (tela `Estagio.dc.html`)
- O registro do estagiário nasce com status `pendente`.
- O supervisor comenta (o comentário pode ficar ancorado num trecho), pede ajuste ou valida e assina.
- Status: `pendente` → `ajuste_pedido` → `pendente` (nova versão) → `validado`.
- Só registros validados entram no prontuário. Toda versão fica guardada.

## 5. Anonimização

**v1 (determinística, sem API externa; pode rodar no navegador ou numa Edge Function):**
- Substitui o nome do paciente (nome completo, primeiro nome e apelidos cadastrados) por "A paciente" / "O paciente". Rótulo do caso: inicial + idade ("Paciente A., 34 anos").
- Remove CPF, RG, telefones, e-mails, CEP e padrões de endereço (regex).
- Remove nomes cadastrados de familiares e contatos do paciente (`patient_contacts`).
- O psicólogo pode marcar qualquer trecho para remover.
- Datas `dd/mm/aaaa` viram `mês/aaaa` quando a opção estiver ligada.
- Mostra a lista do que foi trocado. Sempre exige revisão antes de enviar.

**v2 (futuro):** detectar nomes próprios e locais não cadastrados com um modelo de linguagem. Só depois de decidir onde esses dados são processados (LGPD).

## 6. Modelo de dados (proposta inicial)

| Tabela | Campos principais |
|---|---|
| `profiles` | `id` (= auth.users.id), `full_name`, `crp_region`, `crp_number`, `plan` (`supervisor_free` \| `essencial`) |
| `patients` | `id`, `owner_id`, `full_name`, `nicknames[]`, `birth_date`, `phone`, `email`, `archived_at` (paciente não é apagado: é arquivado; sem CPF até a Fase 5) |
| `patient_contacts` | `id`, `patient_id`, `name`, `relation` |
| `appointments` | `id`, `owner_id`, `patient_id`, `series_id` (sessões semanais), `starts_at`, `ends_at`, `modality`, `location`, `status` (`agendada` \| `realizada` \| `faltou` \| `cancelada`) |
| `clinical_records` | `id`, `owner_id`, `patient_id`, `appointment_id`, `author_id`, `session_date`, `body`, `status` (`final` \| `pendente` \| `ajuste_pedido` \| `validado`), `created_at`, `updated_by`, `deleted_at`, `deleted_by`, `deleted_reason` |
| `clinical_record_versions` | `id`, `record_id`, `body`, `created_at`, `created_by` |
| `supervisor_profiles` | `id` (= profiles.id), `offers_supervision`, `accepting_new`, `bio`, `education`, `approaches[]`, `areas[]`, `years_experience`, `modalities[]`, `formats[]`, `city`, `state`, `price_info` |
| `supervision_requests` | `id`, `requester_id`, `supervisor_id`, `message`, `status` (`pendente` \| `aceita` \| `recusada` \| `cancelada`), `responded_at`, `link_id` |
| `supervision_invites` | `id`, `token`, `inviter_id`, `inviter_role` (`supervisor` \| `supervisionando`), `expires_at`, `used_at`, `used_by`, `link_id` |
| `supervision_links` | `id`, `supervisor_id`, `supervisee_id`, `format`, `origin` (`solicitacao` \| `convite`), `status` (`ativo` \| `encerrado`), `ended_at`, `ended_by` (grupo, frequência e modalidade entram na Fase 2b) |
| `supervision_groups` | `id`, `supervisor_id`, `name` |
| `supervision_meetings` | `id`, `link_id` ou `group_id`, `scheduled_at`, `duration_min`, `status` |
| `supervision_cases` | `id`, `supervisee_id`, `link_id`, `meeting_id`, `case_label`, `approach`, `question`, `status` |
| `supervision_case_sources` | `case_id`, `patient_id`, `record_ids[]` — **só o supervisionando acessa** |
| `supervision_case_excerpts` | `id`, `case_id`, `period_label`, `anonymized_body` — snapshot |
| `supervision_feedback` | `id`, `case_id`, `author_id`, `observed`, `paths`, `sent_at` |
| `supervision_feedback_tasks` | `id`, `feedback_id`, `text`, `done_at` |
| `supervision_hours` | `id`, `meeting_id`, `supervisee_id`, `minutes`, `registered_by` |
| `internship_groups` / `internship_members` | grupo de estágio do supervisor e estagiários |
| `record_reviews` | `id`, `record_id`, `reviewer_id`, `status`, `comment`, `anchor_text`, `created_at` |
| `audit_log` | `actor_id`, `action`, `entity`, `entity_id`, `at` — compartilhamentos e acessos a prontuário |

**Acesso (RLS), em resumo:**
- `patients`, `clinical_records`, `supervision_case_sources`: só o dono (`owner_id` / `supervisee_id` = `auth.uid()`).
- `supervision_cases`, `supervision_case_excerpts`, `supervision_feedback`, `supervision_feedback_tasks`: o supervisionando do caso e o supervisor do vínculo.
- Estágio: o supervisor do grupo vê os registros dos estagiários do grupo (completos, porque é o responsável técnico). A modelagem de clínica-escola (paciente pertence ao serviço, não ao estagiário) fica para a fase 4 e deve ser decidida com o Henrique.

## 7. Telas

| Referência | Rota sugerida |
|---|---|
| `Main.dc.html` — Início do psicólogo | `/inicio` |
| `Supervisao.dc.html` — Minha supervisão | `/supervisao` |
| `LevarCaso.dc.html` — Levar caso para supervisão | `/pacientes/:id/supervisao/novo` |
| `Supervisor.dc.html` — Painel do supervisor | `/supervisor` |
| `Sessao.dc.html` — Sala de supervisão | `/supervisor/sala/:meetingId` |
| `Estagio.dc.html` — Validação de registros do estágio | `/supervisor/estagio` |

Ainda sem tela desenhada: login e cadastro, aceite de convite, agenda, lista e ficha de paciente, prontuário, financeiro, configurações. Seguir o mesmo visual.

## 8. Roadmap

- **Fase 0 — Base:** Vite + React + TS + Tailwind; Supabase local (CLI); autenticação; layout com menu lateral; tokens de design.
- **Fase 1 — Consultório mínimo:** pacientes, agenda simples, prontuário com versões e soft delete.
- **Fase 2a — Rede de supervisores:** perfil de supervisor, busca, pedido de supervisão, convite por link, vínculos.
- **Fase 2b — Supervisão:** levar caso (anonimização v1), pauta, sala e devolutiva, horas, grupos.
- **Fase 3 — Planos:** plano Supervisor grátis, permissões por plano, cadastro a partir do convite.
- **Fase 4 — Estágio:** **suspensa** (decisão do Henrique em 16/11/2026). Exige contrato de estágio registrado nos órgãos competentes e/ou convênio com cursos de psicologia; volta a ser discutida quando houver esse caminho.
- **Fase 5 — Extras:** financeiro, recibos (Receita Saúde / NFS-e), declarações em PDF, assinatura digital.
- **Fase 6 — Fiscal (proposta, depois da Fase 5):** para pessoa física (carnê-leão, DARF) e CNPJ no Simples Nacional (DAS, Fator R). Incluída nos planos Essencial e Profissional. Integrações possíveis: Integra Contador (SERPRO/Receita) para PGDAS-D e DAS; API da NFS-e Nacional (obrigatória para ME/EPP do Simples desde 01/11/2026).
  - **Decisão do Henrique (16/11/2026): rede de contadores (opção 1) com login separado (jeito A).** A Tríade não presta serviço contábil: oferece a ferramenta e o encontro. A responsabilidade técnica é do contador escolhido.
  - **Conta de contador:** entrada e cadastro próprios (`/contador/entrar`, depois talvez `contador.triade.com.br`), com CRC obrigatório e verificação em duas etapas. O tipo de conta (`psicologo` ou `contador`) é gravado no cadastro e o navegador não consegue mudar. Mesmo banco, separação garantida pela RLS e testada. Um e-mail = uma conta (quem for as duas coisas usa dois e-mails).
  - **O contador nunca vê** pacientes, agenda, prontuário nem supervisão. Vê só o que cada psicólogo liberar, por escopo e revogável: totais do mês (padrão), notas emitidas, recibos detalhados (nome e CPF do pagador, só se autorizado) e livro-caixa. Todo acesso entra na auditoria; encerrar o vínculo corta o acesso na hora.
  - **O psicólogo nunca vê** a carteira do contador nem dados de outros clientes; vê só o perfil público do contador e o que ele enviou (guias com vencimento, pendências).
  - **Fluxo:** perfil do contador (CRC, especialidades, UF/atende o país, faixa de preço informativa) → busca → pedido → aceite → psicólogo libera escopos → contador trabalha no painel (faturamento, Fator R, exportação para o sistema contábil dele) e envia DAS/DARF e pendências → aviso ao psicólogo.
  - **Dinheiro:** o valor é combinado entre psicólogo e contador, fora da plataforma. A Tríade **não fica com porcentagem dos honorários** (o código de ética do CFC veda agenciador remunerado por participação nos honorários); receita pelos planos e, talvez, mensalidade fixa do contador. Validar com advogado e CRC-PR antes de lançar.
  - **Etapas:** 6a assistente fiscal para pessoa física (carnê-leão e DARF, sem contador); 6b rede e conta de contador; 6c painel do contador (escopos, exportação, guias, pendências); 6d opcional: cobrança entre os dois pelo app, sempre por valor fixo.
  - A opção 3 (contabilidade própria da Tríade) fica para depois; se vier, entra na rede como mais um contador.
  - **Feito em 16/11/2026 (modo de teste):** 6b e 6c, mais o financeiro mínimo da 5a (valor e pagamento das sessões, valor padrão, CPF e responsável financeiro do paciente, despesas, regime e pró-labore). Rotas do contador: `/contador/entrar`, `/contador/cadastro`, `/contador/seguranca`, `/contador`, `/contador/clientes/:id`, `/contador/perfil`. Do psicólogo: `/financeiro` e `/meu-contador`. O nome do responsável financeiro também é removido na anonimização da supervisão.

## 9. Regras e referências

- **Res. CFP 01/2009:** registro documental obrigatório; guarda mínima de 5 anos; o usuário tem acesso integral ao que foi registrado no prontuário (prever exportação para o paciente); o supervisor deve solicitar do estagiário o registro das atividades.
- **Prontuário eletrônico:** permitido desde que atenda à LGPD, ao Código de Ética (Res. CFP 10/2005) e à Res. CFP 01/2009.
- **Res. CFP 5/2025:** normas de orientação, supervisão e coordenação de estágio.
- **Código de Ética, arts. 6º e 12:** ao compartilhar informações técnicas, só o necessário.
- **LGPD:** dado de saúde é dado pessoal sensível. Hospedar o banco no Brasil (Supabase, região São Paulo) simplifica. Termos de uso e política de privacidade antes de abrir para usuários reais.
- **CFP sobre IA:** o profissional responde integralmente pelo uso de ferramentas de IA.
