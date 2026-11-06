# Alterações

## 2026-11-06 — Patch «Vigília» · bônus Twitch resgata quando acaba, sem limiar de minutos

> A Mesa deixa de esperar um limiar de 2, 5, 10 ou 15 minutos. Um tipo de bônus da Twitch é resgatado quando o prazo dele passa no relógio do servidor e o jogo mandou uma leitura válida. Sempre que um acaba, a Mesa resgata outro. Sem leitura do prazo, o resgate fica parado.

### Destaques do patch
- **Sem limiar:** o controle «Resgatar quando faltar» saiu do painel.
- **Resgate ao acabar:** cada tipo é resgatado com o prazo já passado, e não antes.
- **Sem leitura, sem resgate:** o painel diz «O jogo ainda não mandou o prazo dos bônus. Resgate parado.»

### Bônus Twitch
*O bônus é resgatado quando acaba, e um bônus sem leitura válida não vira mais zero.*

**Por quê.** O usuário pediu: «sempre que acabar um ele resgata outro». Com o limiar, a Mesa resgatava antes do fim do bônus, e um prazo ausente ou inválido contava como zero, ou seja, como prazo passado.

**Antes → depois**
- **Quando resgatar:** antes, com menos de 2, 5, 10 ou 15 minutos restantes (padrão 5). Depois, só com o bônus acabado.
- **Bônus sem leitura:** antes, chave ausente ou inválida virava 0. Depois, chave ausente mantém o valor anterior; valor inválido descarta o bônus daquele frame; objeto só com chaves desconhecidas é recusado; chave extra ao lado de uma conhecida é aceita. Só vale como leitura o frame completo, onde chave ausente quer dizer sem bônus, ou o frame que traz os três tipos; frame parcial atualiza o prazo, mas não prova que outro tipo acabou.
- **Sem leitura válida:** `escolherResgate` devolve `sem-leitura` e nada é resgatado.
- **Painel, Recompensas:** o texto agora diz «Cada uma vale 1 hora de +15%. A Mesa resgata de novo quando a anterior acabar.».
- **Painel, sem-confirmacao:** a frase diz que reiniciar a Mesa libera, mas pode gerar um novo resgate.

**NOVO**
- situação `sem-leitura` e a frase «O jogo ainda não mandou o prazo dos bônus. Resgate parado.».
- regra: um tipo só resgata com o prazo passado no relógio do servidor e leitura válida do jogo.

**REMOVIDO**
- controle «Resgatar quando faltar» no painel.
- `limiarMin` não é mais normalizado: qualquer valor passa sem lançar e some no próximo salvamento (`catalog.normalize`).

**NÃO MUDOU**
- o caminho do clique, as travas de `redeem-*` e a trava de `sem-confirmacao` por tipo.

### Arquivos de produto
- `dashboard/src/main/twitch/points.js`: `escolherResgate` (prazo passado, `sem-leitura`, `sem-confirmacao` por tipo).
- `dashboard/src/main/twitch/controller.js`: situação `sem-leitura` e `bonusLido`.
- `dashboard/src/shared/live-catalog.js`: leitura do `bonus` (chave ausente mantém, valor inválido descarta, `bonusLido`).
- `dashboard/src/shared/catalog.js`: `limiarMin` deixa de ser normalizado.
- `dashboard/src/renderer/live-bonus.js`: frase `sem-leitura`, texto de Recompensas, frase de `sem-confirmacao` e controle removido.

### Testes
- `npm test` na árvore deste commit: **579** passaram, 0 falhas.
- `src/main/twitch/erros-log.test.js` tem **10** testes que não entram no `npm test`.
- Cobrem a regra nova: `points.test.js`, `controller.test.js`, `catalog.test.js` (`limiarMin` não existe mais), `live-catalog.test.js` e `live-bonus.test.js` (controle removido, frase de `sem-leitura`).

### Não confirmado
- **Clique real pelo texto, 2026-11-06:** o usuário relatou que o resgate real funcionou uma vez, depois do Redeem por texto. O log não confirma, porque só grava falhas; a evidência é o relato do usuário. Esta entrada corrige a nota da entrada de baixo, que dizia que o clique real ainda não tinha acontecido.
- **Resgate no fim real de um bônus:** ainda não testado.
- **Formato real de `bonus` no jogo:** só há fixtures. Se o jogo mandar `bonus: null`, a baía fica em `sem-leitura`.
- **`{}` com bônus anterior:** preserva o prazo antigo.
- **Jogo desconectado sem navegação:** o prazo antigo pode vencer e a Mesa resgatar com o WebSocket caído.
- **Relógio do Windows:** um salto pode antecipar alguns segundos.
- **Janela sem bônus:** estimada, não medida. 5 a 20 s para um tipo; 30 a 60 s para o segundo tipo que acaba junto; até 180 s + 20 s sem falha.

### Limites conhecidos
- Saldo curto alonga a espera sem limite: a conta junta cerca de 320 pontos/h e o XP custa 300/h.
- Trava de `sem-confirmacao` com bônus zerado: aquele tipo fica parado até um reset (troca de conta, automático desligado ou reinício da Mesa).
- Reiniciar a Mesa libera a trava de `sem-confirmacao`, mas pode gerar um novo resgate.
- Desligar e religar o automático também libera a trava, e o mesmo tipo pode ser clicado de novo. É o reset manual, aceito como risco.

### Problemas conhecidos
- `sem-leitura` é espera, não falha: o log só grava falhas, então essa espera não aparece nele.
- `src/main/index.js:510` ainda repassa `limiarMin`, sem efeito.

### Patch note

**Patch «Vigília» · 06/11/2026 · bônus Twitch resgata quando acaba, sem limiar de minutos**

Resumo: a Mesa resgata um bônus da Twitch quando o prazo dele acaba, e não antes. Sem leitura do prazo, o resgate fica parado.

**Bônus Twitch**
- [Ajuste] Quando resgatar. Antes: com menos de 2, 5, 10 ou 15 minutos restantes (padrão 5). Depois: só com o bônus acabado. Sempre que um acaba, a Mesa resgata outro.
- [Correção] Bônus sem leitura. Antes: chave ausente ou inválida virava 0, e isso contava como prazo passado. Depois: chave ausente mantém o último prazo lido, valor inválido descarta a leitura daquele frame, e só frame completo ou com os três tipos vale como leitura.
- [Novo] Resgate parado sem leitura. O painel diz: «O jogo ainda não mandou o prazo dos bônus. Resgate parado.»
- [Ajuste] Cada resgate vale 1 hora de +15%. A Mesa resgata de novo quando a anterior acabar.

**Painel**
- [Removido] Controle «Resgatar quando faltar». A configuração antiga some no próximo salvamento.
- [Ajuste] Frase de `sem-confirmacao`: reiniciar a Mesa libera, mas pode gerar um novo resgate.

**Conhecidos**
- O clique real pelo texto funcionou uma vez, em 06/11/2026, segundo o relato do usuário. O log não confirma. O resgate no fim real de um bônus ainda não foi testado.
- O formato real de `bonus` no jogo só foi conferido por fixtures.
- A janela sem bônus é estimada: 5 a 20 s para um tipo; até 200 s sem falha. Saldo curto alonga sem limite.

## 2026-11-06 — Patch «Vigília» · Redeem da Twitch por texto, com travas e aviso antes do clique

> O resgate passa a achar o Redeem pelo texto quando o seletor dedicado não existe, como na rodada real de 15:34. Só clica se nove travas passarem no mesmo poll e de novo logo antes do clique. Um aviso é gravado antes de cada clique, e um clique sem confirmação não é repetido. O clique real pelo texto ainda não aconteceu.

### Destaques do patch
- **Redeem por texto:** texto exato «Redeem N» ou «Resgatar N», com N igual ao custo, em um único botão visível do centro.
- **Nove travas:** qualquer uma para antes do clique, e cada uma tem diagnóstico próprio.
- **Aviso antes do clique:** gravado nos dois caminhos. Se falhar, a Mesa não clica.
- **Sem gasto duplo:** clique sem confirmação em 180 s vira `sem-confirmacao` e não repete.

### Bônus Twitch
*O resgate acha o Redeem pelo texto quando o seletor dedicado não existe, e não repete um clique que a Twitch não confirmou.*

**Por quê.** Na rodada real de 2026-11-06, às 15:34, a causa anterior foi confirmada: o clique ia num `<p>` fora de botão. O card de 300 abriu o detalhe certo. O Redeem real não tem `data-test-selector`, `data-a-target` nem `aria-label`, e `RequestRewardButton` não existe nessa tela. Por isso o caminho dedicado não achava o botão.

**Exceção autorizada pelo usuário** à regra «só seletores específicos». O Redeem pode ser clicado pelo texto, se estas cinco condições valerem no mesmo poll e de novo logo antes do clique:
1. o centro é o diálogo com `#channel-points-reward-center-header`;
2. o detalhe abriu por uma folha nova do título, com retrato;
3. filtros, cards e botões numéricos da lista estão fora da tela, exceto o botão só com número igual ao saldo lido; qualquer erro na leitura bloqueia;
4. há um único botão com o custo, novo e visível;
5. o texto é exatamente «Redeem N» ou «Resgatar N», com N igual ao custo, sem `data-test-selector` nem `data-a-target`.

Nesse caminho a checagem de formato da descrição não vale: ela gasta pontos reais e depende do texto da Twitch. O caminho do seletor dedicado segue igual.

**NOVO**
- travas `redeem-centro`, `redeem-detalhe`, `redeem-lista`, `redeem-nenhum`, `redeem-varios`, `redeem-velho`, `redeem-oculto`, `redeem-texto` e `redeem-atributo`; todas param com 0 clique.
- aviso de clique antes do clique, nos dois caminhos; se o aviso falhar, não clica. Falha depois do clique é ignorada: vai ao log como `falha-depois-do-clique`, não conta como falha e não pausa a baía.
- clique sem confirmação em 180 s vira `sem-confirmacao` e não repete. Essa espera termina com bônus tardio (`confirmado-tardio`), automático desligado, troca de conta ou reinício do app. Não conta como falha nem pausa a baía.
- diagnóstico `percurso.redeem`, `posClique` e `via` no resultado.
- log: `clicado-texto`, `confirmado`, `sem-confirmacao`, `falha-depois-do-clique` e `confirmado-tardio`.
- painel: «aguardando confirmação» para clique feito e a frase de `sem-confirmacao`.

**NÃO MUDOU**
- seletor dedicado do Redeem, espera de 6 s, `botaoPontos` e a ordem dos passos.
- a guarda antes do clique de `twitch-dom.js` (`dedicado` e `titulo-visivel`) continua valendo.

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: caminho do Redeem por texto, travas `redeem-*`, `posCliqueDiag` e o aviso antes do clique.
- `dashboard/src/main/twitch/points.js`: lista de travas, `limparRedeem`, `limparPosClique` e `limparPercurso`.
- `dashboard/src/main/twitch/controller.js`: aviso, `clicado-texto`, `sem-confirmacao`, `confirmado-tardio`, `falha-depois-do-clique` e o log.
- `dashboard/src/preload/twitch-page.js`: repasse de `via`, `redeem` e `posClique`; a fiação do `aoClicar` fica aqui.
- `dashboard/src/renderer/live-bonus.js`: «aguardando confirmação» e a frase de `sem-confirmacao`.

### Testes
- `npm test` em `dashboard/`: **579** passaram, segundo a contagem conferida pelo tester. Esta documentação não rodou a suíte.
- `src/main/twitch/erros-log.test.js` tem **10** testes que não entram no `npm test`, porque o script não lista o arquivo.
- Os testes usam DOM simulado.
- **Sem teste automatizado:** a fiação do `aoClicar` no preload, a reavaliação síncrona e a exceção isolada na condição 3.

### Não confirmado
- **Clique real pelo texto:** ainda não aconteceu. Nenhum resgate real concluiu por esse caminho.
- **Texto real do botão Redeem:** só se conhece pelo print do usuário, não por teste. Não se sabe se o resgate conclui.
- **Seletor real do Redeem:** o caminho dedicado segue sem confirmação; o Redeem real não tem atributos de seletor.

### Limites conhecidos
- a trava só existe em memória: reiniciar o app libera um novo clique.
- um clique não confirmado vale por tipo e por baía.
- saldo igual ao custo trava em `redeem-varios`.
- saldo abreviado ou ilegível trava em `redeem-lista`.
- ordem «300 Redeem» ou texto extra trava em `redeem-texto`.
- sair da baía antes do aviso de clique chegar é uma janela pequena, sem trava.
- a exceção isolada na condição 3 (filtros e lista) não tem teste automatizado.

### Problemas conhecidos
- Próxima rodada real: repetir na Baía 2 e colar a linha `Diag`, o `percurso.redeem` e o resultado (`clicado-texto`, `confirmado` ou `sem-confirmacao`).

### Patch note

**Patch «Vigília» · 06/11/2026 · Redeem da Twitch por texto, com travas e aviso antes do clique**

Resumo: o resgate acha o Redeem pelo texto quando o seletor dedicado não existe, com nove travas antes do clique. Um aviso é gravado antes de cada clique, e um clique sem confirmação não é repetido. O clique real ainda não aconteceu.

**Resgate**
- [Novo] Redeem por texto. Antes: sem seletor dedicado, o Redeem não era achado. Depois: o botão com «Redeem N» ou «Resgatar N», com N igual ao custo, é clicado se as cinco condições passarem.
- [Novo] Nove travas: `redeem-centro`, `redeem-detalhe`, `redeem-lista`, `redeem-nenhum`, `redeem-varios`, `redeem-velho`, `redeem-oculto`, `redeem-texto` e `redeem-atributo`. Todas param antes do clique.
- [Ajuste] A checagem de formato da descrição não vale no caminho por texto.

**Segurança de pontos**
- [Novo] Aviso antes de cada clique, nos dois caminhos. Antes: sem aviso. Depois: se o aviso falhar, não clica.
- [Novo] Sem gasto duplo. Antes: sem estado para clique sem confirmação. Depois: sem confirmação em 180 s vira `sem-confirmacao` e não repete.
- [Ajuste] Falha depois do clique é ignorada. Não conta como falha e não pausa a baía.

**Diagnóstico**
- [Novo] `percurso.redeem`, `posClique` e `via` no resultado.
- [Novo] Log com `clicado-texto`, `confirmado`, `sem-confirmacao`, `falha-depois-do-clique` e `confirmado-tardio`.

**Painel**
- [Novo] «aguardando confirmação» para clique feito e sem confirmação ainda.
- [Novo] Frase para `sem-confirmacao`: a Twitch não confirmou, e o tipo fica parado até o bônus subir, o automático ser desligado ou a conta trocar.

**Conhecidos**
- Clique real pelo texto ainda não aconteceu. O texto do botão só é conhecido pelo print do usuário; não se sabe se o resgate conclui.
- Trava só em memória: reiniciar libera um novo clique. Um clique não confirmado vale por tipo e por baía.
- Saldo igual ao custo trava em `redeem-varios`; saldo abreviado ou ilegível, em `redeem-lista`; «300 Redeem» ou texto extra, em `redeem-texto`.
- Sair da baía antes do aviso de clique chegar é uma janela pequena sem trava.
- Sem teste automatizado: a fiação do `aoClicar` no preload, a reavaliação síncrona e a exceção isolada na condição 3.

## 2026-11-06 — Patch «Vigília» · item por botão real e guarda antes de cada clique no resgate da Twitch

> O resgate só aceita item por título que seja botão de verdade dentro do centro, com o custo no texto desse botão. Card por custo só casa com texto numérico igual ao custo. Antes de cada clique, a Mesa checa se o botão de confirmação ou o título aparecem fora de lugar. Nada disso foi testado na Twitch real.

### Destaques do patch
- **Item por título exige botão real:** `button` ou `role="button"`, dentro do centro, com o custo no texto depois de tirar o título.
- **Card por custo só com número:** o texto inteiro do botão precisa ser o custo pedido.
- **Guarda antes de cada clique:** card ou item só é clicado se as duas checagens passarem.
- **Diagnóstico de percurso:** o caminho do clique e o que foi recusado vão para o painel e para o log.

### Bônus Twitch
*O resgate só clica em item que é botão do centro e que mostra o custo pedido.*

**Por quê.** Numa falha real a Mesa clicou em algo que não abria o card. A busca por título aceitava qualquer elemento com `title`. O detalhe também era reconhecido por qualquer folha com o título, mesmo dentro de botão ou de card. Causa provável, não confirmada numa conta real.

- item por título com custo ⇒ precisa ser `button` ou `role="button"`, dentro do centro, e o custo pedido aparece no texto depois de tirar o título
- item recusado ⇒ a busca segue; o primeiro recusado vai para `rejeitado` no diagnóstico
- sem custo ⇒ a busca por título é a de antes
- botão de confirmação ⇒ fica fora da busca por título quando há custo
- card por custo ⇒ o texto inteiro precisa ser só o número igual ao custo; `Redeem 300` dentro de um detalhe não entra
- detalhe aberto ⇒ conta só a folha nova do título, fora de botão do centro e fora dos cards; folha que já estava antes do clique não conta
- guarda antes de cada clique ⇒ bloqueia com `dedicado` se o botão de confirmação está no centro; bloqueia com `titulo-visivel` se o título aparece visível fora de botão e nenhum filtro `reward-filter-*` está visível
- clique no item que não acontece ⇒ fecha o centro e falha com motivo `outro`, sem clicar em Redeem

**NOVO**
- diagnóstico `percurso` no resultado de falha: `caminho`, `bloqueio`, `clique`, `rejeitado`, `lista`, `pos`, `folhas`, `escopo`, `candidatos` e `foraDoCentro`
- `percurso`, `cardClicado` e `totalBotoesCentro` vão também para o log de erros
- painel: trecho «Percurso» com caminho, bloqueio, clique, item recusado, lista, posição, folhas, escopo e candidatos, em texto curto
- painel: `sem atributo=N` agrupa, numa contagem só, os botões do centro sem atributo e sem custo

**NÃO MUDOU**
- seletores, espera de 6 s, `botaoPontos` e a ordem dos passos
- a decisão de `motivoEscopo` foi separada em `classificarFolhas`, sem mudar as condições
- as travas do Redeem continuam: dentro do centro, cartão único, escopo com título exato único

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: `eBotaoReal`, `itemTemCusto`, `buscarRecompensa` (com custo, `rejeitado`), `classificarFolhas`, `travaDoBotao`, `cardsPorCusto`, `folhasTitulo`, `retratoAntes`, `guardaCard`, `detalheAbriu`, `montarPosicao`, `percursoDe`, `resgatarPorCusto`, `resgatarFluxo`, `resgatar`
- `dashboard/src/main/twitch/points.js`: `limparPercurso` e os campos novos em `limparResultado`
- `dashboard/src/main/twitch/controller.js`: repasse de `percurso` ao resultado e ao log
- `dashboard/src/preload/twitch-page.js`: repasse de `percurso`
- `dashboard/src/renderer/live-bonus.js`: `liveBonusPercurso` e `sem atributo=N`

### Testes
- `npm test` em `dashboard/`: **491** passaram, segundo a entrega. Esta documentação não rodou a suíte.
- `src/main/twitch/erros-log.test.js` tem **10** testes que não entram no `npm test`, porque o script não lista o arquivo.
- Os testes usam DOM simulado.

### Não confirmado
- **Seletor real do Redeem:** segue sem confirmação. Nenhum teste rodou contra a Twitch real.
- **Resgate real:** pode ainda falhar. A próxima rodada real é diagnóstica; ela mostra o percurso, não garante o resgate.
- **Atributos reais dos botões e dos cards:** não confirmados no DOM da Twitch.

### Limites conhecidos
- card com texto além do número não entra no caminho por custo
- botão de confirmação montado e oculto na lista bloqueia o resgate
- título com custo na mesma folha não aciona a guarda `titulo-visivel`
- **risco residual (atualizado):** este limite foi tratado na entrada de cima do mesmo dia. Filtros e cards visíveis na lista agora travam em `redeem-lista`, e o Redeem por texto só clica com as cinco condições e o aviso antes do clique. O risco que sobra está listado na entrada de cima.

### Problemas conhecidos
- Próximo passo: repetir o resgate na Baía 2 e colar a linha `Diag`, a linha de percurso e a linha de falha. O resgate pode falhar de novo.

### Patch note

**Patch «Vigília» · 06/11/2026 · item por botão real e guarda antes de cada clique no resgate da Twitch**

Resumo: o resgate aceita item por título só se for botão do centro com o custo no texto, e confere antes de cada clique. O seletor real do Redeem segue sem confirmação.

**Resgate de pontos**
- [Correção] Item por título. Antes: qualquer elemento com `title` podia ser clicado, e a Mesa clicava às vezes em algo que não abria o card. Depois: só botão real (`button` ou `role="button"`) dentro do centro, com o custo pedido no texto depois de tirar o título.
- [Correção] Card por custo. Antes: qualquer texto com um número igual ao custo contava, inclusive `Redeem 300` num detalhe. Depois: o texto inteiro precisa ser só o número igual ao custo.
- [Ajuste] Detalhe aberto. Antes: qualquer folha com o título contava. Depois: só a folha nova do título, fora de botão e fora dos cards.
- [Novo] Guarda antes de cada clique. Antes: a Mesa clicava sem checar. Depois: não clica se o botão de confirmação estiver no centro, nem se o título estiver visível fora de botão sem filtro `reward-filter-*` visível.
- [Ajuste] Botão de confirmação fora da busca por título quando há custo. Sem custo, a busca é a mesma de antes.
- [Correção] Clique no item que não acontece. Antes: a falha seguia e tentava o Redeem mesmo sem clique. Depois: fecha o centro e falha com motivo `outro`, sem Redeem.

**Diagnóstico**
- [Novo] `percurso` na falha: caminho, bloqueio, clique, item recusado, lista, posição, folhas, escopo, candidatos e itens fora do centro.
- [Ajuste] `sem atributo=N` agrupa, numa contagem só, os botões do centro sem atributo e sem custo.

**Painel**
- [Novo] Trecho «Percurso» com os mesmos dados, em texto curto.

**Log de erros**
- [Novo] `percurso`, `cardClicado` e `totalBotoesCentro` entram no log de cada falha.

**Conhecidos**
- Seletor real do Redeem não confirmado. Nenhum teste rodou contra a Twitch real. O resgate pode ainda falhar; a próxima rodada real é diagnóstica.
- Card com texto além do número não entra no caminho por custo.
- Botão de confirmação montado e oculto na lista bloqueia o resgate.
- Título com custo na mesma folha não aciona a guarda.
- Risco residual (atualizado): tratado na entrada de cima do mesmo dia (`redeem-lista`, `redeem-texto` e aviso antes do clique). Os limites atuais estão lá.

## 2026-11-06 — Patch «Vigília» · até 24 botões do centro e card clicado no diagnóstico

> O diagnóstico do `sem-botao` passa a listar até 24 botões do centro, na ordem do DOM, e mostra o card clicado no resgate. Só diagnóstico: o clique não mudou.

### Destaques do patch
- **24 botões:** o limite sobe de 8 para 24.
- **Card clicado:** o diagnóstico mostra `dts`, `alvo`, `aria`, custo e desabilitado do card, tirados antes do clique.
- **Só leitura:** nenhum seletor, clique, espera ou ordem mudou.

### Bônus Twitch
*O diagnóstico mostra mais botões do centro e o card que foi clicado.*

**Por quê.** Na falha de 14:35 a lista de botões tinha 8 itens, todos cabeçalho e filtros. Faltava ver os botões que vinham depois e qual card foi clicado.

**NOVO**
- resultado `sem-botao`: até 24 botões do centro, na ordem do DOM
- `cardClicado`: `dts`, `alvo`, `aria`, custo e desabilitado do card
- painel: trecho «Card clicado» e lista de botões com até 24 itens; a linha é cortada em 1500 caracteres

**NÃO MUDOU**
- seletores, clique, espera e ordem

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: `BOTOES_CENTRO_MAX` (24) e `cardDiag` do card clicado
- `dashboard/src/main/twitch/points.js`: `limparBotoesCentro` (24) e `limparCardClicado`
- `dashboard/src/main/twitch/controller.js`: repasse de `cardClicado` ao resultado
- `dashboard/src/preload/twitch-page.js`: repasse de `cardClicado`
- `dashboard/src/renderer/live-bonus.js`: `liveBonusBotoesCentro` e `liveBonusCardClicado`

### Testes
- Contagem não registrada na época. A atual está na entrada de cima.
- Arquivos de teste tocados: `points.test.js`, `live-bonus.test.js` e `twitch-dom.test.js`.

### Não confirmado
- **Seletores do centro e do Redeem:** continuam sem conferência numa conta real.
- **Card clicado:** o dado mostra o card escolhido antes do clique, não confirma que o clique surtiu efeito.

### Patch note

**Patch «Vigília» · 06/11/2026 · até 24 botões do centro e card clicado no diagnóstico**

Resumo: o diagnóstico do `sem-botao` lista até 24 botões do centro e mostra o card clicado. O clique não mudou.

**Twitch / Pontos**
- [Ajuste] Nenhuma mudança de clique, seletor, espera ou ordem.

**Diagnóstico**
- [Novo] Até 24 botões do centro, na ordem do DOM (antes: 8).
- [Novo] `cardClicado` com `dts`, `alvo`, `aria`, custo e desabilitado.

**Painel**
- [Novo] Trecho «Card clicado» na falha.
- [Ajuste] Lista de botões com até 24 itens; a linha é cortada em 1500 caracteres.

**Conhecidos**
- Seletores do centro e do Redeem continuam sem conferência numa conta real.

## 2026-11-06 — Patch «Vigília» · log de erros do resgate da Twitch em arquivo

> Cada falha de resgate e cada pausa por falhas repetidas grava uma linha num arquivo de log. Quando o arquivo passa de 512 KB, ele vai para `twitch-resgate.1.log`. Falha de escrita não derruba o resgate.

### Destaques do patch
- **Arquivo:** `userData/logs/twitch-resgate.log`, uma linha JSON por evento.
- **Rotação:** passou de 512 KB, o arquivo vai para `twitch-resgate.1.log` e substitui o anterior.
- **Sem efeito no resgate:** erro de escrita vira aviso no console e nada mais.

### Bônus Twitch
*As falhas do resgate ficam guardadas em arquivo, não só no painel.*

**Por quê.** Não havia registro das falhas do resgate fora do painel. Com o arquivo, dá para ler as falhas depois, sem depender do painel estar aberto.

**NOVO**
- `src/main/twitch/erros-log.js`: `registrarErro`, `lerUltimosErros`, `caminhoPadrao` e limite de 512 KB
- falha de resgate: uma linha com `baia`, `tipo`, `motivo`, `fase`, `trava`, `clicou` e `detalhe`
- pausa por falhas repetidas: uma linha `tipo: pausa`, `motivo: falhas-repetidas`, com a hora em que a pausa acaba
- `detalhe` leva os diagnósticos já sanitizados (vistos, pistas, diálogos, botões, cabeçalho, classes, card clicado e percurso)
- `index.js` passa o caminho do log ao controller

**NÃO MUDOU**
- painel, clique e resgate
- falha de escrita nunca interrompe o resgate

### Arquivos de produto
- `dashboard/src/main/twitch/erros-log.js` (novo)
- `dashboard/src/main/twitch/controller.js`: `registrar` e a linha de falha
- `dashboard/src/main/twitch/index.js`: passa `registrarErro` ao controller

### Testes
- `src/main/twitch/erros-log.test.js` (novo): **10** testes. Não entram no `npm test`, porque o script não lista o arquivo.
- `controller.test.js` ganhou testes do repasse ao log.

### Não confirmado
- **Arquivo real em `userData`:** a rotação e o tamanho em disco não foram vistos numa sessão real da Mesa.

### Patch note

**Patch «Vigília» · 06/11/2026 · log de erros do resgate da Twitch em arquivo**

Resumo: as falhas do resgate e as pausas ficam gravadas em `userData/logs/twitch-resgate.log`, com rotação em 512 KB. O resgate não muda.

**Twitch / Pontos**
- [Novo] Cada falha de resgate e cada pausa por falhas repetidas vira uma linha no log.

**Log de erros**
- [Novo] Arquivo `twitch-resgate.log`; ao passar de 512 KB, vai para `twitch-resgate.1.log`.
- [Ajuste] Falha de escrita só gera aviso no console.

**Conhecidos**
- Rotação e tamanho em disco não confirmados numa sessão real.

## 2026-11-06 — Patch «Vigília» · botões do centro no diagnóstico do sem-botao

> Quando o botão Redeem não é achado, o diagnóstico lista os botões da tela de detalhe do centro. Só leitura: o clique não mudou.

### Destaques do patch
- **Botões do centro:** até 8 botões, com atributos curtos.
- **Sinais:** cada botão mostra se tem custo, se é `role=tab` e se está desabilitado.
- **Total:** o total de botões do centro também sai no diagnóstico.

### Bônus Twitch
*O diagnóstico mostra os botões do detalhe do centro quando o Redeem não é achado.*

**Por quê.** Na falha de 14:18 o título foi achado, mas o botão Redeem não casou com `RequestRewardButton`. Faltava ver quais botões existiam no detalhe.

**NOVO**
- resultado `sem-botao`: `botoesCentro` (até 8) e `totalBotoesCentro`
- cada botão: `data-test-selector`, `data-a-target`, `aria-label`, e se tem custo, `role=tab` ou está desabilitado
- painel: linha «Botões do centro» na falha `sem-botao`

**NÃO MUDOU**
- seletores, clique, espera e ordem

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: lista de botões do centro no `sem-botao`
- `dashboard/src/main/twitch/points.js`: `limparBotoesCentro`
- `dashboard/src/main/twitch/controller.js`: repasse de `botoesCentro` e `totalBotoesCentro`
- `dashboard/src/preload/twitch-page.js`: repasse dos campos
- `dashboard/src/renderer/live-bonus.js`: linha «Botões do centro»

### Testes
- Contagem não registrada na época. A atual está na entrada de cima.
- Arquivos de teste tocados: `points.test.js`, `live-bonus.test.js` e `twitch-dom.test.js`.

### Não confirmado
- **Seletor do Redeem:** o `RequestRewardButton` não casou na falha de 14:18; a causa não foi confirmada.

### Patch note

**Patch «Vigília» · 06/11/2026 · botões do centro no diagnóstico do sem-botao**

Resumo: na falha `sem-botao`, o diagnóstico lista os botões do detalhe do centro. O clique não mudou.

**Diagnóstico**
- [Novo] Até 8 botões do centro com `data-test-selector`, `data-a-target` e `aria-label`.
- [Novo] Sinais de custo, `role=tab` e desabilitado por botão, e o total de botões.

**Twitch / Pontos**
- [Ajuste] Nenhuma mudança de clique, seletor, espera ou ordem.

**Conhecidos**
- Seletor do Redeem não confirmado.

## 2026-11-06 — Patch «Vigília» · resgate por custo quando a lista mostra só o custo

> Quando a lista do centro mostra só o custo de cada recompensa, a Mesa agora abre os cards desse custo, confere o título no detalhe e só então clica em Redeem. O clique continua protegido pelas mesmas travas.

### Destaques do patch
- **Fallback por custo:** se a busca por título não acha nada e há card com o custo pedido, a Mesa tenta até 3 cards.
- **Conferência no detalhe:** o título exato precisa aparecer no detalhe do card antes de qualquer clique em Redeem.
- **Diagnóstico de trava:** o resultado `sem-botao` diz qual trava barrou o botão Redeem.

### Bônus Twitch
*Quando a lista mostra só o custo, a Mesa abre o card certo antes de resgatar.*

**Por quê.** A captura real mostrou que os cards da lista do centro (Power-ups & Rewards) exibem só ícone e custo (300, 500, 900). O título aparece só no detalhe, depois do clique no card, junto com o botão Redeem. A busca por título na lista nunca casava, e a falha saía como `sem-recompensa`.

- `sem-recompensa` (sem título na lista) ⇒ se há card com o custo pedido, `resgatarPorCusto` abre cada card (no máximo 3)
- card aberto ⇒ `folhaTitulo` confere se o título exato aparece no detalhe, fora de qualquer card; só então segue para `confirmarResgate`
- card que não confere ⇒ fecha o centro, reabre pelo botão de pontos e tenta o próximo card
- sem card compatível, ou se o fechamento não tiver efeito ⇒ para sem clicar mais
- `sem-botao` ⇒ traz `trava`, o motivo que bloqueou o Redeem (`motivoEscopo`, lista fechada `TRAVAS_PAGINA`)

**NOVO**
- clique em cards do custo (no máximo 3) e, quando o título não confere, reabrir o centro pelo botão de pontos
- resultado `sem-botao`: campo `trava`, com um dos valores `fora-do-centro`, `cartao`, `outro-cartao`, `texto-solto`, `titulos`, `resto`, `descricao`, `custo`, `sem-dedicado` (qualquer outro valor vira vazio)
- resultado `sem-recompensa`: `vistos` passa a ter só custos (até 8, sem repetição); nunca título nem texto de card
- painel: a linha `Diag` do `sem-botao` mostra `trava=…` quando o resultado traz o campo

**NÃO MUDOU**
- a busca por título continua sendo a primeira tentativa
- o Redeem continua protegido pelas mesmas travas: dentro do centro, cartão único, escopo com título exato único
- nenhum seletor foi removido
- espera de 6 s e `botaoPontos` continuam iguais

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: `acharBotaoResgatarComTrava`, `motivoEscopo`, `cardsPorCusto`, `folhaTitulo`, `custosVistos`, `confirmarResgate`, `resgatarPorCusto`
- `dashboard/src/main/twitch/points.js`: `TRAVAS_PAGINA` e `trava` em `limparResultado`
- `dashboard/src/main/twitch/controller.js`: repasse de `trava` ao último resgate
- `dashboard/src/preload/twitch-page.js`: repasse de `trava` no resultado
- `dashboard/src/renderer/live-bonus.js`: trecho `trava=…` na linha `Diag` do `sem-botao`

### Testes
- `npm test` em `dashboard/`: **423** passaram, 0 falharam, em execução de 2026-11-06 (suíte inteira do projeto).
- A contagem é da suíte inteira, que inclui testes ainda não commitados. O código desta entrega ainda não está commitado: a diferença está no working tree contra `5e0787b`.

### Não confirmado
- **Atributos reais dos cards:** o card do custo é reconhecido por botão com um único número igual ao custo. Não foi confirmado no DOM real da Twitch.
- **Seletor real do Redeem:** o seletor dedicado continua sem conferência numa conta real.
- **Cabeçalho e rodapé dentro do diálogo:** não confirmados.
- **Botão de pontos com o detalhe aberto:** não se sabe se ele fecha o detalhe e reabre a lista.
- **Custo com formato «1K»:** não tratado; só número puro é comparado.
- **DOM real:** os testes usam DOM simulado. Nada disto foi verificado na Twitch.

### Problemas conhecidos
- Se o saldo aparecer no detalhe, a trava `custo` bloqueia o Redeem.
- Provável `sem-botao` na primeira rodada real.
- Próximo passo: repetir o resgate na Baía 2 e colar a linha `Diag` e a linha de falha com `trava`.

### Patch note

**Patch «Vigília» · 06/11/2026 · resgate por custo quando a lista mostra só o custo**

Resumo: quando a lista do centro mostra só o custo, a Mesa abre o card do custo, confere o título no detalhe e só então clica em Redeem. As travas do Redeem não mudaram.

**Resgate de pontos**
- [Novo] Sem título na lista, a Mesa tenta até 3 cards do custo pedido.
- [Novo] O card só segue para o Redeem se o título exato aparece no detalhe.
- [Ajuste] Card que não confere: a Mesa fecha o centro, reabre pelo botão de pontos e tenta o próximo.
- [Ajuste] Sem card compatível, ou se o fechamento não tiver efeito, a Mesa para sem clicar mais.
- [Correção] Antes: `sem-recompensa` por busca de título que nunca casava na lista de custo. Depois: a Mesa abre o card e confere o título no detalhe.

**Diagnóstico**
- [Novo] `sem-botao` traz `trava`, o motivo que bloqueou o botão Redeem.
- [Ajuste] `sem-recompensa` traz em `vistos` só os custos, nunca títulos nem texto de card.

**Conhecidos**
- Se o saldo aparecer no detalhe, a trava de custo bloqueia o Redeem.
- Provável `sem-botao` na primeira rodada real. A validação só aparece na Baía 2.
- DOM real da Twitch não verificado; os testes usam DOM simulado.

## 2026-11-06 — Patch «Vigília» · centro de recompensas reconhecido pelo cabeçalho

> O centro de recompensas agora é reconhecido também quando o diálogo que contém o cabeçalho `#channel-points-reward-center-header` está aberto. Os seletores antigos continuam com prioridade. O clique não mudou.

### Destaques do patch
- **Cabeçalho com id específico:** o diálogo que contém `#channel-points-reward-center-header` conta como centro.
- **Seletores antigos primeiro:** `SELETORES.centro` continua sendo tentado antes do cabeçalho.
- **Mesmas travas:** a recompensa continua sendo buscada e confirmada só dentro do centro aceito.

### Bônus Twitch
*A Mesa reconhece o centro de recompensas mesmo quando nenhum seletor antigo casa.*

**Por quê.** O diagnóstico das 12:38 mostrou o cabeçalho `channel-points-reward-center-header` dentro de um `role="dialog"`, junto da lista de 30 botões e do título da recompensa. Nenhum seletor de `SELETORES.centro` casou, então a Mesa não reconhecia o centro e a falha saía como `sem-centro`.

- `centroAberto` ⇒ primeiro `SELETORES.centro`; se nada casar, `centroPorCabecalho`
- `centroPorCabecalho` ⇒ acha `SELETORES.cabecalhoCentro` e sobe a partir do pai do cabeçalho (nunca o próprio), até 50 níveis; devolve o primeiro ancestral com `role="dialog"`; sem ele, devolve nada
- `SELETORES.cabecalhoCentro` ⇒ `#channel-points-reward-center-header`, em lista própria, fora de `SELETORES.centro`
- `centroAberto` passa a ser exportado pelo módulo

**NOVO**
- o centro é reconhecido quando o diálogo que contém o cabeçalho com id específico está aberto
- o módulo exporta `centroAberto`

**NÃO MUDOU**
- os seletores antigos continuam com prioridade (`primeiro(doc, SELETORES.centro) || centroPorCabecalho(doc)`)
- diálogo genérico sozinho nunca é centro; diálogo de extensão sem o cabeçalho é ignorado
- o clique só vai em recompensa dentro do diálogo aceito
- as travas de confirmação (`dentroDe`, `escopoConfere`, `desabilitado`, campo de texto) são as mesmas
- espera de 6 s e `botaoPontos` continuam iguais; o clique no resumo só acontece quando o centro não está aberto

**CLIQUE NOVO (só no fechamento)**
- quando só o cabeçalho reconhece o centro e a falha vem depois (`sem-recompensa`, `indisponivel`), a Mesa fecha o centro clicando no botão de pontos. Antes, com o centro não reconhecido, esse clique não existia

**RESULTADOS ANTIGOS**
- o diagnóstico (`centro#`, `centroSeletor`) continua medindo só os seletores antigos

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: `SELETORES.cabecalhoCentro`, `centroPorCabecalho`, `centroAberto` (agora com o cabeçalho) e a exportação de `centroAberto`

### Testes
- `npm test` em `dashboard/`: **408** passaram, 0 falharam, em execução de 2026-11-06 (suíte inteira do projeto).
- Cobertura nova: `twitch-dom.test.js`, describe «centro pelo cabeçalho com id específico (diálogo que contém o cabeçalho)».
- A contagem é da suíte inteira, que inclui testes ainda não commitados. O código desta entrega ainda não está commitado: a diferença está no working tree contra `92212ac`.

### Não confirmado
- **Tamanho do diálogo:** se o diálogo que contém o cabeçalho é o diálogo inteiro do centro e não um interno menor.
- **Botão de confirmar:** se ele fica dentro do mesmo diálogo.
- **Fechamento:** se o clique no botão de pontos fecha o diálogo.
- **Validação real:** só aparece no próximo resgate da Baía 2.

### Problemas conhecidos
- O próximo passo é o usuário repetir o resgate na Baía 2 com «Assistir e resgatar sozinho» e colar a linha `Diag` e a linha de falha, ou a linha de sucesso.

### Como ler o próximo resultado
- **Sucesso:** estado clicado e recompensa resgatada na Twitch.
- **`sem-centro` com `fase=abrir`:** a regra não casou.
- **`sem-recompensa`:** o centro foi aceito, mas o título não bateu.
- **`sem-centro` com `fase=confirmar`:** o cabeçalho sumiu na tela de detalhe, depois do clique na recompensa.
- **`sem-botao`:** a confirmação ficou fora do diálogo ou não passou na conferência.

### Patch note

**Patch «Vigília» · 06/11/2026 · centro de recompensas reconhecido pelo cabeçalho**

Resumo: o centro de recompensas passa a ser reconhecido pelo cabeçalho quando nenhum seletor antigo casa. O clique não mudou.

**Twitch / Pontos**
- [Correção] O centro é reconhecido quando o diálogo que contém `#channel-points-reward-center-header` está aberto.
- [Ajuste] Os seletores antigos continuam com prioridade; diálogo genérico e diálogo de extensão sem o cabeçalho seguem fora.

**Painel**
- [Ajuste] Nenhuma tela mudou nesta entrega; a linha de falha `sem-centro` continua igual.

**Diagnóstico**
- [Ajuste] Nenhum campo novo: `centroSeletor` continua medindo só os seletores antigos.

**Problemas conhecidos**
- A validação real só aparece no próximo resgate da Baía 2. Próximo passo: repetir o resgate com «Assistir e resgatar sozinho» e colar a linha `Diag` e a linha de falha, ou a de sucesso.

## 2026-11-06 — Patch «Vigília» · cabeçalho do centro no diagnóstico do resgate da Twitch

> O diagnóstico do resgate agora mostra de qual contêiner veio o cabeçalho do centro de recompensas e quais classes de contêiner existem na página. O clique não mudou: é leitura para a próxima falha real.

### Destaques do patch
- **Cadeia do cabeçalho:** até 4 ancestrais de `[id*="reward-center-header"]`, com tag, id, primeira classe, `data-test-selector`, role, botões, título, resumo e diálogo.
- **Classes dos contêineres:** até 4 classes de `[class*="reward-center"]` e até 4 de `[class*="community-points"]`.
- **Pistas antes do clique:** o resultado da falha traz as pistas lidas antes do clique no resumo.

### Bônus Twitch
*O diagnóstico mostra de onde veio o cabeçalho do centro, sem mudar o clique.*

**Por quê.** O diag das 11:33 mostrou o cabeçalho `h#channel-points-reward-center-header` depois do clique. A lista abriu, mas nenhum seletor de `SELETORES.centro` casou, e a pista `div` sem atributos não dizia de qual contêiner veio.

- `sem-centro` ⇒ `cabecalho` com até 4 níveis a partir do pai do cabeçalho; cada nível traz tag, id, primeira classe válida, `data-test-selector` e role (cortados), mais botões, título sim ou não, resumo sim ou não e diálogo sim ou não
- `classes` ⇒ até 4 de `[class*="reward-center"]` (prefixo `rc:`) e até 4 de `[class*="community-points"]` (prefixo `cp:`), só classes com caracteres seguros
- `pistasAntes` ⇒ pistas do centro lidas antes do clique no resumo
- trecho «Diálogo#N» ⇒ usa o `antes` de cada diálogo quando ele vem booleano; o valor global só entra como fallback

**NOVO**
- resultado `sem-centro`: campos `pistasAntes`, `cabecalho` (`achado` e `cadeia`) e `classes`
- painel: na linha de falha `sem-centro`, as linhas «Antes do clique», «Cabeçalho» (com a cadeia) e «Classes», quando o resultado as traz

**NÃO MUDOU**
- seletores (`SELETORES`, incluindo `centro`), espera de 6 s, `centroAberto`, `botaoPontos` e `pistaDe`
- o clique: continua só no botão do resumo

**RESULTADOS ANTIGOS**
- resultados sem os campos novos não ganham as linhas novas: dado ausente não vira «não»

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: `nivelDiag`, `cabecalhoDiag`, `classesPista` e `pistasAntes` no `sem-centro`
- `dashboard/src/preload/twitch-page.js`: repasse de `pistasAntes`, `cabecalho` e `classes` no resultado
- `dashboard/src/main/twitch/points.js`: `limparCabecalho` (até 4 níveis) e `classes` em `limparResultado`
- `dashboard/src/main/twitch/controller.js`: repasse de `pistasAntes`, `cabecalho` e `classes` ao último resgate
- `dashboard/src/renderer/live-bonus.js`: `liveBonusSemCentro` (Antes do clique, Cabeçalho com a cadeia, Classes)

### Testes
- `npm test` em `dashboard/`: **399** passaram, 0 falharam, em execução de 2026-11-06 (suíte inteira do projeto).
- O código desta entrega ainda não está commitado: a diferença está no working tree contra `8e72879`.

### Não confirmado
- **Cadeia real e classe do contêiner:** só aparecem na próxima falha da Baía 2.
- **Seletor do centro:** a escolha depende desse dado e ainda não foi decidida.
- **Clique do resumo:** não é alterado por esta entrega.

### Problemas conhecidos
- O próximo passo é o usuário repetir o resgate na Baía 2 e colar a linha `Diag` e a linha de falha completa com `Cabeçalho`, `Classes` e `Antes do clique`.

### Patch note

**Patch «Vigília» · 06/11/2026 · cabeçalho do centro no diagnóstico do resgate da Twitch**

Resumo: na falha sem-centro, o diagnóstico mostra de onde veio o cabeçalho do centro e quais classes de contêiner existem na página. O clique não mudou.

**Twitch / Pontos**
- [Novo] A falha `sem-centro` informa a cadeia de até 4 níveis acima do cabeçalho do centro.
- [Ajuste] Nenhum seletor mudou; o clique e a espera continuam iguais, e a leitura só observa.

**Painel**
- [Novo] Na falha `sem-centro`, as linhas «Antes do clique», «Cabeçalho» e «Classes» aparecem quando o resultado as traz.
- [Ajuste] Resultado antigo, sem os campos novos, não mostra essas linhas.

**Diagnóstico**
- [Novo] Até 4 classes de `reward-center` e até 4 de `community-points`, só com caracteres seguros.

**Problemas conhecidos**
- A cadeia real e a classe do contêiner só aparecem na próxima falha da Baía 2. Próximo passo: repetir o resgate na Baía 2 e colar a linha `Diag` e a linha de falha completa.

## 2026-11-06 — Patch «Vigília» · diálogos no diagnóstico do resgate da Twitch

> Quando o resgate falha como `sem-centro`, a Mesa lista o que existe dentro de cada diálogo da página. A leitura só observa: o clique não mudou, e o diagnóstico serve para decidir o próximo passo.

### Destaques do patch
- **Diálogos no sem-centro:** até 2 `[role="dialog"]`, com botões, abas, título pedido e rótulos de até 6 itens.
- **Só leitura:** nenhum clique novo; o clique continua só no botão do resumo.
- **Leitura protegida:** um atributo que falha não derruba o diagnóstico.

### Bônus Twitch
*O diagnóstico mostra o que há dentro do diálogo que abriu, sem clicar nele.*

**Por quê.** A Baía 2 mostrou `fase=abrir`, `clicou=sim` e as pistas `div[dialog]` e `div[community-points-summary]`. Depois do clique, nenhum atributo com «reward» apareceu. Ainda não se sabe se o diálogo é um popover que pede outro clique ou outro painel.

- `sem-centro` ⇒ cada `[role="dialog"]` da página (até 2) vira um resumo com `antes`, `título`, `botões`, `abas`, `itens` e `dts`
- `itens` ⇒ até 6 itens rotulados (`dts`, `alvo`, `aria`, `tab`), com botões e abas
- botão sem nenhum rótulo ⇒ conta em `botões`, mas não entra em `itens`
- `dts` ⇒ até 8 valores de `data-test-selector` dentro do diálogo
- `título` ⇒ só sim ou não: se o título pedido aparece no texto do diálogo; o texto não é guardado
- `antes` ⇒ sim se já havia algum `[role="dialog"]` na página antes do clique no resumo; é um valor só da página, repetido em cada diálogo
- leituras de atributo protegidas por try/catch: falha em um atributo não derruba o diagnóstico

**NOVO**
- resultado `sem-centro`: campos `dialogos` (até 2) e `dialogoAntes`
- painel: na linha de falha `sem-centro`, o trecho «Diálogo#1: antes=…, título=…, botões=…, abas=…, itens: …, dts: …»

**NÃO MUDOU**
- seletores do centro, espera de 6 s, `centroAberto` e `botaoPontos`
- o clique: continua só no botão do resumo

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: `dialogosDiag` e `dialogoAntes` no `sem-centro`
- `dashboard/src/preload/twitch-page.js`: repasse de `dialogoAntes` e `dialogos` no resultado
- `dashboard/src/main/twitch/points.js`: `limparDialogos` (até 2 diálogos, 6 itens e 8 `dts`) e `dialogoAntes` só com `true` estrito
- `dashboard/src/main/twitch/controller.js`: repasse de `dialogoAntes` e `dialogos` ao último resgate
- `dashboard/src/renderer/live-bonus.js`: `liveBonusDialogos`, trecho «Diálogo#N» na linha de falha

### Testes
- `npm test` em `dashboard/`: **378** passaram, 0 falharam, em execução de 2026-11-06. A contagem é da suíte inteira, que inclui testes de arquivos ainda não commitados de outras sessões (`process-table`, `ui/theme-sync`).
- Cobertura: `twitch-dom.test.js` (`dialogosDiag`, `dialogoAntes`, atributo que lança), `points.test.js` (limites), `controller.test.js` (repasse) e `live-bonus.test.js` (trecho «Diálogo#1»).
- O código desta entrega ainda não está commitado: a diferença está no working tree contra `be7a9de`.

### Não confirmado
- **Seletores do centro:** continuam sem conferência numa conta real.
- **Natureza do diálogo:** não se sabe se o `[role="dialog"]` visto é o popover de pontos ou outra lista. Por isso `antes` e os itens são só pistas.
- **Opção B** (segundo clique dentro do diálogo): depende da linha `Diag` e da nova linha de falha da Baía 2. Não está decidida.
- **`campoTexto`:** o dado existe no diagnóstico, mas não aparece no trecho do painel.

### Problemas conhecidos
- O próximo passo é o usuário repetir o resgate na Baía 2 e colar a linha `Diag` e a linha de falha com o trecho «Diálogo#1: …».

### Patch note

**Patch «Vigília» · 06/11/2026 · diálogos no diagnóstico do resgate da Twitch**

Resumo: quando o centro de recompensas não aparece, o diagnóstico lista os diálogos abertos na página. O clique não mudou.

**Twitch / Pontos**
- [Novo] A falha `sem-centro` informa até 2 diálogos da página, com título, botões e abas.
- [Ajuste] A leitura só observa: o clique continua só no botão do resumo.

**Painel**
- [Novo] Na falha `sem-centro`, o trecho «Diálogo#1: …» mostra antes, título, botões, abas, itens e dts.

**Diagnóstico**
- [Novo] Até 6 itens rotulados por diálogo (`dts`, `alvo`, `aria`, `tab`) e até 8 `data-test-selector`.
- [Ajuste] Botão sem rótulo conta em botões, mas não entra em itens; leitura de atributo protegida.

**Problemas conhecidos**
- Não se sabe se o diálogo é o popover de pontos ou outra lista. Próximo passo: repetir o resgate na Baía 2 e colar a linha `Diag` e a linha de falha com o trecho «Diálogo#1: …».


## 2026-11-06 — Patch «Vigília» · diagnóstico do resgate da Twitch

> O resgate agora diz em que fase parou (abrir, buscar ou confirmar), se a Mesa clicou no resumo ou no item, e mostra os elementos da página que podem ser o centro. O clique não mudou: é diagnóstico para a próxima tentativa real.

### Destaques do patch
- **Fase do sem-centro:** `abrir`, `buscar` ou `confirmar`, com `clicou` (sim ou não).
- **Pistas no DOM:** até 8 elementos que podem ser o centro, só leitura, nunca clicados.
- **Botões do resumo no diag:** até 4 botões, sanitizados.

### Bônus Twitch
*O diagnóstico mostra onde o resgate parou, sem mudar o clique.*

**Por quê.** A falha `sem-centro` dizia só que a lista não abriu. Sem a fase, o clique feito e os elementos vistos, não dava para separar seletor errado de centro que demora.

- `sem-centro` ⇒ resultado traz `fase`, `clicou` e `pistas`
- `clicou` ⇒ true se houve clique no resumo ou no item da recompensa
- `pistas` ⇒ até 8 elementos `tag#id[data-test-selector][role]`, sem repetição, só leitura
- diag ⇒ `botoesResumo` com até 4 botões (`data-test-selector`, `data-a-target`, `aria-label`); dígito vira `#`, corte de 40, sem `textContent`
- `saldo#` ⇒ índice do seletor de saldo que casou; `0` é o primário (`copo-balance-string`)
- `centro#` ⇒ índice do seletor de centro, da leitura periódica de 3 s, não do momento do clique

**NOVO**
- resultado `sem-centro`: campos `fase`, `clicou` e `pistas`
- diag: `botoesResumo`, `saldo#` e `centro#`
- painel: «Vi no DOM: …» na falha `sem-centro`

**AJUSTE**
- painel: a falha `sem-centro` mostra `fase`, `clicou` e as pistas, no lugar de «Vi: …»
- `points.js`: `fase` só aceita `abrir`, `buscar` ou `confirmar`; pistas limitadas a 8

**CORREÇÃO**
- falha na fase `confirmar` agora registra `clicou` certo: sim quando o item da recompensa foi clicado antes da falha

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: `botoesDoResumo`, `pistasCentro`, `fase` e `clicou` no `sem-centro`, `saldo#` e `centro#` no diag
- `dashboard/src/preload/twitch-page.js`: repasse de `fase`, `clicou` e `pistas` no resultado
- `dashboard/src/main/twitch/points.js`: `limparBotoesResumo`, `limparPistas` e `FASES_PAGINA`
- `dashboard/src/main/twitch/controller.js`: repasse de `fase`, `clicou` e `pistas` ao painel
- `dashboard/src/renderer/live-bonus.js`: linha do `sem-centro` com `fase`, `clicou` e «Vi no DOM: …»; `botoesResumo`, `saldo#` e `centro#` no «Diag:»

### Testes
- `npm test` em `dashboard/`: **364** passaram na época desta entrada (contagem histórica; a atual está na entrada de cima).

### Patch note

**Patch «Vigília» · 06/11/2026 · diagnóstico do resgate da Twitch**

Resumo: o resgate da Twitch mostra em que fase parou e o que a Mesa viu na página. O clique não mudou.

**Twitch / Pontos**
- [Novo] A falha `sem-centro` informa a fase (abrir, buscar ou confirmar) e se houve clique.
- [Correção] Na fase confirmar, `clicou` passa a indicar o clique no item da recompensa.

**Painel**
- [Novo] «Vi no DOM: …» com até 8 elementos que podem ser o centro, só leitura.
- [Ajuste] A falha `sem-centro` mostra fase e clicou, no lugar de «Vi: …».

**Diagnóstico**
- [Novo] Até 4 botões do resumo no `Diag`, com `data-test-selector`, `data-a-target` e `aria-label`, sanitizados.
- [Novo] `saldo#` (índice do seletor de saldo; 0 é o primário) e `centro#` (leitura de 3 s).

**Problemas conhecidos**
- A causa do `sem-centro` na Baía 2 ainda não está comprovada. Próximo passo: repetir o resgate e colar a linha `Diag` e a linha de falha.

## 2026-11-06 — Patch «Vigília» · resgate da Twitch com centro aberto

> O resgate de XP parava em «não achei a recompensa» porque a Mesa confundia qualquer diálogo aberto na página com o centro de recompensas. Agora o centro só é reconhecido quando é o centro de verdade, e a falha diz em que ponto parou.

### Destaques do patch
- **Centro de recompensas certo:** só seletores específicos liberam clique. Diálogo genérico (`[role="dialog"]`) nunca é usado como centro, nem quando contém a recompensa.
- **Título que bate:** a comparação normaliza acento decomposto (NFKC) e caracteres invisíveis, e aceita botão aninhado.
- **Falha com motivo claro:** `sem-centro` e `recompensa-ambigua` ganham frase própria, e o painel mostra os títulos vistos.

### Bônus Twitch
*O resgate só clica quando a recompensa certa está no centro certo.*

**Por quê.** Qualquer `[role="dialog"]` da página fazia a Mesa achar que o centro já estava aberto e pular o clique no botão de pontos. Com isso, a recompensa não aparecia no centro e o resgate falhava como `sem-recompensa`. Causa provável, não confirmada numa conta real.

- qualquer `[role="dialog"]` aberto ⇒ centro reconhecido e clique no botão de pontos pulado (causa provável)
- agora ⇒ centro só por seletores específicos; diálogo genérico nunca é centro, nem quando contém a recompensa
- candidatos disjuntos com o mesmo título ⇒ `recompensa-ambigua`, sem clique
- item fora do centro ⇒ nunca é clicado
- centro que some durante a espera ⇒ nada é clicado e a falha vira `sem-centro`
- título: comparação com NFKC, caracteres invisíveis removidos e botão aninhado tratado (a comparação anterior era estrita demais)

**NOVO**
- motivo `sem-centro`: «não abriu a lista de recompensas»
- motivo `recompensa-ambigua`: «mais de uma recompensa com esse nome»
- "Vi: …" no painel, com até 8 títulos vistos, de até 45 caracteres cada, só texto (sem dado pessoal)

### Arquivos de produto
- `dashboard/src/shared/twitch-dom.js`: reconhecimento do centro, comparação de título, `sem-centro` e `recompensa-ambigua`
- `dashboard/src/main/twitch/points.js`: lista de motivos da página e limpeza dos títulos vistos (até 8)
- `dashboard/src/main/twitch/controller.js`: repasse dos motivos novos ao painel
- `dashboard/src/renderer/live-bonus.js`: frases dos motivos novos e linha "Vi: …"

### Testes
- `npm test` em `dashboard/`: **342** passaram na última execução.
- Cobertura nos arquivos de teste: `twitch-dom.test.js` (centro, diálogos e títulos), `points.test.js` (motivos e títulos vistos), `controller.test.js` e `live-bonus.test.js` (frases e "Vi: …").

### Não confirmado
- **Twitch real:** os seletores e o tempo de espera do centro só se confirmam num resgate real. Sem conta real, o comportamento contra a Twitch não foi visto.
- **Calibração:** a regra de centro aberto depende do primeiro teste real. Se o centro verdadeiro não casar com os seletores, a falha aparece como `sem-centro` e não como clique errado.

## 2026-11-05 — Patch «Vigília» · login da Twitch por baía

> O login da Twitch ficou mais claro: quando não dá para copiar a conta, a Mesa diz se é falta de login ou falha de leitura, e uma leitura que falha de repente não apaga mais o login da baía.

### Destaques do patch
- **«Sem login» e «falha de leitura» separados:** cada caso tem mensagem própria e pede uma ação diferente.
- **Login da baía que não some sozinho:** uma leitura momentânea que falha não zera mais a conta já lida naquela baía.
- **Mensagens por motivo:** `pending`, `leitura-falhou` e `browser-open` dizem o que fazer em seguida.

### Bônus Twitch
*O login da baía fica guardado mesmo quando uma leitura falha uma vez.*

**Por quê.** A leitura do perfil de login podia falhar por um instante, e a conta da baía era zerada junto, como se o usuário tivesse saído da Twitch.

- leitura que devolve `null` ou dá erro ⇒ a conta da baía fica como estava
- perfil lido sem login válido ⇒ situação `sem-login` («Entre na Twitch nesta baía…»), não «falha de leitura»
- janela de login ainda aberta ⇒ a Mesa pede para fechá-la antes de «Já entrei»

### Login pelo navegador
*Cada motivo de falha traz a frase e a ação certas.*

**Por quê.** Uma única mensagem genérica não dizia se faltava entrar na Twitch, se o navegador travava a leitura ou se a janela ainda estava aberta.

- **`pending`:** «Ainda não há login nessa janela. Entre na Twitch nela, feche-a e clique em «Já entrei».». Pede entrar na Twitch nessa janela, fechá-la e clicar em «Já entrei». O navegador de sempre e a conta do Edge não contam.
- **`leitura-falhou`:** «Não consegui ler o navegador desta baía…». Pede fechar todas as janelas desse navegador e clicar em «Já entrei».
- **`browser-open`:** «Feche a janela do navegador de login desta baía…». Pede fechá-la antes de «Já entrei».
- **Login copiado:** a frase de sucesso continua; com o interruptor da baía, avisa que «Assistir e resgatar sozinho» ficou ligado.
- O perfil de login é isolado por baía (`%AppData%\Mesa\login\mesa-twitch-N`). A conta Microsoft ou Google do Edge ou do Chrome não entra nele.

### Arquivos de produto
- `dashboard/src/main/twitch/browser-login.js`: separa `pending` (sem login válido) de `leitura-falhou` (leitura com `null` ou erro)
- `dashboard/src/main/twitch/windows.js`: leitura do cookie `login` devolve `null` em erro, sem zerar a conta
- `dashboard/src/main/twitch/controller.js`: `setLoginTwitch` ignora a leitura `null` e mantém a conta da baía
- `dashboard/src/renderer/live-bonus.js`: mensagens novas para `pending`, `leitura-falhou` e `browser-open`

### Testes
- `npm test` em `dashboard/`: **323** passaram, segundo a entrega. Esta documentação não rodou a suíte de novo.
- Cobertura nos arquivos de teste: `browser-login.test.js` (motivos `browser-open`, `pending` e `leitura-falhou`, incluindo leitura que rejeita), `controller.test.js`, `windows.test.js` e `live-bonus.test.js` (frases de `pending` e `leitura-falhou`).

## 2026-11-04 — Patch «Vigília» · pontos da Twitch

> A Twitch deixa o chat de lado: cada baía assiste a uma live oficial numa janela escondida e resgata a recompensa de 1 hora com os pontos do canal.

### Destaques do patch
- **Pontos do canal no lugar do chat:** a Mesa resgata a recompensa de 1 hora pelo título, sem entrar no chat da Twitch.
- **Resgate só na conta certa:** a Mesa só resgata quando a conta logada na Twitch é a mesma vinculada no jogo.
- **Um resgate por vez:** sem confirmação do jogo em 3 min, conta como falha; depois de 3 falhas, a baía pausa por 60 min.
- **Painel novo em Configurações:** preferências globais e uma linha por baía. O resgate automático vem desligado e liga sozinho na baía quando o login pelo navegador é copiado.

### Bônus Twitch
*A janela da Twitch fica escondida e sem som, numa live oficial de cada baía.*

**Por quê.** Desde 04/11/2026, o jogo troca o bônus do chat por horas resgatadas com pontos do canal. O mecanismo antigo (OAuth e IRC) não servia mais para isso.

- entrada no chat por IRC ⇒ janela da Twitch por baía, assistindo à live em 160p e sem som
- bônus automático ⇒ resgate de 1 h pelo título, com limiar de 2, 5, 10 ou 15 min e trava de conta
- nenhum baú ⇒ baú clicado pela Mesa
- sem pontos em 25 min ⇒ a janela oculta passa para fora da tela (uma vez por sessão)

**NOVO**
- janela escondida por baía, na partição `persist:mesa-twitch-1..4`
- "Entrar pelo navegador": abre o Edge ou o Chrome só para aquela baía; a Mesa copia só os cookies de `twitch.tv`
- "Já entrei", "Entrar na janela da Mesa", "Mostrar janela" e "Sair da Twitch" (esta apaga também o perfil de login da baía; com o navegador aberto, o perfil é apagado antes do próximo login)
- espera de 2 min e 5 min depois de cada falha, e pausa de 60 min depois de 3

**REMOVIDO**
- autorização OAuth, Client ID e lista manual de canais
- conexão IRC ao chat; com ela sai também o mecanismo da entrada anterior «canais da Twitch»
- `mesa-twitch.json`, que guardava tokens: é apagado na primeira partida
- dependência `selfsigned`

### Configurações
- **«Bônus Twitch (chat)» ⇒ «Bônus Twitch»:** preferências globais no topo, com tipos de recompensa (XP, Captura e Shiny) e limiar de resgate (2, 5, 10 ou 15 min; padrão 5).
- **Por baía:** interruptor «Assistir e resgatar sozinho», desligado por padrão, com a situação e o motivo quando a baía não resgata. Ele liga sozinho quando a cópia do login dá certo, por «Já entrei» ou pela importação automática; a dica avisa. Desligado à mão, só volta com um login novo. «Entrar na janela da Mesa» não liga o interruptor.
- **Kick ao vivo:** continua, agora no fim do painel.

### Auto-hunt
- **`twitchPct`:** só vale com o bônus de XP da Twitch ativo. Antes ficava em 15% para sempre e inflava o XP/h do auto-hunt.

### Arquivos de produto
- `dashboard/src/main/twitch/` (novo): `points.js`, `controller.js`, `windows.js`, `bundle.js`, `index.js`, `browser-login.js`, `login-reader.js`
- `dashboard/src/main/browser/profile-login.js` (novo, extraído de `game-browser-login.js` e compartilhado com o login do jogo)
- `dashboard/src/shared/twitch-dom.js` e `dashboard/src/preload/twitch-page.js` (novos)
- `dashboard/src/main/live/service.js`: só recebe os frames do jogo e cuida da Kick
- `dashboard/src/main/live/oauth.js`, `oauth-tls.js`, `store.js`, `irc.js` e `irc-socket.js`: removidos
- `dashboard/src/renderer/live-bonus.js` e `live-bonus.css`: painel novo
- `dashboard/src/preload/hunt-page-state.js`, `hunt-page-live.js` e `hunt-page.js`: `twitchPct` pelo bloco novo da Twitch
- `dashboard/src/shared/catalog.js` e `live-catalog.js`: preferências da Twitch e bloco novo

### Testes
- `npm test` em `dashboard/`: **309** passaram, **0** falha. Eram 69; 29 saíram com OAuth e IRC, e os testes novos entraram no lugar.

### Pré-requisito
- Vincular a Twitch no jogo, na linha Bônus Twitch. Sem vínculo, a Mesa não resgata.
- Entrar na Twitch uma vez por baía, pelo navegador ou na janela da Mesa.
- Edge ou Chrome instalado para entrar pelo navegador.

### Aviso
*Entregue com riscos abertos, aceitos pelo usuário.*
- **Conta da Twitch (R7):** assistir e resgatar por automação, em janela escondida e com várias contas, pode ser lido pela Twitch como engajamento artificial. O risco é da sua conta.
- **Login na janela da Mesa (R1):** a Twitch pode recusar o login embutido. Por isso o caminho principal é "Entrar pelo navegador"; se a janela recusar, a Mesa mostra o aviso.
- **Botão de resgatar:** a Mesa só clica no botão de confirmar quando ele está no centro de recompensas e a tela mostra uma recompensa só: o título pedido, inteiro, o custo pedido e no máximo uma frase de descrição. A regra foi testada só com DOM montado à mão. Se o botão errado for clicado mesmo assim, a falha conta, e depois de 3 falhas a baía pausa por 60 min.
- **Layouts que a Mesa não clica:** grade de recompensas ainda na tela, botão fora do centro, custo com texto junto (como «Custo 300»), título com texto a mais, ou texto curto além do título e do custo (descrição com menos de 4 palavras). A Mesa mostra o motivo e não resgata; o primeiro teste real calibra essa regra.

### Não confirmado
- **Só um teste real responde:**
  - se o login funciona pela janela da Mesa (R1);
  - se a janela oculta ganha pontos e baú, e quando a troca para fora da tela acontece (R2);
  - se a Twitch conta 4 contas assistindo ao mesmo tempo da mesma máquina;
  - se `element.click()` resgata (R4);
  - se `video-quality` ainda vale, e o custo de CPU e GPU com 4 vídeos;
  - se o cookie `login` ainda existe;
  - se a Twitch aceita no Electron a sessão copiada do navegador (R16);
  - se cookies sem validade somem ao fechar o app (R17).
- **Seletores com login** (saldo, baú, centro de recompensas e botão de resgatar): nunca foram vistos com uma conta real.
- **Dívida de código**, sem efeito para o usuário: funções longas (`passo` no controller e `mountLiveBonus`) e constantes repetidas (custos, URL de login e `espera`).

## 2026-11-04 — Patch «Vigília» · canais da Twitch

> A Twitch conectava, mas a Mesa não entrava nos canais. Agora um canal só conta depois da confirmação da Twitch, e o pedido que se perde é refeito.

### Destaques do patch
- **Canais que entram de verdade:** um canal só conta depois que a Twitch confirma. Antes contava ao enviar, e sem confirmação nunca era pedido de novo.
- **Pedido perdido é refeito:** sem confirmação, o JOIN sai de novo em 10 s, 20 s e 40 s, no máximo 3 tentativas.
- **Status só depois do servidor aceitar:** "No chat" aparece depois da linha 001 da Twitch, e não ao abrir a conexão.

### Bônus Twitch
*Os pedidos de entrada só saem depois que o servidor aceita a conexão.*

**Por quê.** Os JOIN saíam logo após PASS/NICK, antes da linha 001. O canal era marcado como entrado ao enviar, sem esperar a Twitch, e um JOIN perdido não era reenviado na mesma conexão.

- JOIN logo após PASS/NICK ⇒ só depois da linha `001`
- status "No chat" e a frase "Conectado, mas a Twitch ainda não confirmou nenhum canal" ao abrir o socket ⇒ só depois da `001`
- canal contado ao enviar ⇒ contado ao confirmar (eco de JOIN ou `366`)
- JOIN sem confirmação nunca reenviado ⇒ reenvio em 10 s, 20 s e 40 s; até 3 tentativas (cerca de 70 s); depois desiste até a reconexão ou até o canal sair e voltar à lista
- canal que saiu da lista, ainda na fila de JOIN ⇒ sai da fila e não recebe mais JOIN
- limite de 20 JOIN por 10 s ⇒ janela deslizante e fechada: no máximo 20 em qualquer intervalo de 10 s, inclusive

### Arquivos de produto
- `dashboard/src/main/live/irc.js`: gate do `001`, confirmação, reenvio com backoff, fila filtrada pela lista atual e janela deslizante
- `dashboard/src/main/live/service.js`: `onOpen` removido de `connectSocket`; cada JOIN agora passa por `markJoinSent`

### Testes
- `npm test` em `dashboard/`: **69** passaram, **0** falha (60 antigos e 9 novos em `irc.test.js`: 8 em «sequência de conexão» e 1 de janela deslizante no `JoinScheduler`)
- Simulação do diagnóstico (script no scratchpad): antes, JOIN antes do `001` e nenhum canal confirmado; depois, JOIN só após o `001`, reenvio sem eco e confirmação com o eco
- Limite fechado: o 21º JOIN passa a sair em 10 001 ms, não em 10 000 ms
- **Pendência (não é bug):** dois testes de fronteira checam pouco o ponto de bloqueio. "reenvio respeita 20 JOIN por 10 s" usa `<= 20` (linha 173), e "fila de JOIN segue a lista atual" usa só `includes` (linhas 193–194)

### Pré-requisito
- Client ID da Twitch informado na Mesa
- Redirect `https://127.0.0.1:47831/callback` cadastrado exatamente assim no dev.twitch.tv
- Porta 47831 livre durante a autorização, e aceitar o certificado autoassinado do navegador no callback

### Não confirmado
- Se a Twitch descartava os JOIN enviados antes do `001`. Essa é a causa lida no código; a correção não depende dela.
- Formato real do eco de JOIN e da linha `366`. Os testes usam o formato IRC documentado.
- Se a Twitch conta a janela de 10 s como fechada ou semiaberta, e qual é o limite real por tipo de conta.
- Canal suspenso ou banido: a Twitch manda NOTICE, que o app não lê. O canal gasta as 3 tentativas (cerca de 70 s) e fica sem confirmar.
- NOTICE de limite de taxa: não é tratado.
- Contador "· N canais" na UI: não visto no app.
- Se o servidor nunca responde com `001` nem fecha, o status fica em "Conectando", sem timeout de registro. Antes ficava em "No chat".
- Sem conta real da Twitch, o comportamento contra o serviço não foi testado; só testes unitários e simulação.

## 2026-11-04 — Patch «Vigília» · janela pequena

> Em janela estreita, o jogo volta a aparecer quase inteiro. O console vira uma barra de abas e a seção abre sob demanda, sem empurrar as baías.

### Destaques do patch
- **Jogo visível abaixo de 1100px:** em 900×700, o palco de cada baía foi de 428×55 para 428×199.
- **Console em uma barra:** 46px com as quatro abas, no lugar de um bloco empilhado de 335px.
- **Folha sob demanda:** a seção abre sobre as baías e não muda o tamanho do jogo (por desenho; ver Não confirmado).

### Automações
#### Console abaixo de 1100px
*A seção sai do caminho das baías: abrir não redimensiona o jogo, e a preferência da janela larga fica intacta.*
- **Console:** empilhado, 335px ⇒ barra de abas de 46px
- **Seção:** altura fixa de 288px, em uma coluna ⇒ folha de 320px sobre as baías, com rolagem própria
- **Padrão:** aberto ⇒ fechado a cada sessão, sem gravar `cfg.chrome.opExpanded` nem chamar `save()`
- **Fechar:** clicar de novo na aba ativa, o chevron, Esc, clique fora ou foco no jogo. Clicar no cabeçalho de uma baía mantém a folha aberta
- **Esc:** com foco numa caixa de texto (renomear baía), cancela a edição e não fecha a folha
- **Ao cruzar 1100px:** a folha fecha e o painel volta à preferência salva
- **REMOVIDO:** altura fixa de 288px e o layout de duas colunas entre 701 e 1099px

#### Baías
*Cada baía mantém o palco ao abrir a folha, e o zoom deixa de cortar o jogo.*
- **Palco 1099×800:** 527,5×105 ⇒ 527,5×249 (zoom no piso 0,25, cortado ⇒ cerca de 0,35)
- **Palco 900×700:** 428×55 ⇒ 428×199 (zoom no piso 0,25 ⇒ cerca de 0,28)
- **Palco 760×700:** 358×55 ⇒ 358×199 (zoom no piso 0,25 ⇒ cerca de 0,28)
- **680×700:** palco 646×180, sem overflow horizontal
- Zoom estimado pela fórmula `min(largura/1300, altura/720)`; não foi medido no app

### Arquivos de produto
- `dashboard/src/renderer/mesa.css`
- `dashboard/src/renderer/view.js`
- `dashboard/src/renderer/shell-fold.js`

### Testes
- `npm test`: 60 passaram, 0 falha
- Palco com a folha fechada (Grade, 4 baías pintadas): medidas acima
- Acima de 1100px sem mudança: painel aberto 1100/1366/1920 = 360×280 / 475,4×280 / 730×420; recolhido = 496×280 / 629×280 / 906×420
- Sem overflow horizontal de 680 a 1920, nos dois temas, com a folha aberta e fechada
- Folha a 900×700, alturas: Automações 414px, Baía 324px, Conta 194px, Grade 220px (+57px com baía fora da grade)
- Esc, clique fora e troca de aba foram testados na pré-visualização; os 60 testes automáticos não cobrem esses casos

### Não confirmado
- Electron real: a folha pintar acima do `<webview>`. Se o jogo cobrir a folha, o recuo previsto é voltar a folha ao fluxo, com o empurrão
- Fechar a folha ao focar o jogo (blur da janela): não testado no app. Se falhar, a folha fica aberta até Esc, a aba ou o chevron
- Palco com a folha aberta: medido com a folha fechada; a estabilidade ao abrir é por desenho
- `prefers-reduced-motion`: a folha usa só `mesa-fade`; lido no CSS, não emulado

## 2026-11-04 — Patch «Vigília»

> Quem deixa a Mesa aberta por horas agora lê a letra sem esforço: texto maior, menos coisa disputando a tela, uma cor de destaque só e um fundo grafite que cansa menos. O jogo ficou um pouco maior, e a barra das baías ficou mais enxuta.

### Destaques do patch
- **Letra maior:** corpo em 14px e rótulos em 13px, com a família Segoe UI Variable e números alinhados.
- **Um acento só:** azul-ardósia no lugar do âmbar. Verde só em caçando; vermelho só em parada ou erro.
- **Sem hachura, tracejado nem calhas:** a moldura ficou lisa e a planta saiu da tela.
- **Menos ruído:** contagens zeradas, "Neste computador" e o aviso de baía parada saem do caminho.
- **Jogo um pouco maior:** em 1366×800, o palco de cada baía foi de 470×276 para 475×280.

### Sistema visual
#### Paleta → Grafite e ardósia
*Menos cor, mais sossego: um acento só, e o fundo deixa de ser oliva.*
Contexto: eram cinco matizes saturados disputando a tela. Agora há um acento e as cores de estado ficam para o que é estado.
- **Chão (escuro):** `#0f110e` ⇒ `#161719`
- **Texto sobre o chão:** 15,2:1 ⇒ 13,95:1 (todo texto ≥ 4,5:1 nos dois temas, medido pelo tester)
- **Acento:** âmbar `#f0b43c` ⇒ azul-ardósia `#7fabeb` (claro: `#9a6200` ⇒ `#3164b9`)
- **Cores ao mesmo tempo na tela:** 5 matizes saturados ⇒ 1 acento, com verde e vermelho só em estado
- **REMOVIDO:** laranja na casca
#### Tipografia
*Os números ficam alinhados e o texto respira.*
- **Família:** Bahnschrift + Cascadia Mono ⇒ Segoe UI Variable Text, com `tnum` nos números; Cascadia Mono só no caminho e na tabela de desempenho
- **Escala:** 20 / 16 / 14 / 13 / 12px (corpo e controles 13 ⇒ 14px; rótulos 11 ⇒ 13px)
- **Textos com 12px ou menos (Automações, 1366×800):** 81% dos textos ⇒ só a etiqueta VIP, em 12px
- **Textos visíveis (Automações, 1366×800):** 86 ⇒ 39
#### Forma e movimento
*Retângulos mais redondos e menos coisas se mexendo.*
- **Raios:** 4 e 6px ⇒ 12 painel, 14 dock, 8 controle, 6 chip
- **REMOVIDO:** moldura e chão hachurados, réguas tracejadas, calhas
- **Animações:** 10 ⇒ 5, todas por ação: placa do dock (280ms), tinta da aba e seta do recolher (240ms), aba Grade (160ms) e pressão em botões (120ms). Nenhuma roda em loop.

### Automações
#### Barra de comando
*Uma faixa só, com a frase de alerta no lugar certo.*
- **Altura:** 36px ⇒ 40px
- **Contagens zeradas:** sempre à vista ⇒ escondidas
- **Aviso de baía parada:** faixa laranja acima das baías ⇒ frase na barra de comando (as baías não empurram mais)
- **"Neste computador":** ⇒ escondido (continua em Configurações)
#### Console
*Quatro abas, e a faixa de grade virou uma delas.*
- **NOVO — aba Grade:** "Na grade" e "Disposição" saíram da faixa fixa e viraram a aba Grade
- **Ligado/Desligado:** escondido no console (continua em Configurações); a chave mantém o estado nativo do `<input>`
- **Linhas de automação:** 26px e 12px ⇒ 40px e 14px; sem "Desligado" repetido; VIP como etiqueta neutra
- **Controles deslizantes:** rótulo e valor em cima, trilho inteiro embaixo
- **Tamanho da baía fora do Livre:** controles apagados ⇒ só "Usar Livre"
#### Baías
*Uma linha por baía, com o número que importa.*
- **Cabeçalho:** 59px ⇒ 44px, em uma linha, com ponto de estado antes do nome
- **Área de jogo por baía (1366×800, Grade):** 470×276 ⇒ 475×280
- **Painel recolhido (1366×800):** palco de 629px de largura por baía
- **Estatísticas:** Nv, XP/h, Ouro e RAM ⇒ XP/h no cabeçalho; Nível e Ouro aparecem a partir de 680px; RAM só na Espera
- **Ações:** sempre à vista ⇒ na baía selecionada, sempre visíveis em tela sem hover; nas outras, no hover e no foco do teclado
- **Seleção:** régua âmbar animada ⇒ borda em acento e véu no cabeçalho, sem régua de foco
- **Estado:** barra lateral de 3px ⇒ ponto antes do nome
- **Dock e barra de comando:** dock 52px; barra de comando 40px
### Espera
*O ponto de estado fala no lugar da régua.*
- **Estado da ficha:** régua no topo ⇒ ponto antes do nome; o gráfico usa o acento
- **Largura:** uma coluna até 900px
- **Ícones de fato:** saíram da ficha (estavam aparecendo por especificidade e foram corrigidos)
### Configurações
*Interruptores com nome que se lê.*
- **Interruptores:** `role="switch"` no próprio `<input>`, com o estado nativo (sem `aria-checked` no input)
- **Ligado/Desligado:** continua aqui, ao lado da chave
### Dock
*Mais baixo, sem régua.*
- **Altura:** 60px ⇒ 52px
- **Sem régua tracejada;** a placa desliza sob a aba ativa com 280ms

### Acessibilidade e correções de bugs
- Interruptores das automações sem nome acessível (liam "Desligado") ⇒ `aria-label` com o rótulo (e "(VIP)")
- Interruptores de Configurações sem nome acessível (o rótulo estava em `display:none`) ⇒ rótulo visualmente escondido
- Botões `btn-sm` e `btn-xs` com 12 e 11px (padrão do DaisyUI) ⇒ 14 e 13px
- Sniper sem nome acessível ⇒ `aria-label="Comprar com sniper"`
- Raio da placa e dos botões do dock ⇒ 8px (`--radius-control`)
- Reduced motion passa a cobrir também o polegar do slider
- Flash de abertura `#222630` ⇒ `#161719` (janela)

### Arquivos de produto
`dashboard/src/renderer/`: `app.css`, `app.js`, `chrome.css`, `espera.css`, `extras.js`, `live-bonus.css`, `mesa.css`, `theme.css`, `theme.generated.css` (regenerado por `build:css`), `toggles.css`, `view.js`. `dashboard/src/main/index.js` (`backgroundColor` da janela).

### Testes
- `npm test` em `dashboard/`: **60** passaram, **0** falha
- Pré-visualização a 1366×800 (Grade, 4 baías): sem overflow horizontal de 760 a 1920px

### Não confirmado
- Electron real: webview, recorte de canto de 12px, zoom automático e GPU não foram verificados no app empacotado
- Reduced motion só foi lido no código, não emulado
- Leitor de tela não testado
- Abaixo de 1100px, o palco fica baixo: em 900×700 com o console aberto, o palco mede 428×55; recolher o painel libera cerca de 264px ⇒ resolvido em «Vigília» · janela pequena
- `dashboard/docs/imagens/` continua com as capturas antigas

## 2026-11-04 — Patch «Planta do hangar»

> O console foi para o lado das baías, a barra de comando cabe numa linha e o jogo ganhou área. Quem deixa a Mesa aberta por horas lê o estado de relance, e agora a janela aguenta larguras médias sem tirar baías da tela.

### Destaques do patch
- **Inspetor à esquerda** em janelas de 1100 px ou mais: o console deixa de empurrar as baías para baixo.
- **Abas em toda a largura:** as baías não saem mais da tela entre 701 e 820 px.
- **Dock em bandeja de 48 px**, com uma placa que desliza sob a aba ativa.
- **Moldura hachurada e réguas**, números em Cascadia Mono e dez animações curtas, sem nada em loop.

### Automações
#### Console → Inspetor lateral
*O console saiu do caminho do jogo e ficou do lado das baías.*
Contexto: em 1366×800, o console ocupava a faixa de cima e encolhia a área de jogo. Agora é coluna à esquerda, e pode ser recolhido.
- **Posição (≥1100 px):** acima das baías ⇒ coluna à esquerda (320–400 px; 355 px em 1366)
- **Área de jogo por baía (1366×800, Grade, 4 baías):** 658×53 px ⇒ 470×276 px
- **Com o painel recolhido:** 626 px de largura por baía
- **Recolher painel:** o botão fica no cabeçalho do console, ao lado das abas. Recolhido, o inspetor vira uma faixa de 44 px; a faixa «Na grade» some junto, e a Disposição continua em Configurações
- **Abaixo de 1100 px:** o console fica acima das baías, com as três abas (medido em 1099, 900 e 760 px). Em 760×700, o topo das baías ⇒ y≈393 (antes y≈1004, fora da tela)
- **Fila e Coluna (1366×800, medido pelo tester):** 229×599 px e 954×128 px

#### Barra de comando
*Título, luzes e escopo numa linha só.*
Contexto: a barra de comando reúne o título da tela, a faixa de luzes e o escopo «Neste computador».
- **Altura (1366 e 900 px):** 36 px
- **Paradas:** acima de zero, em vermelho; zero, em cinza
- **Escopo «Neste computador»:** escondido abaixo de 900 px

#### Baías
*Cabeçalho enxuto, e as ações viram ícone quando a baía fica estreita.*
Contexto: em baías estreitas, o cabeçalho pesava e as ações tomavam espaço do nome. O layout agora segue a largura da própria baía.
- **Cabeçalho na grade:** 84 px ⇒ 59 px
- **Cabeçalho em coluna:** 35 px
- **Ações abaixo de 520 px de baía:** só ícone, com dica ao passar o mouse
- **Layout por largura da baía:** muda em 300, 520 e 680 px

### Espera
*As fichas entram em cascata, e nada se mexe sozinho.*
- **Entrada:** cascata de 300 ms, com atrasos de 0, 40, 80 e 120 ms entre as fichas
- **Sem loop:** nenhuma animação se repete

### Configurações
*O mesmo ritmo de entrada da Espera, nas fichas da tela.*
- **Entrada:** cascata de 300 ms, com atrasos de 0, 40, 80 e 120 ms; os blocos de desempenho e de bônus entram em 160 e 200 ms

### Dock
*A barra de baixo ficou mais baixa, e a aba ativa tem uma placa que desliza.*
- **Altura:** 60 px ⇒ 48 px
- **Placa:** desliza 138 px por aba (0, 138 e 276 px)

### Sistema visual (moldura, réguas, tipografia, movimento)
*Mesma paleta, outra estrutura: moldura, réguas, números e movimento.*
Referências: a skill `ui-ux-pro-max` e o designeer.xyz (moldura hachurada, régua tracejada, placa deslizante e curvas de easing).
- **Moldura:** faixa hachurada nas laterais, com régua. A hachura só aparece em área vazia: calhas, chão das baías e painel recolhido
- **Réguas:** tracejadas separam a estrutura; sólidas ficam dentro dos painéis
- **Números:** Cascadia Mono (fallback Consolas)
- **Tinta das abas:** acompanha a aba ativa, com erro de 0 px
- **Texto secundário no tema claro:** `--muted` a 70%, com contraste entre 5,6 e 6,1:1 nos elementos listados
- **Movimento:** dez animações sem loop; `prefers-reduced-motion` zera todas
- **Paleta:** não mudou

### Correções de bugs
- Entre 701 e 820 px, as baías ficavam fora da tela ⇒ console com abas em toda a largura.
- Tema claro: texto secundário com cerca de 4,3:1 ⇒ `--muted` a 70%, com 5,6 a 6,1:1 medidos.
- Painel recolhido sem como reabrir ⇒ botão Recolher/Abrir painel no cabeçalho do console.
- Livre: a alça de redimensionar cobria 18×4 px do canto inferior direito do jogo ⇒ o palco termina 2 px acima da alça (margem inferior de 14 ⇒ 20 px).
- Teclado: as setas nas abas com o painel recolhido não reabriam o painel ⇒ reabrem, como o clique.
- Animações repetidas: a classe de animação sai só no fim da própria animação e não acumula listeners.
- Limpeza: código morto removido (`ui.opFoldLabel` e `.btn.op-fold[data-icon]::before`).

### Arquivos de produto
`renderer/app.css`, `renderer/chrome.css`, `renderer/mesa.css`, `renderer/espera.css`, `renderer/ajustes.css`, `renderer/toggles.css`, `renderer/view.js`, `renderer/app.js`, `renderer/shell-fold.js`. `renderer/theme.generated.css` não mudou.

### Testes
- `npm test` em `dashboard/`: **60** passaram, **0** falharam.
- `node --check` OK em `view.js`, `app.js` e `shell-fold.js`.
- `theme.generated.css` igual ao anterior.
- Pré-visualização em 760, 900, 1099, 1100, 1366 e 1920 px, nos dois temas e nas três telas: sem overflow horizontal.
- Nada cobre o jogo, em Grade e Livre.
- Contraste ≥ 4,5:1 nos elementos listados, nos dois temas. O rótulo do dock deu 1,09:1 no claro, mas era artefato da pré-visualização, que congela a transição de cor; sem a transição, usa o `--muted` do claro. Verificado por leitura.

### Não confirmado
- Electron real: webviews redimensionando ao recolher o inspetor, e custo de GPU.
- `prefers-reduced-motion` emulado: verificado só por leitura do CSS.
- `animationend` nativo: testado na pré-visualização com evento sintético.
- Setas com teclado físico: não testadas.
- `docs/imagens/` continua desatualizado.

## 2026-11-03 — Mesa: verificar atualização corrigido e sliders mais legíveis

**O que mudou (o que você vê).**

- **Verificar atualizações** volta a funcionar quando sai versão nova. Antes, com release mais nova no GitHub, a checagem falhava e mostrava «Não foi possível verificar agora». Se já estiver na versão mais recente, a mensagem continua a mesma.
- Os controles **Usar poção abaixo de**, **Escala** e **Altura** ficaram maiores: trilho de 4 px preenchido em âmbar, bolinha de 16 px com aro âmbar, área de toque de 24 px e anel de foco visível pelo teclado.
- Os valores (50%, 88%…) têm largura fixa, então a linha não se mexe quando o número muda.

**Por quê.** Em `updater.js`, `app.isPackaged()` era chamado como função; no Electron é uma propriedade booleana, então a checagem lançava `TypeError`. Os sliders eram finos e a bolinha pequena.

**Arquivos de produto.** `src/main/updater.js` (`app.isPackaged`), `renderer/toggles.css` (`.limiar-range`), `renderer/mesa.css` (`.limiar .num`).

**Testes.** `npm test` em `dashboard/`: **60** passaram, **0** falharam. Teste do handler com Electron simulado: versão atual → «Você já está na versão mais recente.»; versão antiga → baixa o `Mesa.exe` da release, confere o tamanho e para na checagem de executável portátil, sem `TypeError`. Na pré-visualização, 1024 e 760 px: sem overflow horizontal.

**Não confirmado.** A substituição do `Mesa.exe` portátil em si (o teste para antes, para não sobrescrever o executável) e se o portátil roda de uma pasta temporária.

## 2026-11-03 — Mesa: disposição na tela principal, cabeçalho das baías e divisórias visíveis

**O que mudou (o que você vê).**

- A faixa **Na grade** (tela Automações) ganhou o grupo **Disposição** (Grade, Fila, Coluna, Livre). O botão ativo fica marcado; trocar ali troca também em Ajustes → Disposição, e vice-versa.
- **Cabeçalho das baías:** o nome «Baía N» fica em uma linha; quando falta espaço, Fechar/Tirar/Renomear descem para a linha de baixo, dentro da própria baía, em qualquer disposição. Nomes longos terminam em reticências (…) sem cortar as estatísticas. Antes, em Fila com 4 baías (~242 px), o nome quebrava em «B / 1» e os botões invadiam a baía vizinha.
- **Altura sem jogo:** o limite de 140 px foi removido; a baía cresce com o conteúdo quando o título quebra. Nos casos normais continua baixa (106–132 px).
- **Divisórias** entre baías (Grade, Fila, Coluna): em repouso viram uma régua fina (opacidade 0,3); destaque total no hover e no arraste. O arraste continua funcionando.
- Fora do Livre, a coluna «Baía em foco» mostra «Tamanho próprio por baía só no modo Livre.» acima de **Usar Livre**.

**Por quê.** O cabeçalho quebrava e os botões vazavam em baías estreitas; as divisórias eram difíceis de achar; trocar a disposição exigia ir a Ajustes.

**Patch notes.**

- **Disposição à mão** — agora dá para trocar Grade/Fila/Coluna/Livre direto na faixa «Na grade», sem abrir Ajustes. Por quê: troca mais rápida; os dois lugares ficam sempre iguais.
- **Cabeçalho que não quebra** — nome da baía em uma linha, botões descem se faltar espaço, nome longo vira «…». Por quê: em baías estreitas o nome partia e os botões invadiam a vizinha.
- **Baía sem jogo mais flexível** — sem teto de altura; cresce se o título quebrar. Por quê: o teto cortava as estatísticas.
- **Divisórias à vista** — régua fina sempre visível, forte ao passar o mouse ou arrastar. Por quê: antes era difícil saber onde arrastar.
- **Dica no Livre** — «Tamanho próprio por baía só no modo Livre.» acima de «Usar Livre». Por quê: explica por que os controles de tamanho estão apagados.

**Dados.** Sem mudança de configuração: config salva mantém a mesma disposição; o layout padrão continua o mesmo.

**Arquivos de produto.** `renderer/mesa.css`, `renderer/view.js` (`mountLayoutJoin`; o join de Ajustes passou a usá-la), `renderer/slots.js` (grupo «Disposição», `ui.layoutsBar`), `renderer/app.js` (sincronia), `renderer/bay-size.js` (texto da dica), `renderer/theme.generated.css` (regenerado pelo build).

**Testes.** `npm test` em `dashboard/`: **60** passaram, **0** falharam. No navegador de pré-visualização (viewport emulado de 1024 px e 760 px): cabeçalho em uma linha; estatísticas, nome e ações dentro das baías nas quatro disposições; nome longo com reticências; sem overflow horizontal; troca sincronizada nos dois sentidos; régua com opacidade 0,3 em repouso e 1 no hover.

**Não confirmado.**

- Baía com jogo carregado (webview pintado) **não** foi vista; só o estado sem jogo.
- O Electron (executável ou `npm start`) **não** foi aberto nesta entrega.
- O contraste numérico da régua e da dica no tema claro **não** foi medido; só avaliação visual.

## 2026-11-03 — Build do Mesa.exe com a disposição na faixa Na grade

- `npm run dist -- --config.directories.output=dist-nova` gerou `dist-nova/Mesa.exe` (versão 0.3.2), com a disposição na faixa «Na grade», o cabeçalho em uma linha e as divisórias visíveis.
- O build saiu em `dist-nova/` porque `dist/Mesa.exe` estava em uso pelo app aberto, e o empacotamento falhou ao escrever sobre ele. A configuração do projeto não foi alterada.
- Para usar a versão nova: feche o Mesa aberto, copie `dist-nova/Mesa.exe` por cima de `dist/Mesa.exe` (ou use direto de `dist-nova/`).
- `npm test`: **60** passaram, **0** falharam, antes do build.
- O executável **não** foi aberto para teste de fumaça, pelo mesmo motivo da entrega anterior.

## 2026-11-03 — Build do Mesa.exe portátil

- `npm run dist` gerou `dist/Mesa.exe` (versão 0.3.2) a partir do código com o redesenho visual e a disposição Livre. A pasta `dist/win-unpacked/` foi atualizada junto.
- `npm test` antes do build: **60** passaram, **0** falharam.
- O executável **não** é assinado. O build não define ícone próprio, então o Windows mostra o ícone padrão do Electron.
- **Não** abri o executável nem rodei um teste de fumaça, para não mexer nas sessões reais guardadas em `%AppData%\Mesa`. Vale abrir uma vez e conferir.

## 2026-11-03 — Mesa: tamanho próprio de cada baía (disposição Livre)

**O que mudou (o que você vê).**

- **Nova disposição "Livre"** em Ajustes → Disposição. Nela, cada baía tem a própria largura (de ¼ a inteira, em colunas de 12) e a própria altura.
- **Alça no canto inferior direito** de cada baía: arraste para mudar largura e altura só daquela baía. Com o teclado: setas ajustam, Início volta para a altura automática.
- **Coluna "Baía em foco"** ganhou **Largura** (atalhos ¼, ⅓, ½, ⅔, ¾, Tudo) e **Altura** (controle de 120 a 800 px, ou Automática). Fora do modo Livre, os controles aparecem apagados com o botão **Usar Livre**.
- **Grade, fila e coluna** não mudaram. As divisórias que mexiam em colunas inteiras continuam ali, mas só nesses três modos.

**Limites.** Abaixo de 700px as baías empilham, uma por linha, com altura pelo conteúdo. Em janelas estreitas, uma baía de ¼ tem o cabeçalho em duas linhas.

**Dados.** Nova chave `box` em cada baía (`{ span, h }`), normalizada em `shared/catalog.js`. Config antiga ganha span 6 e altura automática, o equivalente visual da grade 2×2 atual.

**Arquivos.** `shared/catalog.js` (disposição e normalização), `shared/catalog.test.js` (5 testes novos), `renderer/bay-size.js` (novo: alça, teclado e controles de tamanho), `renderer/bay-split.js` (sem divisórias no Livre), `renderer/view.js` e `renderer/app.js` (ligações), `renderer/index.html`, `renderer/icons.js` (ícone do Livre), `renderer/mesa.css` e `renderer/chrome.css`, `README.md`.

**Testes.** `npm test`: **60** passaram (eram 55), **0** falharam. No preview estático: arraste da alça em uma baía (span e altura ajustados com precisão, as outras baías intactas), teclado (span limitado entre ¼ e inteira, altura de 20 em 20 px, Início volta para automática), abas com a mesma altura, e nenhum overflow horizontal em 760px e 600px. **Não** foi aberto o Electron, e a baía com jogo carregado não foi pintada: o encaixe do webview no tamanho novo não foi visto.

**Observação não resolvida.** Numa primeira tentativa de arraste, a Baía 2 mudou de tamanho sem eu entender a causa. Não consegui reproduzir: arrastes seguintes, pela alça e fora dela, mudaram só a baía certa.

## 2026-11-03 — Mesa: redesenho visual completo (painel de hangar)

**O que mudou (o que você vê).**

- **Nova identidade:** preto-oliva com osso, e âmbar como único sinal. Tipografia em Bahnschrift, a fonte do próprio Windows. Frases em caixa normal, sem maiúsculas nos rótulos.
- **Faixa de luzes** no lugar dos quatro cartões de KPI: uma régua com a luz de cada estado (caçando cheia e verde, medindo em anel azul, parada cheia e vermelha, sem sessão apagada). Os ícones saíram.
- **Cabeçalho de tela** com o nome da seção (Automações, Espera ou Configurações) e o escopo "Neste computador". Antes o título ficava escondido.
- **Baías** são painéis com a luz de estado na borda esquerda. O estado tem texto na cor da luz.
- **Espera:** cada ficha tem régua de estado no topo. Marcas de tipo ficaram neutras, sem cor por baía.
- **Ajustes:** fichas em lista, com título e régua. O título repetido saiu.
- **Dock:** a aba ativa tem régua âmbar no topo.
- **Tema claro** redesenhado como papel de bancada, com âmbar mais escuro para texto.
- **Botões:** raio pequeno e fundo quase sólido. Âmbar só na ação principal. Entrar com Google usa osso. Sair da conta é contorno vermelho.

**Correção de bug antigo.** O token `--border` estava redefinido como cor no `app.css`, e o DaisyUI o usa como comprimento. Por isso os interruptores tinham 6px de largura e não apareciam direito. Removi a redefinição.

**O que não mudou.** Comportamento: caça, login, IPC, sniper, escala, mudo, economia, igualar, grade, divisórias e abas. Só três marcações JS foram tocadas: o cabeçalho visível em `view.js`, o `data-tone` na baía (`app.js`) e na ficha da Espera (`standby.js`).

**Arquivos.** `theme.css` (tokens dos dois temas), `app.css`, `chrome.css`, `toggles.css`, `mesa.css`, `espera.css`, `ajustes.css`, `live-bonus.css`, `theme.generated.css` (via `npm run build:css`), `view.js`, `app.js`, `standby.js`, `design-system/mesa/MASTER.md` e as páginas em `design-system/mesa/pages/`.

**Testes.** `npm test`: **55** passaram, **0** falharam. `node --check` nos três JS alterados. No preview estático (`http://127.0.0.1:8765/renderer/index.html`) conferi as três telas nos dois temas em 1024×768 e 1440×900, e a largura de 760px sem overflow horizontal. **Não** foi aberto o Electron, e nenhum webview de jogo foi pintado: o estado "caçando" e as baías com jogo carregado não foram vistos na tela.

**Limite.** `docs/projeto.md` ganhou uma nota dizendo que os trechos de cartões e cores estão defasados. O documento completo ainda não foi reescrito. `docs/imagens/` continua com as capturas antigas.

## 2026-11-03 — Mesa: abas na operação, cores por status, rótulo Espera

**O que mudou (o que você vê).**

- **Abas na barra de operação** (acima de 820px): Automações, a baía em foco (nome da baía) e Conta. Só uma seção fica visível por vez. Isso tira a barra de operação de 259px para cerca de 200px e a altura não muda ao trocar de aba. Abaixo de 820px as três colunas empilham como antes, sem abas.
- **Acento azul único:** sliders, borda da baía em foco, anel de foco e o botão Entrar com Google usam `--color-accent`. Antes havia azuis em hex espalhados.
- **Verde só para estado positivo** (ligado, caçando). Os ícones de Mudo, Economia e Ultra ficaram neutros.
- **Vermelho só para erro:** o botão **Abrir** deixou de ser vermelho e passou a claro, como manda o `design-system/mesa/MASTER.md`.
- **Ícones de KPI** seguem o status da baía (verde, azul, vermelho, neutro) e perderam o brilho colorido.
- **Lateral:** o rótulo «Home» virou «Espera», igual ao nome usado nas outras telas.

**O que não mudou.** Caça, login, IPC, sniper, escala, mudo, economia, igualar, a grade e os estados de baía. Os toggles já mostravam «Ligado» / «Desligado» e o ícone de Espera já era a casa; nada disso mudou.

**Por quê.** A barra de operação tinha todos os controles visíveis ao mesmo tempo, e as cores de status tinham cinco significados diferentes (neon, verde, vermelho, dourado e azul).

**Arquivos.** `dashboard/src/renderer/theme.css` (tokens: primary, success), `theme.generated.css` (`npm run build:css`), `toggles.css`, `app.css`, `chrome.css`, `mesa.css`, `espera.css`, `view.js` (abas e `setOpTab`), `app.js` (título da aba da baía em foco e rótulo «Espera»), `design-system/mesa/MASTER.md`.

**Testes.** `npm test` em `dashboard/`: **55** passaram, **0** falharam. Prova no navegador estático (`http://127.0.0.1:8765/renderer/index.html`, pasta `dashboard/src`), viewport 1024×768: abas trocam a seção visível; altura da barra igual nas três abas (204px, antes 259px); sem overflow horizontal em 760px, onde as abas somem. **Não** foi aberto o Electron nem um jogo real: o preview usa os valores de pré-visualização da casca.

**Limite.** O `docs/imagens/` ainda mostra uma versão antiga (lateral só com ícones, sem abas). Trocar as imagens fica para a próxima rodada. O botão **Abrir** claro não foi visto no preview, porque nenhuma baía estava aberta; a mudança vem do token `--color-primary`.

## 2026-10-31 — Mesa: Mudo cala a baía em foco

**O que mudou (o que você vê).**

- O interruptor **Mudo** da coluna da **baía em foco** (não a cor CSS `--muted`) passa a **calar o áudio** daquela conta: ligado pede silêncio **só** no webview dessa baía; desligado pede o áudio **só** nela.
- Ao **recarregar** a baía ou quando o webview fica pronto de novo, o mesmo mudo **volta a valer** — recarregar **não** devolve o som se **Mudo** continua ligado; se está desligado, o áudio é pedido como ligado.
- **Um clique, um estado:** no Electron, um clique no rótulo **Mudo** alternou `checked` e `aria-checked` uma vez; o segundo clique restaurou (sem handler extra — o controle já é um `label` em volta do checkbox e o `change` dispara).
- A preferência **`cfg-som`** (`'0'` mudo, `'1'` ligado) **continua** indo em `pushPrefs` e sendo lida no `bay:prefs` do processo principal, para o jogo seguir a preferência no `localStorage`. As **outras baías** não são silenciadas por esse gesto.

**O que não mudou.** Escala, caça, login, dock, redimensionamento das baías, visual dos toggles, preload além do que já gravava `cfg-som`. Sem commit.

**Por quê.** O **Mudo** da coluna do meio tinha de **mutar de fato** o webview da baía selecionada, sem afetar as demais baías abertas e sem perder o estado ao recarregar.

**Arquivos de produto.** `dashboard/src/renderer/bay-audio.js` (novo: `MesaBayAudio.calls` devolve no máximo uma chamada, só do índice pedido), `dashboard/src/renderer/bay-audio.test.js` (novo), `dashboard/src/renderer/app.js` (`applyBayAudioMute` + chamada no `dom-ready`), `dashboard/src/renderer/view.js` (`change` do Mudo chama `applyBayAudioMute(cfg.selected)`), `dashboard/src/renderer/index.html` (script antes de `app.js`), `dashboard/package.json` (teste no script `test`).

**Testes.** `npm test` em `dashboard/`: **55** passaram, **0** falharam, incluindo `MesaBayAudio.calls`: baía em foco muda → a lista é só `{ index daquela baía, muted: true }` (pede áudio mudo); baía em foco com som → `{ muted: false }` (pede áudio ligado); a outra baía, mesmo muda, **não** entra na lista quando o índice pedido é o da baía em foco. Electron aberto (`npm start`, porta de depuração **9223**): baía em foco era o índice **1**; **Mudo** começou ligado (`checked` e `aria-checked` true); um clique no rótulo **Mudo** desligou os dois; o segundo clique restaurou, para não gravar a config invertida. Havia **2** webviews em `https://pokeidle.io/app`; a função `applyBayAudioMute` estava no runtime. **Não** foi observado `setAudioMuted` no webview em execução — **não** afirmar que o áudio do jogo foi ouvido calar. O que prova a regra de “só a baía pedida” é o teste unitário da função pura mais o call site, que só chama `setAudioMuted` para os itens dessa lista. Revisor: **sem** achado obrigatório.

## 2026-10-31 — Mesa: várias baías com jogo aberto

**O que mudou (o que você vê).**

- Na **Mesa**, cada baía **aberta** com **jogo carregado** mantém o **quadro do jogo visível** ao mesmo tempo — não some só porque você clicou em outra baía.
- **Clicar** numa baía agora só muda o **foco**: borda de **acento** na selecionada e os controles da **coluna do meio** (automações, **Mudo**, **Escala**) seguem a baía em foco. A que perdeu o foco **continua** mostrando o jogo; o processo **não** é encerrado — antes quem “fechava” era a **área visível**, não o jogo em si.
- Baía **fechada** ou **sem jogo pintado** continua **só com o cabeçalho**, **baixa**, **sem** esticar um quadro vazio.
- A **grade** reparte a **altura** em linhas flexíveis quando existe **pelo menos uma** baía pintada (`.bays:has(.bay.is-painted)`). Baía sem jogo **não** estica. A **alça de redimensionar a altura** (`.bay-split-sep.is-row`) aparece quando **há** baía pintada — não só quando a selecionada é a única com quadro.
- Cada jogo continua no **próprio** `.bay-stage` da baía.

**O que não mudou.** Caça, login, IPC, áudio da baía em foco (`tuneBays`), dock, toggles, **Na grade**, **Escala**, **Capturas**. Sem commit.

**Por quê.** Permitir acompanhar **mais de uma** conta com o jogo na tela ao mesmo tempo, deixando **seleção** só para foco e operação, sem recolher o stage das outras baías pintadas.

**Arquivos de produto.** `dashboard/src/renderer/mesa.css`, `dashboard/src/renderer/app.js` (`paintBay`: visibilidade do webview segue baía aberta com jogo, não a seleção).

**Testes.** `npm test` em `dashboard/`: **51** passaram, **0** falharam. Sem sessão de jogo real no Electron. Prova no navegador estático (`http://127.0.0.1:18924/renderer/index.html`, pasta `dashboard/src`): duas baías pintadas, só uma selecionada — `.bay-stage` das duas: **212px** e **212px** ao mesmo tempo. Depois do clique que troca a seleção, a que perdeu o foco continuou **212px**. Baía sem `is-painted`: stage **0px**, `max-height: 140px` (altura do cartão ~**84px** naquela grade). Foto: `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\duas-baias.png` (**150496** bytes). Electron **não** foi aberto (não havia duas sessões com jogo). **Não** afirmar que o webview guest foi medido no Electron.

2026-10-31 — Ícones dos cartões: Caçando é uma mira; Medindo é um velocímetro; Paradas são duas barras de pausa; Sem sessão é uma pessoa cortada por um traço.

## 2026-10-31 — Mesa: redimensionar baías pela borda

**O que mudou (o que você vê).**

- Na **Mesa**, com **duas ou mais baías** na grade e janela **mais larga que 700px**, dá para **pegar a borda compartilhada** entre duas baías: o cursor vira **redimensionar coluna** ou **linha**; ao **passar o ponteiro** ou **arrastar**, aparece uma **linha fina** na cor de **acento** — em repouso **não** fica uma grade permanente.
- **Arrastar** muda **na hora** a largura (layout **grade**, **fila** ou **coluna**). A **altura** só quando há **jogo pintado** e a faixa tem altura livre; **sem jogo pintado** a alça de **linha** continua **oculta** e a baía vazia **não estica**.
- **Soltar** grava a proporção em **`cfg.bayWeights`** — **não** mexe no slider **Escala** por baía.
- **Duplo clique** ou **Enter** na borda **iguala** as baías daquele eixo; com a alça em foco, **setas** movem cerca de **5%**.
- A faixa de pegada tem **pelo menos 8px** e **para antes** dos botões **Fechar**, **Tirar** e **Renomear**.
- Abaixo de **700px** a alça **some**, como já era.

**O que não mudou.** Caça, login, IPC, dock, toggles DaisyUI, **Na grade**, cartão de operação, **`zoom.js` / Escala**, layout **fila** / **coluna** / **grade** fora do gesto de peso. Sem mascote.

**Por quê.** Deixar o jogador ajustar quanto cada baía ocupa na grade sem misturar isso com o zoom do jogo, com alça visível só perto da borda e persistência separada em **`bayWeights`**.

**Arquivos de produto.** `dashboard/src/renderer/mesa.css`, `dashboard/src/renderer/bay-split.js`.

**Testes.** Navegador estático `http://127.0.0.1:8765/renderer/index.html`, viewport **1600×900**, **sem jogo pintado**: antes `--bay-cols` = `minmax(0, 1fr) minmax(0, 1fr)`; colunas computadas **776px** e **776px**. Depois do arrasto da alça vertical: `minmax(0, 1.2051282051282053fr) minmax(0, 0.7948717948717947fr)`; colunas **935px** e **617px** (aprox.). Duplo clique / **`baySplitEqualAxis`**: voltou a **1fr** / **1fr** e **776px** / **776px**. Alça vertical com **8px**, visível; alça de linha **`display: none`** sem baía pintada; **Fechar**, **Tirar** e **Renomear** sem sobreposição. Foto única: `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\bay-resize.png` (**682×527**, cerca de **114 KB**) — duas colunas com larguras diferentes e linha fina de acento no meio do arrasto. `npm test` em `dashboard`: **51** passaram, **0** falharam, inclusive **`catalog.test.js`** de **`bayWeights`**. **Electron:** aberto só para empilhamento, **sem arrastar** (para não gravar a config do usuário); **sem jogo pintado** havia **0** webviews e o stage com **altura 0**; **`elementFromPoint`** no centro da alça **não** devolveu elemento — **não dá para afirmar** se a alça ficaria sob um webview com jogo aberto. Servidor e Electron fechados. Revisor: **sem** achado obrigatório.

## 2026-10-31 — Mesa: dock, toggles DaisyUI e Na grade

**O que mudou (o que você vê).**

- **Mesa**, **Espera** e **Ajustes** deixam o trilho lateral e passam para um **dock** DaisyUI no **rodapé** da janela — **dentro** da grade (conteúdo em cima, menu embaixo), **sem** flutuar por cima do jogo.
- No dock: ícones de traço que já existiam, **nome visível** em cada atalho e destaque **`dock-active`** na tela aberta. **Sem** coração, **sem** desligar o app. A **logo** saiu dessa faixa.
- Em janela estreita (**≤700px**), o dock **continua** no rodapé. **Não há** botão de recolher trilho na navegação.
- **Interruptores** (automações, mapa automático, **Mudo**, **Economia**, **Ultra**, modo noturno, otimizado, rastreadores, sniper): **toggle** DaisyUI — desligado cinza do tema, ligado **verde**; **Ligado** / **Desligado** ao lado. **Um clique, um estado.**
- Na **Mesa**, linha **Na grade** com **quatro checkboxes** (**Baía 1** a **Baía 4**): marcado = baía na grade; desmarcado = fora (o mesmo que **Tirar** / voltar). Se só **uma** estiver marcada, esse checkbox **não dá** para desmarcar. **Fora da grade** e **Tirar** seguem iguais.
- Na **Espera**, seção **Capturas** **acima** dos quatro cartões: aviso **«Nenhuma captura registrada nesta sessão.»** — **sem** lista de Pokémon e **sem** mascote.

**O que não mudou.** Caça, login, IPC, KPIs no topo, cartão de operação (três colunas), `zoom.js` / **Escala**, grade e baías, histórico de XP na Espera, **Ajustes**, tema **Escuro** / **Claro** só em Ajustes. Sem mascote na casca.

**Por quê.** Usar **dock** e **checkbox** DaisyUI na casca, manter o menu no rodapé **dentro** do layout (não `fixed` sobre o jogo) e deixar claro que capturas **ainda não** têm evento no preload.

**Arquivos de produto.** `dashboard/src/renderer/app.css`, `view.js`, `app.js`, `toggles.css`, `slots.js`, `standby.js`, `theme.css`, `theme.generated.css`, `chrome.css`.

**Testes.** Navegador estático `http://127.0.0.1:8765/renderer/index.html`, **1600×900**: dock **`position: static`** em **(0, 834.9, 1600×65.1)**, sem cruzar cartão de operação (bottom ~**427**) nem baía. Fotos: `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\dock-mesa.png` (**324332** bytes), `dock-espera.png` (**256827** bytes). Checkbox **Baía 2** tirou e devolveu a baía; última marcada **disabled**. **Mudo** ligado fundo `oklch(0.7 0.09 155)`, desligado `oklch(0.27 0.018 260)`. Alerta da Espera com texto vazio, sem nome de Pokémon. `npm test` em `dashboard`: **51** passaram, **0** falharam. Electron depois: dock no rodapé, webviews das baías visíveis **não** cobertos; servidor e Electron fechados. Revisor: **sem** achado obrigatório.

## 2026-10-31 — Mesa: botões da baía acima dos números

**O que mudou (o que você vê).**

- Na foto larga, **Fechar**, **Tirar** e **Renomear** deixam de ficar na faixa de **Nv**, **XP/h**, **Ouro** e **RAM**.
- **Linha 1:** nome, **sem sessão** (ao lado do nome) e os **três botões**. **Linha 2**, **8px** abaixo, é **só** os **quatro números**.
- Medido na primeira baía em **1600×900:** `actions.top` **396,4**; `actions.bottom` **418,4**; `stats.top` **426,4**; `stats.bottom` **466,4**. **Fechar** não cruza **Ouro**.

**O que não mudou.** Atalhos inteiros, **Recarregar** sob **Sair**, baía **baixa**, **Espera**, **Ajustes**.

**Por quê.** Separar no DOM e no CSS o cabeçalho de ações dos KPIs, com folga fixa de **8px**, para os botões não compartilharem a faixa dos números.

**Arquivos de produto.** `dashboard/src/renderer/mesa.css`, `view.js` (cabeçalho só com nome, status e botões; números no bloco de baixo).

**Testes.** `npm test` em `dashboard`: **51** passaram, **0** falharam. Foto: `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\browser-mesa-1600.png` (**1600×900**).

## 2026-10-31 — Mesa: números da baía fora da linha dos botões

**O que mudou (o que você vê).**

- Em **1600×900**, **Nv**, **XP/h**, **Ouro** e **RAM** tinham caído na **mesma linha** de **Fechar**, **Tirar** e **Renomear** e se **cruzavam**.
- Agora, em **qualquer largura**, a **linha 1** é o nome, **sem sessão** e os **três botões**; a **linha 2** é **só** os **quatro números**. A folga medida entre o fundo de **Fechar** e o topo de **Nv** foi **4px**, **sem sobreposição**.

**O que não mudou.** Atalhos inteiros, **Recarregar** logo abaixo de **Sair**, baía **baixa**, cartão na **altura do conteúdo**, **Espera**, **Ajustes**, `zoom.js` e o interruptor.

**Por quê.** Corrigir o cruzamento dos KPIs da baía com os botões de ação na entrega anterior, em resoluções como **1600×900**.

**Arquivos de produto.** `dashboard/src/renderer/mesa.css`.

**Testes.** `npm test` em `dashboard`: **51** passaram, **0** falharam. Foto única regravada: `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\browser-mesa-1600.png` (IHDR **1600×900**). Sem Electron nesta rodada.

## 2026-10-31 — Mesa: atalhos inteiros e botões no lugar

**O que mudou (o que você vê).**

- **Atalhos Mapa / Pokédex / Depot / Boss / Market:** os **cinco nomes inteiros** numa linha, com folga; se o meio aperta, a **coluna do meio cresce** — **sem reticências**.
- **Conta:** **Recarregar** e **Igualar as quatro** logo **abaixo de Sair da conta**, à **direita**; sumiu o vão que empurrava esse par para o **fundo** da coluna.
- **Baía em foco:** **Fechar**, **Tirar** e **Renomear** na **mesma linha** do nome da baía; **Nv**, **XP/h**, **Ouro** e **RAM** na linha de baixo.
- **Mudo**, **Economia** e **Ultra** logo **abaixo da barra** de atalhos, com a **palavra inteira**; o meio da coluna pode ficar **vazio** — **sem mascote**.
- **Cartão de operação:** as **três colunas** terminam **juntas**, na altura de **Automações**; o cartão **não estica** com a janela. Baía **sem jogo** continua **baixa** (medida **~80px**, sem vão interno). O **fundo escuro** abaixo dos cartões, em janela alta, **continua**.

**O que não mudou.** **Espera** e **Ajustes**. `zoom.js` e o fator **Escala** — um clique no interruptor continua **um estado**, via `setChecked`. Caça, login e IPC; **sem mascote** e **sem curva falsa**. Baía **com jogo pintado:** o webview segue **de borda a borda** no CSS (`inset: 0`); nesta rodada **não havia sessão pintada no Electron**, então o miolo com jogo **não foi medido ao vivo**.

**Por quê.** A foto anterior **esmagava** os atalhos (`min-width: 0` e `flex-shrink` nos botões, e a coluna do meio ainda perdia o `min-width` para a regra genérica) e deixava **Fechar** e **Recarregar** fora do lugar do print.

**Arquivos de produto.** `dashboard/src/renderer/mesa.css`, `view.js`, `toggles.css`.

**Testes.** `npm test` em `dashboard`: **51** passaram, **0** falharam. Navegador, fotos **únicas** (não mosaico), IHDR conferido: `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\browser-mesa-1600.png` (**1600×900**), `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\browser-mesa-1024.png` (**1024×572**). Nas duas: cinco nomes inteiros, **Recarregar** logo abaixo de **Sair**, **Fechar** na linha do nome. A primeira captura de **1600** tinha saído **1104×610** e foi regravada; a que vale é a de **1600×900**.

## 2026-10-31 — Mesa: grade compacta sem jogo pintado

**O que mudou.** Sem jogo pintado, cada baía fica na **altura do conteúdo** (medida **~104px** em **1600×900**); a grade **não estica** as linhas — o espaço que sobra fica **abaixo** dos cartões. A **linha divisória do meio** (`.bay-split-sep.is-row`) **some** nesse estado. Com jogo pintado na baía selecionada, ela **continua crescendo** para preencher a faixa (`mesa.css`: `:has(.bay.is-selected.is-painted)` vs `:not(:has(...))`).

**Por quê.** Evitar cartões ociosos esticados na célula da grade 2×2 mantendo o comportamento anterior quando o stage abre.

**Arquivos de produto.** `dashboard/src/renderer/mesa.css`.

**Testes.** `npm test` em `dashboard`: **51** passaram, **0** falharam. Evidência visual (navegador, **1600×900**): `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\browser-mesa-1600.png`.

## 2026-10-31 — Mesa: palco cheio e baía baixa

**O que mudou (o que você vê).**

- Com jogo na baía selecionada, a **caixa do jogo** passa a ocupar **100%** do palco — não mais uma largura/altura em pixel que podia ficar menor e deixar **faixa preta** nas bordas.
- Baía **sem jogo pintado** fica **baixa**: nome, status, Nv, XP/h, Ouro, RAM e **Fechar** / **Tirar** / **Renomear** — **não** estica num cartão vazio.
- **Recarregar** e **Igualar as quatro** ficam **menores**, à **direita** no pé da coluna **Conta**.
- O **cartão de operação** **não** ganha **vão extra** no meio (Baía em foco: barra de atalhos e **Mudo** / **Economia** / **Ultra** em sequência).

**O que não mudou.** Caça, login, IPC e o fator **Escala** por baía. Sem mascote.

**Por quê.** Preencher o palco sem barras pretas, manter baías ociosas compactas e não inflar a operação.

**Arquivos de produto.** `dashboard/src/renderer/zoom.js`, `mesa.css`.

**Testes.** `npm test` em `dashboard`: **51** passaram, **0** falharam. No **navegador** (**1600×900** e **1024×572**), PNG gravado de novo — **uma tela** por tamanho (não o mosaico antigo). Nesta rodada no **Electron**, o jogo **não chegou a pintar**: palco e webview mediram a mesma caixa com **altura 0**; a captura **final8** **não** mostra o jogo preenchendo a baía.

## 2026-10-30 — Mesa: cartão de operação alinhado à referência

**O que mudou (só a casca da Mesa).**

- **Automações:** cada linha mostra o **nome à esquerda**; à **direita**, **Ligado** ou **Desligado**, selo **VIP** ouro só em **Lançar até capturar** e **Lançar sem parar**, e o **interruptor pílula** — não é mais um bloco quadrado.
- **Poção** e **Escala:** sliders **um embaixo do outro**, com o **thumb** visível; o aviso do **mapa automático** vem **depois** dos dois.
- **Mudo**, **Economia** e **Ultra** ficam no **pé** da coluna do meio. **Entrar com Google**, **Já entrei** e **Sair** no **topo** da coluna da direita; **Recarregar** e **Igualar** no **pé**, separados por um **divisor**.
- O **cartão de operação** **não estica** com a janela: em **1600×900** a altura medida foi **~259px** (cerca de um terço da faixa das baías).
- Entre a barra **Mapa / Pokédex / Depot / Boss / Market** e **Mudo / Economia / Ultra**, o meio da coluna fica **vazio de propósito** (sem mascote).
- Abrindo a página da Mesa **no navegador**, sem Electron, a casca **pinta** e os botões **aparecem** (pré-visualização; o jogo real continua no app).

**O que não mudou.** Caça, login, IPC e o fator **Escala** por baía. Sem mascote, coração, desligar o app, **Lançar sem encurtar** nem curva de XP **12h–18h**.

**Por quê.** Aproximar o cartão de operação e os interruptores aos prints de referência, sem mexer na lógica do jogo.

**Arquivos de produto.** `dashboard/src/renderer/app.js`, `view.js`, `mesa.css`, `toggles.css`, `index.html`.

**Testes.** `npm test` em `dashboard`: **51** passaram, **0** falharam. No navegador (**1024×572** e **1600×900**), antes do Electron: trilho, quatro KPIs, cinco atalhos na mesma linha, VIP à direita do nome, Google visível, cartão sem ocupar a janela. PNG do navegador em `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\` ficaram **repetidas** e **não** servem como foto. Electron depois: `final7-mesa-1600.png` (casca + jogo na baía em foco); processo fechado ao fim.

## 2026-10-30 — Mesa: operação compacta e baías preenchem a janela

**O que mudou (só layout da Mesa).**

- O **cartão de operação** (Automações, baía em foco, Conta) volta à **altura do conteúdo**: não estica mais, não deixa **vão vazio** no meio da janela e **não rola por dentro**.
- A **faixa das baías** ocupa o que sobra **abaixo** desse cartão — inclusive com janela **larga** ou **maximizada**, sem espaço morto entre operação e grade.
- Cada baía **preenche a célula**. Com baía aberta e jogo na tela, a grade **2×2** usa a altura disponível: **cabeçalho** em cima e o **jogo de borda a borda** no resto do cartão. O slider **Escala** continua igual, dentro da página.
- Baía **sem jogo** continua **sem xadrez** e **sem tracejado**; o miolo vazio é só o fundo do cartão.
- Em **1024×572**, os **dois** cartões de baía ainda aparecem. Se a altura não chegar, **rola a área das baías** — **não** o cartão de operação. Isso **inverte** o que a entrada **«Paridade visual da casca (1024×572)»** descrevia (lá, faltando altura rolava o cartão de operação).
- **KPIs:** quatro cartões com número e ícone **legíveis** (como antes).

**O que não mudou.** `zoom.js`, caça, login, IPC, histórico, **Espera**, **Ajustes**. Sem mascote, sem curva falsa.

**Por quê.** Dar ao jogo o espaço vertical da janela e tirar o vão entre operação e baías, sem mexer na lógica das baías nem no restante da casca.

**Arquivos de produto.** `dashboard/src/renderer/mesa.css`.

**Testes.** `npm test` em `dashboard`: **51** passaram, **0** falharam. Janela Mesa, área de cliente **1024×572** e **1600×900**: sem vão entre operação e baías na larga; webview com jogo (`pedrao_farm`) encosta nas bordas do cartão; baía sem jogo (`pedrao_r`) com fundo sólido; os dois cartões visíveis em **1024×572**; KPIs legíveis (~**50** px em **1024**, ~**105** px em **1600**). Evidência visual (ambiente de teste, não artefato do app): `final6-mesa-1024.png` e `final6-mesa-1600.png` em `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\`.

## 2026-10-30 — Espera: cartões sem sobreposição (1024×572)

**O que mudou (só na tela Espera).**

- Os **quatro cartões** deixam de se sobrepor; o **gráfico** e o botão **Ver jogo** da linha de cima ficam **dentro** do próprio cartão e **não** cobrem o nome da **Baía 3** nem da **Baía 4**.
- A **grade** usa linhas na altura do conteúdo; se os quatro cartões não couberem em **1024×572**, a **grade rola**.
- O **plot** na coluna direita continua com **~140px**. Sem histórico, **«Sem histórico ainda»** fica **dentro** do retângulo. Com histórico real, a **área** e as **horas** seguem os dados — **sem** curva inventada **12h–18h**.

**O que não mudou.** Mesa, Ajustes, caça e login.

**Por quê.** Corrigir vazamento visual dos cartões superiores sobre os inferiores na Espera, sem alterar o restante da casca.

**Arquivos de produto.** `dashboard/src/renderer/espera.css`.

**Testes.** `npm test` em `dashboard`: **51** passaram, **0** falharam. Evidência visual (ambiente de teste, não artefato do app): `final5-espera.png` em `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\`.

## 2026-10-30 — Paridade visual da casca (1024×572)

**O que mudou (o que o jogador vê).**

**Mesa**
- Baía **sem jogo na tela** vira cartão **baixo** (~110px): nome e status na mesma linha, Nv, XP/h, Ouro, RAM, Fechar, Tirar, Renomear — **sem** xadrez, caixa tracejada nem «Abrindo o jogo» ocupando espaço.
- A área do jogo **só abre** na baía **selecionada** depois que o jogo **pintou** (`state` com `phase === 'jogo'`); `dom-ready` sozinho **não** abre o stage. O `<webview>` continua no DOM.
- Recarregar, falha de carga, queda do processo ou sair da conta (`forgetBay`) **zeram** `painted` e o cartão volta baixo até o próximo `state`; o webview **não** é destruído nesses caminhos.
- Em **1024×572**, os dois cartões baixos cabem inteiros; se faltar altura, **rola** o cartão de operação, **não** as baías.
- KPIs com traço **grosso** e brilho: **pegadas** (Caçando), **livro-dex** (Medindo), **alvo** (Paradas), **busto** (Sem sessão). Na **Espera** a linha fica mais baixa (~52px); na **Mesa**, ícones ~44px.
- Logo do trilho: **anel neon** (~36px) — vermelho em cima, azul embaixo, linha no meio, miolo claro.
- Mapa, Pokédex, Depot, Boss e Market numa **barra só**.
- Sliders de **poção** e **escala**: trecho percorrido em azul, thumb em **bola**.
- **Mudo**, **Economia** e **Ultra**: rótulo, ícone e **Ligado**/**Desligado** — sem bloco quadrado.
- Fundo em gradiente **azul-petróleo**; cartões **translúcidos**, borda fina, raio ~14px. Tema claro e `prefers-reduced-motion` seguem valendo.

**Espera**
- Corpo em **duas colunas**: esquerda ~**32%** (Nível, Mapa, Memória, Ver jogo); direita com Ouro, XP/h e plot ~**140px**.
- Com **menos de dois** pontos reais: plot grande, **linha de base** no SVG e «Sem histórico ainda» **dentro** do plot — o SVG **não** some.
- Com **dois ou mais** pontos: área na cor da baía e horas **reais** do histórico — **sem** curva inventada 12h–18h.
- O desenho **não vaza** para o cartão de baixo; se os quatro cartões não couberem, a **grade rola**.
- Ícones de tipo: gota, folha, fantasma, estrela.

**Ajustes**
- Layout **não** redesenhado nesta rodada. Sniper desligado esconde teto e nomes; nota «Sniper desligado nesta baía.» Modo noturno mostra só o estado atual.

**Fora da casca (inalterado nesta entrega)**
- Sem mascotes, sem coração, sem desligar o app, sem rótulo «Lançar sem encurtar».
- **Sair da conta** continua em **dois passos**; **Cancelar** desarma e **não** conclui logout.
- Um clique no interruptor **Ultra** alterna **uma** vez.

**Por quê.** Fechar a lacuna visual restante entre a casca e os prints de referência, sem mudar caça, login nem conteúdo do webview.

**Arquivos de produto.** `dashboard/src/renderer/app.js`, `view.js`, `standby.js`, `icons.js`, `app.css`, `mesa.css`, `espera.css`, `layout.css`, `chrome.css` (casca; demais só se tocados nesta rodada).

**Testes.** `npm test` em `dashboard`: **51** passaram, **0** falharam. Verificação visual em janela **1024×572**; capturas de evidência (ambiente de teste, não artefato do app): `final4-mesa.png`, `final4-espera.png`, `final4-ajustes.png` em `C:\Users\Pedro\AppData\Local\Temp\mesa-paridade\`. **Lacunas:** contraste 4.5:1 e `prefers-reduced-motion` não medidos nesta rodada; jogo dentro do webview não exercido de ponta a ponta.

## 2026-10-30 — Baías redimensionáveis e menus recolhíveis (casca)

**O que mudou (o que o jogador vê).**

- **Grade / fila / coluna:** entre baías **colocadas** (`placed !== false`) aparecem **divisórias** arrastáveis (`bay-split.js`, `.bay-split-sep` sobre `.bays-wrap`); a proporção fica em **`cfg.bayWeights`** (persistida em `mesa-config.json`), **não** no slider **Escala** (`cfg.bays[i].scale`). Arrastar entre duas vizinhas ajusta na hora; **salva no soltar** do ponteiro. **Duplo clique** ou **Enter** na divisória **iguala** aquele eixo (todos os pesos do eixo viram **1**). **Setas** do teclado movem ~**5%** do eixo visível e **salvam** a cada passo. Cada fatia visível respeita mínimo ~**18%** do eixo (ou o que couber com a altura do cabeçalho da baía). Baía **fora da grade** não entra na conta; tirar ou devolver baía **não zera** o array de pesos. Em janela **≤700px** a grade vira **uma coluna** e as divisórias **somem** (`layout.css` / `baySplitNarrow`).
- **Trilho:** **aberto** por padrão (**160px**, `--sidebar-width` em `app.css`): ícone **e** rótulo (**Mesa**, **Espera**, **Ajustes**). **Recolhido** (classe `.app.is-rail-collapsed`, só com **min-width: 701px**): **60px**, só ícones nos atalhos; botão «Recolher trilho» / «Abrir trilho» com **`aria-expanded`** e chevron (`shell-fold.js`). Abaixo de **700px** o trilho continua na **faixa inferior**; o item do botão de recolher do trilho fica **oculto** (`.rail-fold-li { display: none }`).
- **Cartão de operação:** barra «**Recolher painel**» / «**Abrir painel**» (`.op-fold-bar`); recolhido esconde **`.op-grid`** e **`.away-bar`**. Cada coluna (**Automações**, **Baía em foco**, **Conta**) tem botão de recolher: fechada some o **miolo** (`.op-col-body`, inclusive **Escala** e toggles) e mantém título + botão no cabeçalho. **KPIs** e as **baías** não recolhem. Estado em **`cfg.chrome`** (`railExpanded`, `opExpanded`, `columnsExpanded.autos|focus|account`): só **`=== false`** grava recolhido; config **antiga** sem esses campos abre **fatias iguais** e **menus abertos** (`catalog.normalize`).
- **Ícones:** chevrons de recolher em `icons.js` (`chevron-esquerda`, `chevron-direita`, `chevron-cima`, `chevron-baixo`). **Sem** componente DaisyUI **`collapse`** na casca.

**Por quê.** Dar controle de espaço na Mesa (proporção das baías e chrome recolhível) sem alterar caça, login ou conteúdo do webview.

**O que não mudou.** Caça, IPC, preload, login Google/importação, histórico `mesa-xp-history.json`, cálculo ao vivo de XP/h (**10 min**), slider **Escala** por baía, favorito de baía e desligar o app (ainda ausentes).

**Arquivos de produto.** `dashboard/src/shared/catalog.js`, `catalog.test.js`, `dashboard/src/renderer/bay-split.js`, `shell-fold.js`, `view.js`, `slots.js`, `app.js`, `layout.css`, `app.css`, `icons.js`, `index.html`.

**Testes.** `npm test` em `dashboard`: **51** testes, **15** suites, **0** falhas — inclui `catalog.test.js` (config antiga, eixo inválido → uns, só `false` recolhe). **Lacunas:** UI interativa **não** exercida de ponta a ponta (arraste de divisória, recolher trilho/painel/colunas). Na única abertura do Electron a janela apareceu (trilho aberto, texto «Recolher painel», **Escala**, **Entrar com Google**, **Sair da conta** visíveis — observação manual, **não** teste de arraste). CDP não respondeu e mouse injetado não interagiu com a Mesa. Config do usuário foi restaurada; histórico de XP **não** foi alterado.

## 2026-10-30 — Paridade visual da casca (prints de referência)

**O que mudou (o que o jogador vê).** Nova rodada de ajuste de layout e estilo para **aproximar** a Mesa, a Espera e os Ajustes dos prints alvo — sem prometer igualdade pixel a pixel.

- **Topo:** KPIs (**Caçando**, **Medindo**, **Paradas**, **Sem sessão**) no início do canvas; **sem** título grande «Mesa» / «Neste computador» na interface visível.
- **Trilho:** faixa estreita (**60px**), **bola** da Mesa (`.rail-mark`) no topo, depois **Mesa**, **Espera** e **Ajustes** só com ícone; tela ativa em quadrado **accent** (azul, matiz oklch **255**).
- **Mesa:** cartão de operação em **três colunas** (Automações, baía em foco, Conta). **Entrar com Google** azul accent com **G** circular (`btn-google::before`). **Sair da conta** com **contorno** vermelho (`.btn-leave`), ícone à direita; fluxo em **dois passos** (**Confirmar saída** + **Cancelar**) igual ao anterior. Cartão de operação e KPIs com vidro leve (`backdrop-filter: blur(14px)`); cartão da **baía com jogo** sem blur.
- **Espera:** grade **2×2** de cartões; em cada um, **fatos à esquerda** e **área de gráfico à direita** — vazia mostra **Sem histórico ainda** (SVG oculto com menos de **2** pontos no histórico de **24 h**).
- **Ajustes:** grade **2×2** — esquerda: **Preferências de Aparência** e **Visualização e Layout**; direita: **Funcionalidades** e **Este computador**. **Processamento e Hardware** em largura inteira **antes** do bônus Twitch.
- **Tipografia:** interface em **Segoe UI** (`app.css`); sem carregar **Fira** (ou outra fonte) da rede no `index.html`.

**Por quê.** Alinhar leitura e hierarquia visual aos mockups de produto, mantendo ícones e lógica já existentes da Mesa.

**Paridade — o que ainda difere dos prints (confirmado em teste).** Ícones seguem o traço próprio (`icons.js`), não os do mockup; gráfico sem dados não desenha curva placeholder; em janela **baixa**, **Processamento** pode precisar de rolagem; **mascotes** de Pokémon não entram na casca. Não há meta de cópia absoluta do print.

**O que não mudou.** Caça, IPC, preload, login Google/importação, histórico `mesa-xp-history.json`, cálculo ao vivo de XP/h (**10 min**), conteúdo do webview, favorito de baía e desligar o app (ainda ausentes).

**Arquivos de produto.** `dashboard/src/renderer/app.css`, `chrome.css`, `layout.css`, `live-bonus.css`, `view.js`, `standby.js`, `app.js`, `shell-fold.js`, `icons.js`, `perf.js`, `slots.js` (casca; demais módulos só se tocados nesta rodada).

**Testes.** `npm test` em `dashboard`: **46/46**. Electron (CDP): interruptor com **um clique**; **Sair** arma e **Cancelar** desarma; quatro `.bay-stage`; tema **Escuro**/**Claro** em Ajustes. **Capturas de referência:** `final2-mesa.png`, `final2-espera.png`, `final2-ajustes.png` (pasta temporária `mesa-paridade` no ambiente do tester). **Lacunas:** contraste 4.5:1 e `prefers-reduced-motion` não medidos nesta rodada; paridade visual avaliada por olho, não diff pixel a pixel.

## 2026-10-30 — Ícones da Mesa, painéis semitransparentes e histórico de XP (24 h)

**O que mudou (o que o jogador vê).**

- **Ícones:** a casca passa a usar só traços outline da Mesa (`icons.js` / `[data-icon]`): bola genérica, pegadas/livro/alfinete/treinador nos KPIs, pílula, Nv/XP/ouro/RAM, fechar/tirar/renomear, sol/nuvem/lua, engrenagem, gota/folha/fantasma/estrela (marcas na Espera), atalhos do jogo e trilho. **Sem mascotes.** Marca no trilho (`.rail-mark`). **Sem** ícone de coração nem opção de desligar o aplicativo na casca.
- **Cartões:** KPI, cartões da **Espera** e de **Ajustes** ganham fundo semitransparente (`.mesa-panel`, `color-mix` — **sem** `backdrop-filter`). Baía com jogo e cartão de operação continuam opacos; `<webview>` só em `.bay-stage`.
- **Espera:** gráfico SVG com pontos **reais** do arquivo de histórico (últimas **24 h**, rótulos de hora nos dados); **«Sem histórico ainda»** se houver menos de **2** pontos. Campo **Atualizado** usa `lastGood`. Removidos «Atividades integradas» e eixo fixo 12h–18h. O número **XP/h** ao vivo segue a janela de **10 min** em memória (`live[].samples`) — inalterada.
- **Persistência:** `%AppData%\Mesa\mesa-xp-history.json` (Windows), separado de `mesa-config.json`. Novo ponto a cada **10 min** só com sessão e taxa válida; JSON corrompido vira histórico vazio.
- **Conta e toggles:** **Sair da conta** continua vermelho (matiz **27**); **Entrar com Google** azul accent (matiz **255**). Interruptores mostram **Ligado** / **Desligado**.

**Por quê.** Identidade visual própria, leitura dos cartões secundários sem vidro (`backdrop-filter`), e curva de XP na Espera baseada em histórico durável — não só na sessão atual.

**O que não mudou.** Caça, IPC, preload, login, conteúdo do webview, fluxo Sair armado / **Cancelar**, cálculo ao vivo de XP/h (10 min), favorito de baía e desligar o app (ainda ausentes).

**Arquivos de produto.** `dashboard/src/shared/xp-history.js`, `xp-history.test.js`, `dashboard/src/main/index.js`, `dashboard/src/preload/ui.js`, `dashboard/src/renderer/icons.js`, `app.js`, `app.css`, `standby.js`, `view.js`, `index.html`, `package.json` (suíte de testes).

**Testes.** `npm test` em `dashboard`: **46/46**, incluindo `xp-history.test.js`. Electron (CDP): casca sem mascote; quatro baías e `.bay-stage`; aviso **Sem histórico ainda**; Google matiz **255** e Sair matiz **27**. **Lacunas:** curva ao vivo após 10 min não exercida nesta rodada; contraste 4.5:1 e `prefers-reduced-motion` não medidos; arquivo `mesa-xp-history.json` do usuário não foi criado (não existia e o teste não semeou).

## 2026-10-30 — Casca alinhada aos prints (trilho, KPI, operação, Espera, Ajustes)

**O que mudou (o que o jogador vê).** A casca foi reorganizada para aproximar os layouts de referência, com exceções anotadas abaixo.

- **Trilho:** faixa estreita (**60px**), só ícone para **Mesa**, **Espera** e **Ajustes**; logo da Mesa no topo; tela ativa em quadrado **azul** (accent, matiz oklch **255**). **Escuro** / **Claro** saíram do trilho e ficam em Ajustes → **Preferências de Aparência** → **Tema**.
- **Mesa:** quatro cartões KPI (**Caçando**, **Medindo**, **Paradas**, **Sem sessão**) com número e ícone; um cartão de operação em **três colunas** — **Automações** (rótulos reais, VIP, poção, escala), **baía em foco** (nome da selecionada, atalhos do jogo em join, **Mudo** / **Economia** / **Ultra**) e **Conta** (**Entrar com Google** azul accent, **Já entrei** com borda outline, **Sair** vermelho preenchido ainda em dois passos; **Recarregar** e **Igualar as quatro** menores). Quatro baías com webview em `.bay-stage`; **Fora da grade** continua sob o cartão de operação.
- **Ajustes:** cartões em **duas colunas** (Aparência, Layout, Funcionalidades, Este computador); **Processamento** em largura inteira; Twitch intacto. **Modo noturno** mostra só **Ligado** ou **Desligado** (rótulo duplicado oculto), não os dois textos juntos.
- **Espera:** quatro cartões com fatos reais, **Ver jogo**, rodapé explicativo antigo; sparkline só com amostras reais de XP (últimos **10** minutos, **≥2** pontos). Sem gráfico 12h–18h e sem «Atividades integradas».

**Por quê.** Unificar leitura da Mesa com o desenho alvo: trilho mínimo, KPIs visíveis, operação agrupada e telas secundárias sem elementos fictícios.

**O que não entrou nesta entrega.** Favorito de baía, desligar o aplicativo e «Lançar sem encurtar» **não** foram implementados (confirmado no código).

**O que não mudou.** Caça, IPC, preload, login Google/importação, lógica de **Sair** armado / **Cancelar** desarmado, conteúdo dentro do webview e regras de **Igualar as quatro** (sem copiar Ultra).

**Arquivos de produto.** `dashboard/src/renderer/view.js`, `app.js`, `app.css`, `chrome.css`, `layout.css`, `standby.js`, `icons.js`, `slots.js`, `perf.js` (bloco Processamento), `extras.js` / `updates.js` / `live-bonus.js` (cartões de Ajustes).

**Testes.** `npm test` em `dashboard`: **42/42**. Electron (CDP): accent matiz **255** em **Entrar com Google**; **Sair** matiz **27**; trilho sem Escuro/Claro; quatro baías e `.bay-stage`; um clique no interruptor; **Sair** arma e **Cancelar** desarma; Ajustes com tema; Espera sem frase inventada. **Lacunas:** jogo dentro do webview, contraste 4.5:1 e `prefers-reduced-motion` não medidos nesta rodada. Config restaurada pelo tester.

## 2026-10-30 — Interruptores com trilho e «Ligado» / «Desligado»

**O que mudou (o que o jogador vê).** Os interruptores da barra e de Ajustes passam a mostrar o estado por palavra (**Ligado** / **Desligado**) ao lado do trilho DaisyUI (visto quando ligado, X quando desligado). Desligado: trilho ardósia (`base-300`). Ligado: trilho verde do tema (`success`), pino e ícones em `success-content` — não o vermelho de **Abrir**. A palavra não quebra linha. **Escuro** / **Claro** no trilho e em Ajustes → **Aparência** continuam iguais (só `shellTheme`, sem mexer no modo noturno do jogo).

**Por quê.** Ler ligado/desligado sem depender só da posição do pino ou de cor ambígua perto do botão vermelho da baía.

**O que não mudou.** Handlers de preferência, IPC, preload, caça, faixas da barra, fluxo Sair armado / Cancelar desarmado e tema da casca fora dos estilos dos toggles.

**Arquivos de produto.** `dashboard/src/renderer/app.js` (`toggle`, `setChecked`), `dashboard/src/renderer/app.css` (trilho `base-300` / `success`, `.toggle-state`).

**Testes.** `npm test` em `dashboard`: **42/42**. Electron (CDP): um clique em **Mudo** altera texto e cor do trilho; ligado na família verde (matiz ~155), distinto do vermelho de **Abrir**; trilho e pino diferem nos dois estados e no tema claro; trocar de baía reflete o `cfg`; faixas da barra sem sobreposição; Sair arma e Cancelar desarma. Config restaurada pelo tester.

## 2026-10-30 — Trilho mais largo, ícones e tema no trilho

**O que mudou (o que o jogador vê).** O trilho lateral passou a **96px** de largura e ganhou uma **logo da Mesa** no topo: quatro vãos coloridos com as cores do tema (vermelho, azul, ouro e ardósia) — não é Pokébola. A logo some só quando o trilho desce (abaixo de **700px** de largura). **Escuro** e **Claro** ficam fixos na base do trilho, com texto visível; o mesmo clique que em Ajustes → **Aparência** troca a casca e grava a preferência, sem mexer no **modo noturno do jogo**. Os atalhos **Mesa**, **Espera** e **Ajustes** usam ícones outline novos (16px no trilho); o item da tela ativa ganha destaque em pílula, com transição suave (~180ms). Botões comuns da barra — inclusive os discretos (Mapa, Pokédex, etc.) — realçam no hover com a mesma cadência; **Abrir** continua vermelho com texto claro e clareia levemente ao passar o mouse. Quem usa **reduzir movimento** no sistema não vê essas transições. As faixas **Automações**, **No jogo**, **Nesta baía**, **Conta** e **Fora da grade** seguem separadas como antes.

**Por quê.** Identidade visual da Mesa no trilho, ícones legíveis nos dois temas e troca de aparência sem ir a Ajustes.

**O que não mudou.** Faixas e ordem da barra da Mesa, handlers de caça/login, `cfg.night`, IPC, preload e conteúdo do webview.

**Arquivos de produto.** `dashboard/src/renderer/icons.js`, `index.html`, `view.js`, `app.css`, `chrome.css`, `app.js` (sincronização Escuro/Claro trilho ↔ Ajustes).

**Testes.** `npm test` em `dashboard`: **42/42**. Electron (CDP): ícones 16px nos dois temas, `mask-mode: alpha`; tema do trilho altera `data-theme` e `night` permanece; faixas sem sobreposição; um clique num interruptor; Sair arma e Cancelar desarma. **Lacunas:** hover medido só por CSS (sem pixel); `prefers-reduced-motion` não emulado no teste; janela física não redimensionada — breakpoint 700px simulado.


## 2026-10-30 — Barra da Mesa em faixas empilhadas

**O que mudou (o que o jogador vê).** Os controles da Mesa deixaram de aparecer numa única faixa misturada. Agora a barra (`.toolbar`, ainda dentro de um `card card-border`) mostra blocos empilhados, cada um com rótulo em texto e linha de separação fina entre faixas, nesta ordem: **Automações** (interruptores de caça, slider de poção, mensagem do mapa automático); **No jogo** (atalhos Mapa, Pokédex, Depot, Boss, Market); **Nesta baía** (Mudo, Economia, Ultra, Escala, Recarregar, Igualar as quatro); **Conta** (Entrar com Google, Já entrei, Sair da conta e Cancelar quando Sair está armado); **Fora da grade** só quando alguma baía foi tirada da grade — fica abaixo de Conta, sem sobrepor as outras faixas. A cabeça de cada baía (Abrir, Fechar, Tirar, Renomear) continua igual.

**Por quê.** Ler e tocar nos controles sem confundir automações, navegação no jogo, preferências da baía em foco e login.

**O que não mudou.** Handlers de clique e `change`, tema da casca (`shellTheme`), caça e mapa automático, fluxo de login Google/importação, lógica de Sair armado / Cancelar desarmado, IPC, preload e conteúdo do webview.

**Arquivos de produto.** `dashboard/src/renderer/view.js`, `layout.css`, `app.css`, `slots.js`.

**Testes.** `npm test` em `dashboard`: **42/42**. Electron via CDP: faixas sem sobreposição (Fora da grade abaixo de Conta); `.bay-stage` das baías visíveis com altura ~313px; um clique num interruptor; Sair arma e Cancelar desarma; config do usuário restaurada pelo tester.


## 2026-10-30 — Casca visual com Tailwind 4 e DaisyUI 5

**O que mudou.** A interface da Mesa (Electron) passou a ser estilizada com **Tailwind CSS 4.3.3** e **DaisyUI 5.7.50**. Dois temas próprios — **mesa** (escuro) e **mesa-claro** (claro) — usam tokens oklch, sem profundidade nem ruído (`depth`/`noise` 0). O plugin DaisyUI vem com `themes: false` (sem pacote dos 35 temas prontos) e exclui componentes não usados (vidro, aura, skeleton, dock, etc.). A preferência **Aparência** em Ajustes (Escuro / Claro) grava `shellTheme` na config (`'mesa' | 'mesa-claro'`), separada de **Modo noturno** (`cfg.night`, opção do jogo). O `<html>` recebe `data-theme` conforme `shellTheme`. CSS fonte em `theme.css`; saída compilada versionada em `theme.generated.css`. Scripts `build:css`, `prestart` e `predist`; pacotes Tailwind/DaisyUI só em `devDependencies`. Cor de fundo da janela Electron: `#222630` (aproximação do base escuro). Componentes visíveis: trilho com `menu`, KPIs com `stats`, botões `btn btn-sm` (único `btn-primary` em **Abrir**; **Sair** outline error e, confirmado, `btn-error`), toggles checkbox DaisyUI com `setChecked` único que espelha `input.checked`, ranges `range-accent`, baías e toolbar/espera em `card card-border`, badges de estado (success só caçando; neutral em medindo/parada/caiu; ghost sem sessão; secondary só VIP), Ajustes em `list`/`list-row`, processamento em `table table-sm`, inputs/`fieldset` no Twitch e sniper, link `link-accent` na atualização, **Desconectar** em `btn-ghost`. Achado de baías paradas: `alert alert-soft`, sem amarelo/vermelho dedicados e sem `role=alert`. Renomeações de layout: `.stat` do shell → `.bay-stat`; `.stack` → `.action-row`. O webview do jogo permanece em `.bay-stage`.

**Por quê.** Unificar a casca em um sistema de componentes mantível, com temas claros/escuros da Mesa sem misturar com o modo noturno do pokeidle.io.

**O que não mudou.** Lógica de caça, IPC, login, preload, sessões das quatro baías, auto-hunt e mapa automático; conteúdo dentro do webview.

**Arquivos de produto.** `dashboard/package.json`, `dashboard/package-lock.json`, `dashboard/src/renderer/index.html`, `theme.css`, `theme.generated.css`, `app.js`, `view.js`, `app.css`, `layout.css`, `chrome.css`, `standby.js`, `extras.js`, `updates.js`, `perf.js`, `live-bonus.js`, `src/shared/catalog.js`, `src/main/index.js` (e demais renderer que só trocaram classes DaisyUI, p.ex. `slots.js`, `auto-hunt.js`).

**Testes.** `npm test` em `dashboard`: **42/42** após ajustes. Rodada final no Electron real (CDP): **PASSA** — trilho à esquerda em janela larga; quatro `article.bay` no DOM (visibilidade depende de `placed` na config local); toggle Economia com um `change` e estado ao trocar baía; badges coerentes; **Abrir** único primário opaco; fluxo Sair arma / Cancelar desarma sem apagar sessão; Aparência não grava `night`; Desconectar ghost. **Lacunas:** contraste 4.5:1 não medido; `prefers-reduced-motion` presente no CSS mas não emulado no teste; hex da janela é aproximação do oklch; Enter no renomear, login Google e navegação dentro do jogo não exercidos de ponta a ponta nesta rodada.


## 2026-10-30 — Modo Ultra por baía na Mesa

**O que mudou.** Cada baía ganhou interruptor **Ultra** na barra «Nesta baía» (junto a Mudo e Economia), com ícone próprio e dica «Esconde o jogo e deixa só os números da sessão». O estado persiste na config por baía: `normalize` grava `ultra` só quando `raw.ultra === true`; caso contrário fica `false`. A Mesa envia `cfg-ultra` como `'1'` ou `'0'` por baía via `pushPrefs` e no sync inicial `bay:prefs`, **sem** amarrar ao foco da Mesa (diferente de `cfg-economia`, que continua forçando economia automática nas baías fora de foco). O preload `syncUltra` aplica o modo ao vivo: desligar usa `#ultra-sair`; ligar ou alternar via `#cfg-ultra` grava no `localStorage` a chave oposta ao desejado antes do clique; abre `#btn-config` só se o interruptor ainda não existir; fecha `#modal` com `#modal-fechar` quando esta chamada abriu o modal e a escolha já foi aplicada. Conta sem equipe: a chave fica guardada e `ultraHold` evita reabrir Configurações a cada ciclo de `applyPrefs` (5 s). Em `hunt-page.js`, `economyOn()` passa a ser verdadeiro também com a classe `modo-ultra` (cap de frames); `semCenaOn()` não foi alterado nesta entrega. **Igualar as quatro** continua copiando autos, limiar de poção, escala e mapa automático — não copia `ultra`.

**Por quê.** Permitir Modo Ultra por conta/baía na Mesa, independente do interruptor Economia e do foco, com sincronização ao jogo sem depender só de `localStorage`.

**Arquivos de produto.** `dashboard/src/shared/catalog.js`, `dashboard/src/renderer/view.js`, `dashboard/src/renderer/chrome.css`, `dashboard/src/renderer/app.js`, `dashboard/src/main/index.js`, `dashboard/src/preload/game.js`, `dashboard/src/preload/hunt-page.js`.

**Testes.** `npm test` em `dashboard` (42 testes, 14 suites, 0 falhas), incluindo `catalog.test.js` (config antiga deixa `ultra` desligado nas quatro baías; só `raw.ultra === true` liga; `'1'` e `1` ficam `false`). Caminho ao vivo no Electron (classe `modo-ultra`, cliques no jogo): **não confirmada**.


## 2026-10-30 — Mapa automático: trava do jogo na troca de hunt

**O que mudou.** O mapa automático continua desligado por padrão, lê o guia de hunts, exige cerca de 8% a mais de XP de treinador na hunt candidata (`MesaHuntRank.pick`) e envia `{ t: 'hunt.select', slug }`. A decisão de trocar deixou de depender só do carimbo `centroLivreEm` (pausa no centro após dano), que na caça quase nunca zera e impedia a troca. Agora a Mesa alinha-se à trava do pokeidle.io: com cena de combate ativa, a troca pode sair entre ondas (`waveClear` / sequência de onda); com Modo Economia ou Modo Ultra (`semCena`), campo vazio não libera e continua valendo o carimbo do servidor. Também bloqueia enquanto `trocaHuntLivreEm` (pausa do jogo após entrar numa área) não passou. No Safari, a troca fica bloqueada até a conta sair manualmente. O rótulo do melhor farm na baía segue sendo só XP/h e ouro/h; a troca exige limiar, travas e comando.

**Por quê.** O mapa automático não trocava na prática durante a caça porque a condição antiga quase nunca era satisfeita.

**Arquivos de produto.** `dashboard/src/preload/hunt-page-switch-gate.js` (novo), `hunt-page-state.js`, `hunt-page.js`, `hunt-bridge.js`, `dashboard/src/main/hunt-hook.js`, `dashboard/src/renderer/hunt-rank.js`, `auto-hunt.js`, `hunt-rank.test.js`, `dashboard/package.json`.

**Testes.** `node --test` em `hunt-rank.test.js` (7/7) e `npm test` (40/40). Troca ao vivo com conta logada no Electron: **não confirmada**.
