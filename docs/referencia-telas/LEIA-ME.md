# Telas de referência

Protótipo das 6 telas principais, exportado do editor de design. Cada arquivo `.dc.html` é uma tela.

| Arquivo | Tela |
|---|---|
| `Main.dc.html` | 1. Início do psicólogo |
| `Supervisao.dc.html` | 2. Minha supervisão (lado do supervisionando) |
| `LevarCaso.dc.html` | 3. Levar caso para supervisão (anonimização lado a lado) |
| `Supervisor.dc.html` | 4. Painel do supervisor (plano grátis) |
| `Sessao.dc.html` | 5. Sala de supervisão (devolutiva) |
| `Estagio.dc.html` | 6. Validação de registros do estágio |

## Como usar

- **Use:** a estrutura do HTML, os textos, a hierarquia, os estilos inline (cores, tamanhos, espaçamentos) e a lógica de estado no `<script>` como descrição do comportamento esperado.
- **Não use:** `support.js`, `<x-dc>`, `<helmet>`, `DCLogic`, `<sc-for>`, `<sc-if>` e os `{{...}}`. São do editor e não funcionam fora dele. Reescreva como componentes React com Tailwind, usando os tokens de `docs/design.md`.
- Os nomes, casos e números nas telas são fictícios.
