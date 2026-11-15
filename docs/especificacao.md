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
| Supervisor (grátis) | Quem só supervisiona | Pauta, sala de supervisão, devolutivas, registro de horas e declarações, validação de estágio |
| Essencial (pago) | Psicólogos | Consultório completo (agenda, pacientes, prontuário, financeiro) + supervisão, como supervisionando e como supervisor |

- O supervisor escolhe se assina ou não. Sem assinar, as áreas de consultório aparecem bloqueadas com convite para o Essencial (ver `docs/referencia-telas/Supervisor.dc.html`).
- Implementar como permissões por plano: campo `profiles.plan` e uma função `has_feature(feature)` usada no front e nas regras de segurança do Firestore.
- Preços: [A DEFINIR].

## 4. Fluxos

### 4.1 Vínculo de supervisão
1. O psicólogo convida o supervisor por e-mail, ou o supervisor convida o supervisionando.
2. Quem não tem conta faz cadastro no plano Supervisor (grátis) a partir do convite.
3. Ao aceitar, nasce um `supervision_link` com formato (individual ou grupo), frequência, modalidade (online/presencial) e valor opcional.

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

**v1 (determinística, sem API externa; pode rodar no navegador ou numa Cloud Function):**
- Substitui o nome do paciente (nome completo, primeiro nome e apelidos cadastrados) por "A paciente" / "O paciente". Rótulo do caso: inicial + idade ("Paciente A., 34 anos").
- Remove CPF, RG, telefones, e-mails, CEP e padrões de endereço (regex).
- Remove nomes cadastrados de familiares e contatos do paciente (`patient_contacts`).
- O psicólogo pode marcar qualquer trecho para remover.
- Datas `dd/mm/aaaa` viram `mês/aaaa` quando a opção estiver ligada.
- Mostra a lista do que foi trocado. Sempre exige revisão antes de enviar.

**v2 (futuro):** detectar nomes próprios e locais não cadastrados com um modelo de linguagem. Só depois de decidir onde esses dados são processados (LGPD).

## 6. Modelo de dados (proposta inicial)

Cada linha abaixo vira uma coleção do Firestore (ou subcoleção, quando fizer sentido na fase). Os nomes e campos continuam valendo.

| Coleção | Campos principais |
|---|---|
| `profiles` | `id` (= uid do Firebase Authentication), `full_name`, `crp_region`, `crp_number`, `plan` (`supervisor_free` \| `essencial`) |
| `patients` | `id`, `owner_id`, `full_name`, `nicknames[]`, `birth_date`, contatos, `deleted_at` |
| `patient_contacts` | `id`, `patient_id`, `name`, `relation` |
| `appointments` | `id`, `owner_id`, `patient_id`, `starts_at`, `ends_at`, `modality`, `room`, `status` |
| `clinical_records` | `id`, `owner_id`, `patient_id`, `appointment_id`, `author_id`, `body`, `status` (`final` \| `pendente` \| `ajuste_pedido` \| `validado`), `created_at`, `deleted_at` |
| `clinical_record_versions` | `id`, `record_id`, `body`, `created_at`, `created_by` |
| `supervision_links` | `id`, `supervisor_id`, `supervisee_id`, `group_id`, `format`, `frequency`, `modality`, `status` (`convidado` \| `ativo` \| `encerrado`) |
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

**Acesso (regras de segurança do Firestore), em resumo:**
- `patients`, `clinical_records`, `supervision_case_sources`: só o dono (`owner_id` / `supervisee_id` = `request.auth.uid`).
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

- **Fase 0 — Base:** Vite + React + TS + Tailwind; Firebase (Authentication + Firestore) com emuladores locais; autenticação; layout com menu lateral; tokens de design.
- **Fase 1 — Consultório mínimo:** pacientes, agenda simples, prontuário com versões e soft delete.
- **Fase 2 — Supervisão:** convites e vínculos, levar caso (anonimização v1), pauta, sala e devolutiva, horas.
- **Fase 3 — Planos:** plano Supervisor grátis, permissões por plano, cadastro a partir do convite.
- **Fase 4 — Estágio:** grupos, fila de validação, comentários, assinatura.
- **Fase 5 — Extras:** financeiro, recibos (Receita Saúde / NFS-e), declarações em PDF, assinatura digital.

## 9. Regras e referências

- **Res. CFP 01/2009:** registro documental obrigatório; guarda mínima de 5 anos; o usuário tem acesso integral ao que foi registrado no prontuário (prever exportação para o paciente); o supervisor deve solicitar do estagiário o registro das atividades.
- **Prontuário eletrônico:** permitido desde que atenda à LGPD, ao Código de Ética (Res. CFP 10/2005) e à Res. CFP 01/2009.
- **Res. CFP 5/2025:** normas de orientação, supervisão e coordenação de estágio.
- **Código de Ética, arts. 6º e 12:** ao compartilhar informações técnicas, só o necessário.
- **LGPD:** dado de saúde é dado pessoal sensível. Hospedar o banco no Brasil (Firestore, região São Paulo) simplifica. O Firebase Authentication não permite escolher a região: e-mail e senha dos usuários ficam fora do país, então nenhum dado clínico vai para o login (e isso entra na política de privacidade). Termos de uso e política de privacidade antes de abrir para usuários reais.
- **CFP sobre IA:** o profissional responde integralmente pelo uso de ferramentas de IA.
