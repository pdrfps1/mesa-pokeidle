# Módulos do board: estado atual, motor e proposta

Este documento descreve o que existe hoje para o board de módulos do PokeIdle Automation, o que o motor puro já faz, e o que ainda é proposta. Nenhuma tela mudou nesta entrega.

## 1. Estado atual e limite desta entrega

- A disposição **Livre** e a **Espera** (12 ids, incluindo `pokecalc`) continuam como estão. O motor de layout novo (`src/shared/board-layout.js`) existe, tem testes e não está ligado a nenhuma tela.
- Esta entrega cria: o motor puro, os testes, o schema de documentação, um arquivo de exemplo e este documento.
- Não há gaveta, paleta de comandos, dock flutuante, tema Arena aplicado, som, háptico ou virtualização de baías.
- A persistência não existe ainda. O formato futuro seria `cfg.board` dentro de `mesa-config.json`, gravado por `save()`.

## 2. O que o MCP BoardUI faz e o que não faz

O BoardUI é um design system React com Tailwind v4. O servidor MCP instala código-fonte de componentes e de tema no projeto: `list_components`, `get_component`, `get_usage_examples`, `get_theme`, `init_boardui`, `install_components`, `install_rules`.

Ele **não** declara, registra, renderiza, move, redimensiona nem persiste widgets de board. Não há nada de grade de módulos no catálogo: o que existe são componentes avulsos e templates de página inteira.

Itens Pro exigem licença, e nós não temos licença. Ficam fora da matriz como "a confirmar".

Quem é dono do schema e da persistência é o **app** (PokeIdle Automation): o formato é `cfg.board` no `mesa-config.json`, validado e normalizado por `board-layout.js`. A ligação com o app é trabalho futuro.

## 3. Matriz de componentes

Os tipos são os de `TYPES` no motor. Limites em colunas (de 12) × linhas (de 10 px). Limites marcados **provisório** são escolhas iniciais, a rever quando a tela existir. Os da baía vêm do catálogo (`MESA_CATALOG.box`).

Teto geral: **32 módulos por perfil** e **8 perfis**.

| Módulo | Tipo | Quantidade | Vivo? | Limites w×h | Micro | Padrão | Expandido | Componente BoardUI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baía | `bay` | 4 (`bay-0`..`bay-3`) | sim | 3–12 × 12–80 (catálogo) | só o nome e o status | jogo completo, controles de caça | jogo com painel de XP e histórico | sem equivalente; a baía é o webview do Mesa |
| KPI / XP / streak | `kpi` | até 24 | não | 3–12 × 6–40 (provisório) | valor principal | valor, delta e anel | série curta e comparação | `stat-cards` (candidato, não instalado) |
| Capturas | `captures` | 1 | não | 4–12 × 12–80 (provisório) | contagem total | lista recente | tabela completa | `table` (candidato, não instalado) |
| Processos | `procs` | 1 | não | 4–12 × 12–80 (provisório) | contagem ativa | lista de processos | tabela com filtro | `table` (candidato, não instalado) |
| Twitch (geral) | `twitch` | 1 | não | 4–12 × 12–80 (provisório) | estado da conexão | resumo das lives | lista das lives | a confirmar |
| Twitch por baía | `twitch-bay` | 4 (`twitch-bay-0`..`3`) | não | 3–12 × 8–60 (provisório) | ícone de estado | estado e bônus da baía | detalhe da live | a confirmar |
| Calculadora de status | `pokecalc` | 1 | não | 4–12 × 12–80 (provisório) | a definir | a definir | a definir | a confirmar (nenhum item de catálogo) |
| Paleta de comandos | (camada) | n/a | não | fora da grade | fora da grade | fora da grade | fora da grade | `command-palette` (candidato, não instalado) |
| Dock flutuante | (camada) | n/a | não | fora da grade | fora da grade | fora da grade | fora da grade | a confirmar: não existe item no catálogo |
| Gaveta de módulos | (camada) | n/a | não | fora da grade | fora da grade | fora da grade | fora da grade | `drawer` (candidato, não instalado) |

Já instalados em `components/`, conferidos nesta revisão: `components/base` tem `avatar`, `buttons`, `modal`, `notification`, `spinner` e `toast`; `components/foundations` tem `direction` e `scroll-fade`. Os 8 existem.

Notas: "Micro", "Padrão" e "Expandido" são os modos de `sizeMode`. Micro vale para largura até 3 colunas ou altura até 10 linhas. Expandido vale para largura de 8 colunas ou mais e altura de 40 linhas ou mais.

## 4. Regras de grade

- **12 colunas**, linha de **10 px**, gap horizontal de **8 px**. A altura de um módulo é `h × 10` px.
- **Snap**: `snap` converte um retângulo em px para unidades de grade. Usa a largura do contêiner. Campos que não são número (inclusive string que não vira número) devolvem `null`.
- **Colisão**: dois módulos visíveis não se sobrepõem. Ocultos não ocupam espaço.
- **Empurrar**: `move` e `resize` empurram os que colidem para baixo, e depois compactam para cima, em ordem de (y, x).
- **Locked**: módulo travado (`locked: true`) **não se move, não se redimensiona, não é removido nem ocultado**. Isso vale também para baía. As exceções estão logo abaixo, nesta seção: `resetProfile` preserva os travados, e `normalize` e `compact` só mexem num travado quando a entrada é inválida. Nada se move para dentro dele: se um movimento bater num locked, a operação é recusada. Qualquer uma dessas operações sobre um locked devolve o próprio estado. `add` também não revela nem move um módulo oculto e travado: se ele for o único candidato do tipo, `add` recusa e devolve o próprio estado.
- **Entrada de compactação**: `compact` passa cada item por `sanitizeModule`, então `y` é limitado a 0..10000 e `w`/`h` pelo tipo. Item com tipo ou id inválido sai da lista.
- **Estado inválido**: toda operação (`move`, `resize`, `add`, `remove`, `saveProfile`, `switchProfile`, `resetProfile`, `deleteProfile`) recebe o estado e, se ele não for válido, passa por `normalize` antes. A saída é sempre um estado válido.
- **Cópia**: operação que muda o estado devolve cópia profunda; nenhum objeto da saída é compartilhado com a entrada. Operação recusada num estado válido devolve a própria referência.
- **Chaves extras**: `validate` recusa chave fora do formato (estado, perfil ou módulo). `normalize` descarta essas chaves e devolve só as conhecidas.
- **Travado sobrevive ao reset**: `resetProfile` mantém todo módulo travado do perfil exatamente como está (id, tipo, x, y, w, h, visible, collapsed, locked e design), visível ou oculto. O restante volta ao padrão: as 4 baías em 2x2, nas posições padrão, exceto as que já existem travadas (não são duplicadas). Um padrão destravado que colide com um travado é empurrado para baixo; o travado fica fixo. Destravados fora do padrão (ex.: kpi, captures, twitch) somem. O nome e os outros perfis não mudam. Perfil inexistente é recusado (mesma referência).
- **Exceção: normalize move travado só em entrada inválida.** Dois casos: (1) travado fora da grade (y maior que 10000, x fora de 0..12-w), que é limitado pelo tipo; (2) dois travados sobrepostos na entrada, onde o primeiro na ordem de entrada fica e o segundo é empurrado (continua travado). Com entrada válida, `normalize` e `compact` não movem nenhum travado. Um destravado sobreposto a um travado é empurrado, nunca o travado.
- **Compactação e travado**: `compact` aplica o clamp de `sanitizeModule` antes de compactar. Um travado com `y` fora da grade vai para o limite (10000). Um travado válido não muda.
- **Teclado**: setas movem o módulo focado. Shift com setas redimensiona. Esses atalhos não estão implementados.
- **Alternativa ao arrasto (WCAG 2.2, Dragging Movements)**: todo arrasto precisa de um equivalente sem arrasto, por botões ou pelo teclado. Isso fica para a tela.

## 5. Breakpoints

- **A partir de 1100 px**: 12 colunas, com o layout salvo.
- **De 700 a 1099 px**: 6 colunas, pela projeção `project`. Não grava nada.
- **Abaixo de 700 px**: 1 coluna, empilhada por (y, x). O comportamento segue o de `baySplitNarrow` (`src/renderer/bay-split.js:5`).

## 6. Tokens "Arena": proposta de tema opcional, NÃO aplicada

Nada disto está no CSS. É uma proposta para discussão.

**Base**
- Chão `#0b0d14`, painel `#121624`.
- Tile translúcido `rgba(22,27,44,0.72)`, que sobre o chão dá `#131725`.
- Borda `rgba(148,163,255,0.14)`.
- Texto `#eef1ff`, texto 2 `#a9b0cc`.

**Acentos**, cada um com papel fixo para não virar arco-íris:
- Ciano `#22e3ff`: foco e seleção.
- Roxo `#a77bff`: level-up e ação principal.
- Magenta `#ff4fd8`: streak.
- Dourado `#ffc94a`: XP e recompensa.
- Lima `#b6ff3b`: caçando.

**Estados**: caçando `#b6ff3b`, parada `#ff5c7a`, medindo em anel neutro, sem sessão com texto 2. Nunca só a cor: a forma da luz de estado acompanha.

**Glow**: `0 0 0 1px <acento>/40%, 0 0 16px <acento>/35%`. Texto sobre acento: `#0b0d14`.

**Contraste (WCAG 2.x, calculado por script)**

| Par | Razão | Nível |
| --- | --- | --- |
| texto `#eef1ff` / chão | 17,25 | AAA |
| texto `#eef1ff` / painel | 16,01 | AAA |
| texto `#eef1ff` / tile | 15,86 | AAA |
| texto 2 `#a9b0cc` / chão | 9,03 | AAA |
| texto 2 `#a9b0cc` / painel | 8,38 | AAA |
| texto 2 `#a9b0cc` / tile | 8,30 | AAA |
| **sem sessão: texto a 40% / tile** | **3,52** | **falha AA** |
| estado caçando `#b6ff3b` / tile | 14,75 | AAA |
| estado parada `#ff5c7a` / tile | 6,00 | AA |
| ciano / chão | 12,48 | AAA |
| roxo / chão | 6,40 | AA |
| magenta / chão | 6,80 | AA |
| dourado / chão | 12,67 | AAA |
| lima / chão | 16,04 | AAA |
| ciano / painel (anel ou borda, ≥ 3:1) | 11,58 | AAA |
| roxo / painel (anel ou borda, ≥ 3:1) | 5,94 | AA |
| magenta / painel (anel ou borda, ≥ 3:1) | 6,31 | AA |
| dourado / painel (anel ou borda, ≥ 3:1) | 11,75 | AAA |
| lima / painel (anel ou borda, ≥ 3:1) | 14,89 | AAA |
| texto `#0b0d14` sobre cada acento (ciano, roxo, magenta, dourado, lima) | 12,48; 6,40; 6,80; 12,67; 16,04 | AA ou melhor |
| borda `rgba(148,163,255,0.14)` / chão | 1,23 | não é texto; não serve de contorno de controle |

**Ajuste proposto.** O "sem sessão a 40%" falha: 3,52:1. Para passar em AA com texto a alpha seria preciso ao menos 50% (4,80:1). A proposta é outra: usar **texto 2 `#a9b0cc` sólido** (8,30:1), e não alpha. A borda de 0,14 é separador decorativo e não contorno de controle. Para ter 3:1 como contorno seria preciso alpha acima de 0,5, e mesmo assim 0,5 dá só 2,87:1. Controle que precisa de contorno usa acento ou texto 2.

**Nomes semânticos** no estilo BoardUI: `bg-background-*`, `text-text-*`, `border-border-*`. Nenhum hex dentro de componente.

**Tipografia fluida** por container query (`cqi`) dentro do tile, não por viewport. Fonte Segoe UI Variable com `tabular-nums` nos números. Orbitron e Google Fonts ficam **rejeitados**: o app Electron roda offline, e Orbitron prejudica a leitura de números pequenos.

## 7. Gamificação e animação

- Anéis de progresso, barra de XP, contador de streak, badge de level-up e recompensa de estado.
- Só `transform` e `opacity`. Duração de 150 a 300 ms. Entrada com stagger de 300 a 450 ms.
- `prefers-reduced-motion` desliga o que não for essencial.
- Glow só em foco ou ativo, nunca em todos os módulos.
- Som e háptico: só como gatilhos descritos aqui, sem implementação.

## 8. Desempenho

- Webview de baía nunca desmonta, para não perder a sessão.
- `content-visibility` só em módulos não vivos.
- Arrasto e redimensionamento usam `transform` durante o gesto e gravam no `pointerup`, como `bay-size.js` já faz.
- Auditoria: contagem de nós DOM, re-render, e medição com o painel de desempenho existente (`src/renderer/perf.js`, `src/main/perf-sampler.js`).
- **Protocolo A/B do blur**: 4 baías caçando, cerca de 20 s por situação. A sem blur, B com blur nos painéis. Se GPU ou renderer subirem mais de 10 pontos percentuais em B, o blur fica desligado nos tiles.
- Vidro só em camadas transitórias (paleta, gaveta, dock), fora da área das baías.

Todos os números de desempenho deste documento estão **NÃO MEDIDOS**.

Referência visual externa: designeer.xyz, **referência não conferida**.

## 9. Schema e ciclo de vida

Exemplo mínimo de estado (o arquivo completo está em `docs/exemplos/board-layout.exemplo.json`):

```json
{
  "schemaVersion": 1,
  "activeProfile": "padrao",
  "profiles": {
    "padrao": {
      "name": "Padrão",
      "modules": [
        { "id": "bay-0", "type": "bay", "x": 0, "y": 0, "w": 6, "h": 34,
          "visible": true, "collapsed": false, "locked": false,
          "design": { "accent": null, "glow": false } }
      ]
    }
  }
}
```

**Quem valida é o motor.** `docs/board-layout.schema.json` documenta o formato e amarra tipo e id (inclusive `captures`, `procs`, `twitch` e `pokecalc`, cada um com id fixo), e exige que `name` tenha um caractere que não seja espaço. Mas o JSON Schema não expressa `x + w <= 12`, sobreposição nem baías obrigatórias. Essas regras só `validate` do motor checa.

Fluxo: criar (`add`) → mover (`move`) → redimensionar (`resize`) → salvar (`saveProfile`) → reiniciar (`normalize` do que estiver gravado) → trocar perfil (`switchProfile`).

**Migração do formato antigo (`fromLegacy`).** Lê `cfg.bays[i].box` (span vira `w`, altura em px vira `h/10`, `h` 0 vira `defH`, span inválido vira 6) e `cfg.standby`. Não perde nenhum dos 12 ids da Espera:

- Viram módulo: `bay-0`..`bay-3` (de `cfg.bays`), `captures`, `procs`, `twitch`, `twitch-bay-0`..`3` e `pokecalc` (de `cfg.standby`). Total: 12.
- `hidden` vira `visible`. Sem o campo `hidden`, a Twitch e o `pokecalc` nascem ocultos, como na Espera.
- `span` 2 vira largura de 12 colunas. Qualquer outro valor vira a largura padrão do tipo.
- A ordem da Espera vira a ordem de colocação na grade.
- Ids desconhecidos em `cfg.standby.order` são descartados.
- `kpi` não existe na Espera, então não entra na migração.

## 10. Conflito com o MASTER "Vigília" e decisão pendente

O `design-system/mesa/MASTER.md` (na raiz do repositório, fora de `dashboard/`) define: um acento só, sem degradê, sem neon, sem vidro. O `app.css` força `backdrop-filter: none !important` em `.mesa-panel`.

A proposta Arena usa cinco acentos, glow e vidro em camadas transitórias. Isso contradiz o MASTER.

**Decisão pendente do usuário**: manter o MASTER como está e descartar a proposta Arena, ou atualizar o MASTER para aceitar a proposta. Nada é aplicado até essa decisão.

## 11. Fora do escopo

- Reescrever o app.
- Ligar o motor à Mesa ou à Espera.
- Implementar gaveta, marketplace, paleta de comandos ou dock.
- Aplicar o tema Arena.
- Som e háptico.
- Virtualizar baías.

## 12. Marca, build e atualizador (entrega 0.4.0)

Esta entrega não mexeu no board. Para o que mudou na distribuição, veja `projeto.md`, seção «Marca, nomes e build»:

- Assets: `build/` (instalador e ícone do executável) e `src/assets/brand/` (ícone e logo da tela).
- Dois alvos de `npm run dist`: `PokeIdle-Automation-Setup.exe` e `PokeIdle-Automation.exe`, mais o alias `Mesa.exe`.
- Nome em `src/shared/brand.js`, conferido com o `package.json` pelo teste.
- Atualizador em dois modos (instalado e portable). Versões até 0.3.2 só procuram `Mesa.exe` na release; por isso a release precisa publicar os três arquivos.
