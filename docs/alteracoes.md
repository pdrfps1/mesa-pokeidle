# Alterações

## 2026-11-07 — Patch «Módulos» · motor de layout e especificação

> O board de módulos ganha o motor puro de layout (`src/shared/board-layout.js`), com testes, contrato JSON e especificação. Nenhuma tela mudou: o motor não está ligado à Mesa nem à Espera. O tema Arena segue como proposta, não aplicada, e o Vigília continua padrão.

### Destaques do patch
- **Motor puro:** mover, redimensionar, adicionar, remover, perfis, migração do layout antigo, snap, colisão e compactação, sem tela.
- **Módulo travado:** não se move, não se redimensiona, não é removido nem ocultado, e sobrevive ao reset do perfil.
- **Especificação:** `docs/modulos.md`, com matriz de componentes, regras de grade, breakpoints, proposta Arena, desempenho e o conflito com o MASTER «Vigília».

### O que mudou
- `src/shared/board-layout.js` (novo): grade de 12 colunas, linha de 10 px e gap de 8 px. Toda operação que muda o estado devolve cópia profunda; operação recusada devolve a mesma referência. Chave desconhecida é recusada por `validate` e descartada por `normalize`. Limites de 8 perfis e 32 módulos por perfil.
- Tipos de módulo: baía, KPI, capturas, processos, Twitch (geral e por baía) e calculadora de status (`pokecalc`). Os limites dos tipos novos são provisórios.
- Migração do layout antigo (`fromLegacy`) cobre os 12 widgets da Espera, incluindo `pokecalc`. Nada na Mesa a chama ainda.
- `docs/board-layout.schema.json` e `docs/exemplos/board-layout.exemplo.json`: contrato do módulo e exemplo com dois perfis. O ajv foi usado só como checador; não é dependência.
- `docs/modulos.md` (novo): especificação. Em §4, a regra de travado ganhou a remissão às exceções que já estavam escritas logo abaixo.
- `package.json`: uma linha no script `test`.

### Por quê
Preparar o board de módulos com regras testadas antes de mexer em tela. Decisões do usuário nesta entrega: o reset de perfil preserva os módulos travados, em vez de reset total; o tema Arena fica como proposta opcional e o Vigília segue padrão, porque o MASTER proíbe neon, degradê e vidro; ligar o motor às telas fica para depois.

### Arquivos de produto
Lista feita pelos arquivos desta entrega. O diff de `dashboard/` mistura outras frentes ainda não commitadas (o `git status` mostra cerca de 73 entradas), e `package.json` tem diff de outros trabalhos além da linha de teste. Por isso a lista não se isola por `git diff`:
- `dashboard/src/shared/board-layout.js` (novo) e `dashboard/src/shared/board-layout.test.js` (novo).
- `dashboard/docs/modulos.md` (novo), `dashboard/docs/board-layout.schema.json` (novo) e `dashboard/docs/exemplos/board-layout.exemplo.json` (novo).
- `dashboard/package.json`: só a linha do script `test`.

Versão: esta entrega não tem número de versão. O `package.json` está em 0.4.0, da entrega de marca, e esta entrega não altera o número.

### Testes
- `node --test src/shared/board-layout.test.js`: 76 testes, 76 passando (tester).
- `npm test` em `dashboard/`: 936 passaram, 0 falharam, código de saída 0 (tester). O total inclui testes de outras frentes que entraram na lista do script; a contagem sobe com o tempo.
- Propriedade com três sementes (20261107, 7331, 424242): 750 normalizações por semente e duas sequências de 300 operações. Nenhuma violação de travado em 1.800 operações, nenhuma colisão entre módulos visíveis, `x + w` sempre até 12, as 4 baías sempre presentes, idempotência ok. Pior operação medida: 0,46 ms (`add`), com validação dentro de cada chamada.
- Aliasing: 485 operações que mudaram o estado, nenhuma com objeto compartilhado com a entrada.
- Schema × motor: o motor nunca aceita o que o schema recusa. O schema é mais frouxo em id repetido, `x + w > 12` e colisão, como ele mesmo declara.
- Contraste dos tokens Arena, calculado por script (tester), não medido na tela: texto sobre chão, painel e tile entre 15,86 e 17,25; texto 2 entre 8,30 e 9,03; `#0b0d14` sobre os acentos entre 6,40 e 16,04; acentos como anel sobre o painel entre 5,94 e 14,89.
- Revisão (revisor): três rodadas de correção. Achados corrigidos: `compact` não terminava com `y` muito grande; `remove` apagava módulo travado; operações devolviam objetos compartilhados com a entrada; `add` revelava e movia módulo oculto e travado; `resetProfile` destravava e reposicionava travados; `normalize` empurrava travado em vez de destravado; o schema aceitava combinações de tipo e id e nomes só com espaços, que o motor rejeita; a migração perdia o widget `pokecalc`.

### Não confirmado
- **Visual e tema Arena:** nada foi aplicado nem visto na tela.
- **Custo do blur sobre `<webview>`** com quatro baías ativas: não medido. O protocolo está na §8 de `docs/modulos.md`.
- **Arrasto real, teclado (setas e Shift+setas) e breakpoints** na tela: não implementados e não verificados.
- **Contraste na tela real:** os números são de cálculo.
- **Componentes BoardUI candidatos** (`stat-cards`, `table`, `command-palette`, `drawer`): `get_component` não foi consultado, e dock flutuante e gaveta não aparecem como item próprio no catálogo. Nenhum componente foi instalado.
- **Itens Pro do BoardUI:** exigem licença, que não foi usada.
- **`designeer.xyz`:** referência não conferida.
- **Limites provisórios** dos tipos novos.

### Limites conhecidos
- O `<webview>` das baías não é virtualizado: desmontar derrubaria a sessão da conta. Baía fora da tela ou «removida» só fica oculta.
- Não há persistência ainda. O formato futuro é `cfg.board` no `mesa-config.json`, gravado por `save()`.
- O motor não é importado por `src/renderer`, `src/main`, `src/preload` nem `ui`.
- O BoardUI não renderiza, move nem persiste widgets. Schema, snap, colisão, perfis e persistência são do próprio app.

### Problemas conhecidos
- Texto a 40% sobre o tile dá 3,52:1 e falha AA. A proposta troca por texto 2 sólido (8,30:1); não foi aplicada.
- A borda `rgba(148,163,255,0.14)` dá 1,23:1 sobre o chão. Ela é separador decorativo, não contorno de controle.
- A proposta Arena contraria o MASTER «Vigília» (um acento, sem degradê, sem neon, sem vidro). Decisão pendente do usuário.

### Patch note

**Patch «Módulos» · motor de layout e especificação · 07/11/2026**

Resumo: o board de módulos ganha o motor puro de layout, com 76 testes próprios e a especificação. Nenhuma tela mudou; o motor ainda não está ligado à Mesa nem à Espera.

**Novidades**
- [Novo] Motor de layout puro: mover, redimensionar, adicionar, remover, perfis e migração do layout antigo.
- [Novo] Módulo travado não se move, não se redimensiona e não é removido nem ocultado; sobrevive ao reset do perfil.
- [Novo] Especificação `docs/modulos.md` e contrato `docs/board-layout.schema.json`.

**Mudança de comportamento**
- Nenhuma tela mudou. Nenhuma tela usa o motor.

**Conhecidos**
- Ligação às telas fica para a próxima entrega, com verificação no Electron.
- Tema Arena é proposta, não aplicada; o Vigília segue padrão.
- Custo do blur sobre as baías não medido.

## 2026-11-07 — Calculadora de status na Espera

> A Espera ganha a «Calculadora de status» (widget `pokecalc`). Ela busca o Pokémon na PokeAPI, calcula os stats e a recarga da skill com as fórmulas da especificação, e mostra o sprite normal ou shiny. Nasce oculta; aparece pelo menu Widgets. As fórmulas não foram conferidas no jogo, e o app Electron real não foi testado com a rede.

### Destaques do patch
- **Widget novo na Espera:** «Calculadora de status», oculto por padrão, largura 2, no fim da ordem.
- **Busca só por clique:** a PokeAPI é consultada ao clicar em «Buscar» ou apertar Enter, nunca a cada tecla e nunca no boot.
- **Cache local:** status base guardado no próprio aparelho (até 200 entradas), com o último resultado restaurado sem rede.
- **Falha isolada:** se a calculadora não montar, a Espera segue com os outros widgets.

### O que mudou
- `standby-layout.js`: `pokecalc` entra no padrão e fica oculto. Estado salvo antigo sem o id recebe o widget no fim, oculto. A Espera passa de 11 para 12 widgets.
- `standby.js`: rótulo «Calculadora de status» e montagem em try/catch. Se a montagem falhar, a moldura mostra «Calculadora indisponível.».
- `poke-stats.js`: fórmulas e validação. Núcleo estrito (lança `TypeError` ou `RangeError` em pt-BR) e `normalizeInputs` para a UI, que limita, arredonda e nunca lança.
- `poke-api.js`: `get()` com erros tratados (`entrada-invalida`, `nao-encontrado`, `erro-servidor`, `tempo`, `offline`, `resposta-invalida`), cache e buscas simultâneas iguais viram uma.
- `poke-calc.js` e `poke-calc.css`: o widget, com busca, sprites com fallback, erros em pt-BR e «Sem imagem» se nada carregar.
- Sprites: normal e shiny, na ordem `showdown` GIF, PNG e arte oficial. Com `prefers-reduced-motion`, o GIF sai da lista.
- `package.json`: só o script `test` passa a incluir os dois arquivos de teste novos.
- `poke-stats.js`: `formatAjuste` monta as frases de ajuste, testável pela suíte Node. Mostra a unidade na origem e no destino, com vírgula decimal pt-BR (ex.: «Qualidade 84% → 85%.»). Texto só com espaços vira ajuste com `de: ''`.
- `poke-calc.js`: trocar shiny zera o sprite pendente e desconecta o observer antes de repintar, sem carregar o mesmo sprite duas vezes. Ao reabrir, campo vazio ou fora da faixa volta com o valor usado no cálculo; o estado salvo continua com o texto digitado até a próxima edição.
- `index.html`: 1 link de CSS e 3 scripts.

### Por quê
Pedido do usuário: uma calculadora de status na Espera, com dados da PokeAPI e sprites. As fórmulas vêm da especificação dele. Usou-se JS com JSDoc em vez de TypeScript: o renderer carrega `<script>` cru, sem bundler, e mudar o pipeline não valia o risco. Isso é um desvio consciente do pedido original.

### Arquivos de produto
Lista feita por leitura do código e do diff. O diff de `dashboard/` mistura outras frentes ainda não commitadas, então esta lista não isola a entrega por completo:
- `dashboard/src/shared/poke-stats.js` (novo) e `poke-stats.test.js` (novo).
- `dashboard/src/shared/poke-api.js` (novo) e `poke-api.test.js` (novo).
- `dashboard/src/renderer/poke-calc.js` (novo) e `poke-calc.css` (novo).
- `dashboard/src/shared/standby-layout.js` e `standby-layout.test.js`.
- `dashboard/src/shared/catalog.test.js`: só o array esperado de ids.
- `dashboard/src/renderer/standby.js`: rótulo e montagem com try/catch.
- `dashboard/src/renderer/index.html`: link e scripts.
- `dashboard/package.json`: script `test`.

### Testes
- `npm test` em `dashboard/`: **936** passaram na rodada 3, segundo o relato do tester (poke-stats 39, poke-api 20, standby-layout 23, catalog 31 isolados). O total inclui testes da outra frente de trabalho, não só da calculadora. Na rodada 2, o tester fez 76 verificações numéricas independentes, sem divergência. Esta documentação não rodou a suíte.
- Rodada 3, verificação adicional do tester: frases de ajuste conferidas na tela e por `require` direto; troca de shiny com restauração pendente sem requisição duplicada; sem requisição de rede no boot com o widget oculto.
- Os números de teste batem à mão: 100 P5 shiny IV 31 L100 Q120 dá 7572; Bulbasaur L50 Q100 P1 IV 31 dá 380/400/400/480/480/380.
- No navegador do painel, servido por HTTP local em 127.0.0.1 e sem `window.mesa`: busca, sprites, fallback, recarga, erros, cache, nenhuma requisição no boot com o widget oculto, restauração pelo último resultado, 375 px sem rolagem horizontal, tema claro, foco por teclado e exceção simulada em `mountPokeCalc` (a Espera seguiu com os outros 11 widgets).

### Não confirmado
- **Fórmulas no jogo:** não conferidas. Seguem a especificação do usuário.
- **Suposições do cálculo:** o Speed do cooldown é o Speed final; o IV é um só para os 6 stats.
- **Electron real:** a busca a partir de `file://` com `webSecurity` ligado nunca foi testada. A janela não tem CSP, e o bloqueador de rastreadores em `src/main/index.js` não cobre esses domínios.
- **Persistência:** o layout (`cfg.standby`) depois de reiniciar não foi verificado.
- **Arraste real:** com o mouse, na última rodada, não foi verificado. O menu «Mover antes» foi verificado.
- **Verificação de tipos:** o TypeScript não foi rodado; a checagem com `@ts-check` é opcional.
- **Design:** a exceção de sprites e GIFs ao `design-system/mesa/MASTER.md` está pendente de confirmação do usuário. O `MASTER.md` não foi alterado.

### Limites conhecidos
- Sprites e GIFs ficam só dentro desse widget, oculto por padrão e estático com reduced-motion.
- Dados do jogo (drop, rota, tier real do PokéIdle, piddb e Hayenn) não foram verificados, e o módulo não tem essa camada.

### Problemas conhecidos
1. A frase de ajuste arredonda o valor de origem a 1 casa decimal («12.55» vira «12,6»). A frase de qualidade fora da faixa só aparece por código, porque o slider limita 85 a 120 na UI.
2. Nomes com acento, ponto ou símbolo («Mr. Mime», «Nidoran♀», «Flabébé») viram entrada inválida. Use o número ou o nome como a PokeAPI escreve (`mr-mime`, `nidoran-f`).
4. `type=number` com vírgula (pt-BR): digitar «10,5» pode gerar campo vazio em alguns builds. O widget usa o padrão e avisa «Recarga vazia: calculando com 10 s.». Não testado no Electron.
4. O GIF animado do `showdown` falhou no painel de pré-visualização e caiu para o PNG. Foi do ambiente; não confirmado no Electron.

### Patch note

**Calculadora de status na Espera · 07/11/2026**

Resumo: a Espera ganha a Calculadora de status, oculta por padrão. Ela busca o Pokémon na PokeAPI e calcula stats e recarga com as fórmulas da especificação. As fórmulas não foram conferidas no jogo.

**Espera**
- [Novo] Widget «Calculadora de status», oculto por padrão; aparece pelo menu Widgets. Antes: 11 widgets. Depois: 12 widgets.
- [Novo] Largura 2, no fim da ordem. Estado salvo antigo ganha o widget no fim, oculto.
- [Novo] Busca na PokeAPI por número ou nome, só ao clicar em «Buscar» ou apertar Enter.
- [Novo] Sprite normal ou shiny, com fallback até a arte oficial; «Sem imagem» se nada carregar.
- [Novo] Último resultado restaurado do cache, sem rede.
- [Correção] Falha na montagem da calculadora não derruba a Espera: mostra «Calculadora indisponível.» e os outros widgets seguem.

**Cálculo**
- [Novo] Stats finais com base, tier P1 a P5, shiny, IV, nível e qualidade; recarga com redução por Speed, piso de 0,5 s.
- [Ajuste] Tiers em aritmética inteira: 100 × P4 dá 115, não 114.

**Ajustes**
- [Ajuste] Campo vazio usa o padrão e avisa na tela («IV vazio: calculando com 31.»); o campo não é reescrito.
- [Ajuste] `undefined` e `null` valem o padrão sem aviso.
- [Correção] Texto só com espaços vira ajuste com `de: ''` e a frase «IV vazio: calculando com 31.». Antes: «IV   → 31.».
- [Ajuste] Frases de ajuste com unidade na origem e vírgula decimal pt-BR: «Qualidade 84% → 85%.», «Recarga 0 s → 0,1 s.». Antes: sem unidade na origem e com ponto decimal.
- [Novo] Ao reabrir a Mesa, campo vazio ou fora da faixa volta com o valor usado no cálculo; o texto digitado continua salvo até a próxima edição.
- [Ajuste] Trocar shiny não carrega o mesmo sprite duas vezes.

**Testes**
- [Novo] `poke-stats.test.js` e `poke-api.test.js` entram no script `npm test`.

**Conhecidos**
- Fórmulas não conferidas no jogo; o Speed do cooldown e o IV único são suposições.
- Electron real não testado com a rede: `file://`, `webSecurity` e o bloqueador de rastreadores.
- Nomes com acento ou símbolo viram entrada inválida; use o número ou o nome da PokeAPI.
- Sprites e GIFs são exceção ao design pendente de confirmação do usuário.

## 2026-11-07 — Patch 0.4.0 · PokeIdle Automation: marca, instalador e atualizador

> O app «Mesa» vira PokeIdle Automation, com logo, nomes novos de executável e um instalador. O atualizador passa a baixar o asset certo para cada modo e só fecha o app depois de abrir o instalador. A release precisa publicar os três arquivos. O instalador e o fluxo real de atualização não foram executados de ponta a ponta.

### Destaques do patch
- **Nome e marca:** PokeIdle Automation, com logo circular como ícone da janela, dos executáveis e no cabeçalho das telas.
- **Dois instaladores:** `PokeIdle-Automation-Setup.exe` (instalador) e `PokeIdle-Automation.exe` (portátil), mais o alias `Mesa.exe`.
- **Atualizador corrigido:** o portátil troca o próprio arquivo, e o app só fecha se o instalador abriu.

### O que mudou
- **Marca:** logo circular «POKEIDLE AUTOMATION» (Pikachu de óculos numa pokébola robótica) como ícone da janela e da barra de tarefas, ícone dos executáveis e marca circular de 28px como primeiro item do `.page-head` nas telas Automações, Espera e Configurações. `alt` e `title` com o nome do produto.
- **Nome:** nome visível «PokeIdle Automation». Fonte única em `src/shared/brand.js`; `package.json` repete os mesmos valores, e `src/shared/brand.test.js` falha se divergirem. Não mudaram: `appId` `local.mesa.pokeidle`, `name` npm `mesa-pokeidle`, repositório `pdrfps1/mesa-pokeidle`, a pasta de dados `%APPDATA%\Mesa` e os identificadores internos (`window.mesa`, classes `mesa-*`, `data-theme="mesa"`, `mesa-config.json`). A tela de Automações continua com o id interno `mesa` (o rótulo visível no dock já era «Automações» e não mudou).
- **Instalador:** NSIS assistido, por usuário (sem UAC), com escolha de pasta, atalho na área de trabalho e no menu Iniciar, desinstalador, idioma pt-BR, ícone da logo, imagem lateral e de cabeçalho em azul-marinho `#00173F`.
- **Build:** `npm run dist` roda `scripts/dist.js` (antes `dist-portable.js`) e gera em `dist/` os três arquivos. `signAndEditExecutable` ficou `true`; o ícone vai no executável.
- **Atualizador (`src/main/updater.js`):** dois modos. Portable baixa `PokeIdle-Automation.exe` (reserva `Mesa.exe`) e troca `PORTABLE_EXECUTABLE_FILE`. Instalado baixa `PokeIdle-Automation-Setup.exe`, abre-o com `--updated` e fecha o app depois que o processo abriu.
- **Textos:** onde o app era chamado de «Mesa» como nome do produto, passou a «PokeIdle Automation» ou «o app» (`instalar.ps1`, aviso do atualizador, Espera, descrição do pacote). `aria-label` do dock virou «Navegação principal».
- **Versão:** `package.json` em 0.4.0, para o comparador oferecer a atualização.

### Por quê
O produto ganhou nome e marca próprios, e a instalação precisava de um instalador comum além do portátil. O atualizador tinha dois problemas: no portátil, `process.execPath` apontava para a cópia extraída em pasta temporária, e o app fechava sem saber se o instalador ou a troca tinha aberto.

### Arquivos de produto
Lista feita por leitura do código e do diff. O diff de `dashboard/` mistura outras frentes ainda não commitadas, então esta lista não isola a entrega por completo:
- `dashboard/package.json`: `productName`, `version` 0.4.0, bloco `build` (nomes de arquivo, NSIS, ícones).
- `dashboard/src/shared/brand.js` (novo) e `dashboard/src/shared/brand.test.js` (novo).
- `dashboard/src/main/updater.js`: modos, alvo do portable, `schedulePortableReplace`, `startDetached`, `findReleaseAsset`, `fetchReleaseAsset`.
- `dashboard/src/main/index.js`: `app.setName`, `setAppUserModelId`, pasta de dados, título da janela.
- `dashboard/src/renderer/updates.js`: texto do toast «Atualização em andamento», sem «Ver detalhes».
- `dashboard/src/renderer/view.js`: marca de 28px no `.page-head`, `aria-label` do dock.
- `dashboard/src/renderer/app.css`: `.brand-mark`, `.page-head`.
- `dashboard/src/renderer/standby.js`: nome do produto nos textos da Espera.
- `dashboard/src/renderer/index.html`: `<title>` «PokeIdle Automation».
- `dashboard/scripts/dist.js` (renomeado de `dist-portable.js`), `dashboard/scripts/build-brand-assets.py` (novo).
- `dashboard/build/`: `logo-source.webp`, `icon.png`, `icon.ico`, `installerSidebar.bmp`, `uninstallerSidebar.bmp`, `installerHeader.bmp`.
- `dashboard/src/assets/brand/`: `icon.ico`, `logo-256.png`, `logo-64.png`, `logo-32.png`.
- `dashboard/instalar.ps1`: textos.
- `dashboard/README.md`, `dashboard/docs/projeto.md`, `dashboard/docs/modulos.md`, `design-system/mesa/MASTER.md` (seção «Marca»).

### Testes
- `src/shared/brand.test.js` confere os nomes com o `package.json` e a existência dos ícones e imagens do instalador.
- `src/main/updater.test.js` cobre os helpers do atualizador (testes unitários). Não cobre o download real nem a troca de arquivo.
- `npm test` em `dashboard/`: **922** passaram, 0 falharam, segundo o tester (conta a suíte inteira do checkout, que inclui testes de outras frentes). Esta documentação não rodou a suíte.
- Build isolado (cópia fora do checkout, sem alterar o `package.json`): `npm run dist` saiu com código 0. Conferidos: ícone da logo nos três executáveis e no `win-unpacked`, `ProductName` «PokeIdle Automation» e `FileVersion` 0.4.0. O `startDetached` foi exercitado com um comando inexistente (rejeita com ENOENT, sem exceção solta) e com um processo real (resolve).
- Janela ao vivo (`npm start`, lida por CDP, sem interagir com baías nem Twitch): título «PokeIdle Automation»; `.brand-mark` como primeiro item do `.page-head` em Automações, Espera e Configurações, nos temas `mesa` e `mesa-claro` (64px carregado, 28×28, redonda, sem franja branca); sem rolagem horizontal do documento a 900, 1280 e 1424px; a marca não recebe foco do teclado; sem erro de console além do aviso de CSP do Electron em desenvolvimento.

### Não confirmado
- **Instalador:** não rodado. Foi só inspecionado (`build/` e opções do NSIS no `package.json`).
- **Atualização de ponta a ponta:** nem portable nem instalado foram rodados. Falta publicar uma release para ver o fluxo real.
- **Ícone na barra de tarefas:** não foi capturado. O ícone da janela (barra de título) mostra a logo.
- **Onde estão os arquivos:** o build rodou numa cópia fora do checkout. Os três executáveis foram copiados para `dashboard/dist/0.4.0/` (`PokeIdle-Automation-Setup.exe`, `PokeIdle-Automation.exe`, `Mesa.exe`), com hash conferido. O `Mesa.exe` antigo e o `win-unpacked` de `dashboard/dist/` não foram tocados.

### Limites conhecidos
- O instalador tem tema escuro só na lateral, no cabeçalho e nos ícones. O corpo das páginas segue o tema do Windows.
- O build não é assinado (sem certificado): o SmartScreen pode avisar.
- O instalador baixado é validado só pelo tamanho anunciado pela release. Não há hash nem assinatura.
- Portable e instalado dividem a pasta `%APPDATA%\Mesa`: não abra os dois ao mesmo tempo.

### Problemas conhecidos
- **Instalador sem tema escuro completo:** só lateral, cabeçalho e ícones levam a identidade.
- **Logo pouco legível em tamanho pequeno:** a logo cheia fica ilegível a 16px e pouco legível a 28px no cabeçalho (o texto «POKEIDLE» é pequeno). Dá para trocar por uma versão simplificada (só Pikachu e pokébola) depois.
- **Fluxo real não testado:** instalação e atualização (portable e instalado) só têm inspeção e teste unitário. Falta publicar uma release e instalar uma versão de teste sobre a atual.
- **App fecha logo após abrir o instalador:** se o NSIS encontrar o app ainda aberto, pode pedir para fechar. Precisa de teste manual.
- **Sem assinatura:** o SmartScreen pode avisar.
- **Dados compartilhados:** portable e instalado usam a mesma pasta `%APPDATA%\Mesa`.
- **Descrição do pacote:** a `description` do `package.json` é «Mesa local do PokeIdle Automation com quatro baías.». É proposital: aparece nas propriedades do instalador e do portátil. O executável interno mostra só «PokeIdle Automation» como descrição, que é o nome que o Gerenciador de Tarefas exibe.

### Patch note

**Patch 0.4.0 · PokeIdle Automation · marca, instalador e atualizador · 07/11/2026**

Resumo: o app agora se chama PokeIdle Automation, com logo, dois instaladores e um atualizador que só fecha o app depois de abrir o instalador. A release precisa publicar os três arquivos. Instalador e atualização de ponta a ponta ainda não foram testados.

**Destaques**
- [Novo] Logo circular como ícone da janela, dos executáveis e no cabeçalho.
- [Novo] Instalador `PokeIdle-Automation-Setup.exe` e portátil `PokeIdle-Automation.exe`, com o alias `Mesa.exe`.
- [Novo] Atualizador com dois modos, instalado e portátil.

**Marca**
- Antes: nome «Mesa», sem logo. Depois: nome «PokeIdle Automation» e logo circular de 28px no cabeçalho das telas Automações, Espera e Configurações.
- Antes: sem a logo nova. Depois: logo nos ícones da janela, da barra de tarefas e dos executáveis.

**Instalador**
- Antes: portátil apenas. Depois: instalador assistido por usuário (sem UAC), com escolha de pasta, atalhos e desinstalador, em pt-BR.
- Antes: sem o instalador e sem a identidade nova. Depois: lateral, cabeçalho e ícones em azul-marinho `#00173F`.

**Atualizador**
- Antes: no portátil, a troca apontava para a cópia extraída em pasta temporária. Depois: troca o arquivo indicado por `PORTABLE_EXECUTABLE_FILE`.
- Antes: o app fechava sem confirmar a abertura. Depois: fecha só depois que o processo abriu; se falhar, continua aberto e mostra o erro.
- Antes: toast «Atualização em andamento» com «Ver detalhes». Depois: sem «Ver detalhes».

**Interface**
- Antes: textos com «Mesa» como nome do produto. Depois: «PokeIdle Automation» ou «o app».
- Antes: `aria-label` do dock «Mesa». Depois: «Navegação principal».

**Bugs corrigidos**
- [Correção] Portátil: a atualização trocava o arquivo errado (cópia da pasta temporária). Agora troca o `PORTABLE_EXECUTABLE_FILE`.
- [Correção] Download com tamanho errado mostra «O download da atualização ficou incompleto. Tente de novo.».
- [Correção] O app fechava sem saber se o instalador ou a troca tinha aberto.

**Problemas conhecidos**
- Instalador sem tema escuro completo: só lateral, cabeçalho e ícones.
- Logo cheia pouco legível a 16px e a 28px.
- Instalador e atualização (portable e instalado) não foram rodados de ponta a ponta.
- Ao abrir o instalador, o app fecha logo; se o NSIS encontrar o app aberto, pode pedir para fechar.
- Instalador validado só pelo tamanho; build sem assinatura, o SmartScreen pode avisar.
- Portable e instalado dividem `%APPDATA%\Mesa`.

## 2026-11-07 — Patch 0.3.5 «Vigília» · widgets da Twitch na Espera

> A Espera ganha cinco widgets da Twitch: «Bônus Twitch» e «Twitch · Baía 1» a «Twitch · Baía 4». Todos começam ocultos e aparecem pelo menu Widgets. O painel de Configurações continua igual. Nada disso foi visto na tela nem testado na Twitch real.

### Destaques do patch
- **Cinco widgets na Espera:** «Bônus Twitch» (duas colunas) e uma «Twitch · Baía N» por baía (uma coluna cada), ocultos por padrão.
- **Um controlador para as duas telas:** Configurações e Espera usam a mesma inscrição, o mesmo `liveGet` e a mesma repintura a cada 30 s.
- **Erro no lugar da ação:** falha de ação na Espera aparece na própria baía e some na próxima ação que der certo.

### O que mudou
- `standby-layout.js`: são 11 ids. Padrão: «Bônus Twitch» com 2 colunas, as baías da Twitch com 1, e os cinco ocultos. Estado salvo com os 6 ids antigos ganha os 5 novos no fim, ocultos; os ocultos salvos dos antigos são preservados. «Restaurar padrão» oculta os 5.
- `standby.js`: títulos «Bônus Twitch» e «Twitch · <nome>»; o nome segue o da baía (nome dado, apelido do jogo com a conta logada, ou «Baía N»). O corpo vem de `mountLiveBonusStandby`; sem ele, a moldura mostra «Disponível no aplicativo.». Ao mostrar um widget da Twitch, o conteúdo é repintado.
- `live-bonus.js`: `criarControlador` (uma inscrição em `onLiveStatus`, um `liveGet`, um `setInterval` de 30 s) e `criarVista`, com modo «ajustes» (Configurações) e «espera» (Espera). Ids com prefixo: `live-bonus` e `live-bonus-espera`.
- `live-bonus.js`: `.catch` em `liveGet` e `liveKickOpen`; antes, a rejeição ficava sem tratamento. `aria-describedby` do Foco só existe quando há aviso.
- `espera.css`: regras dentro de `.standby-widget` para o bloco da Twitch. O bloco de lives rola na horizontal; a lista de canais oficiais tem altura máxima de 240px e rolagem própria.
- Erros da Espera: ação de baía mostra o erro na própria baía (`aria-live="polite"`, sem `role`). Leitura inicial e falha ao abrir a Kick aparecem no erro geral da Espera.
- Layout da Espera só grava `cfg.standby`. Não chama IPC da Twitch nem muda `cfg.twitch` ou `twitchAuto`.

### Por quê
O pedido é levar a Twitch para a Espera, com cada baía como widget. O código reaproveita o bloco de Configurações (um controlador, duas vistas) em vez de manter duas cópias da lógica.

### Arquivos de produto
Lista feita por leitura do código e do git. `dashboard/` tem commits (o último é `8938dc7`, de 2026-11-06), mas o diff de trabalho mistura alterações ainda não commitadas de outras entregas. Por isso a lista não isola esta entrega:
- `dashboard/src/shared/standby-layout.js`: `IDS`, `SPAN_PADRAO`, `HIDDEN_PADRAO`, `reset`, `normalize`.
- `dashboard/src/renderer/standby.js`: `standbyLabel`, `twitchBayTitulo`, `corpoTwitch`, `mountStandby`, `applyStandbyLayout`.
- `dashboard/src/renderer/live-bonus.js`: `liveBonusControlador`, `criarControlador`, `criarVista`, `mountLiveBonusStandby`, `paintLiveBonus`.
- `dashboard/src/renderer/espera.css`: bloco `.standby-widget .live-bonus-*`.

Versão: o número 0.3.5 foi escolhido pela equipe (decisão do usuário). `dashboard/package.json` segue em 0.3.2, igual ao HEAD, e não foi tocado nesta entrega. O arquivo tem mudanças de `scripts` e `devDependencies` ainda não commitadas, fora do escopo desta entrega.

### Testes
- `npm test` em `dashboard/`: **786** passaram, segundo o relato da entrega. A documentação não rodou a suíte.
- `src/renderer/live-bonus.test.js`: **66** testes, antes 74. Segundo o relato, foram retirados 13 repetidos, com um teste por cenário. A suíte cobre o corte de 24 botões com total 999 (limites de `points.js`: `BOTOES_CENTRO_MAX_LIMPO` e `CONTAGEM_MAX`), o modo Espera (erro por baía, erro geral e prévia sem `window.mesa`), `btn-active` e `is-parado`.
- `src/shared/standby-layout.test.js`: 23 testes; 5 cobrem os widgets da Twitch (padrão, `reset`, estado com os 6 ids antigos, `hidden` salvo, mostrar um só).
- As mutações feitas na entrega (desfazer dois pontos de controle) fazem testes falharem, segundo o relato.
- `src/main/twitch/erros-log.test.js`: **12** testes, fora do script `test`.
- `standby.js` não tem teste no `npm test`.

### Não confirmado
- Visual da Espera e das Configurações: não conferido na tela. A Mesa do usuário estava aberta, e o código não tem variável de teste para abrir a tela isolada.
- IPC real e Twitch real: não testados nesta entrega.
- Leitor de tela: não verificado. Cada baía da Twitch tem uma linha de estado com `role="status"`.
- Layout salvo depois de reiniciar: não verificado.
- Os 786 testes: informados, não rodados pela documentação.
- `live-bonus.test.js`: 74 − 13 = 61, e o total é 66. Os 5 testes acrescentados não estão listados no relato.

### Limites conhecidos
- A lista «Kick ao vivo» não tem altura máxima. O widget cresce com ela, e o quadro rola.
- Na ordem padrão, os cinco widgets da Twitch ficam depois de «Recursos do app».
- Nas Configurações, falha de leitura e falha da Kick não aparecem na tela, como antes.

### Problemas conhecidos
- «Não foi possível abrir a live da Kick.» quase não aparece. `openOutside` (`src/main/live-login.js`, linhas 8 a 13) engole a falha de `shell.openExternal` e URL inválida, e `live:kick-open` (`src/main/live/service.js`, linhas 70 a 76) devolve o snapshot de qualquer forma. Só falha do próprio IPC cai no `.catch`.
- O `.catch` de `liveGet` (`live-bonus.js`, ~319 a 322) também pega erro de `ctl.aplicar` no primeiro snapshot e mostra `error.message` (`liveBonusMensagemErro`, ~238 a 240) como falha de leitura.
- «Nenhuma live da Kick no ar.» aparece antes do primeiro snapshot (`paintKick`, ~846 a 853), logo abaixo do erro geral.
- Os contêineres de erro nascem `hidden` e recebem texto depois (`live-bonus.js` ~378 a 380 e ~572 a 575). Leitor de tela pode não anunciar.
- Erro de ação da baía some após sucesso. O erro do topo das Configurações não some (já era assim).
- `erros-log.test.js` (12 testes) passa isolado, mas não está no script `test` do `package.json`. Já estava registrado.

### Patch note

**Patch 0.3.5 «Vigília» · widgets da Twitch na Espera · 07/11/2026**

Resumo: a Espera ganha cinco widgets da Twitch, ocultos por padrão: «Bônus Twitch» e uma «Twitch · Baía N» por baía. Configurações não muda. Nada disso foi visto na tela nem testado na Twitch real.

**Espera > Integração Twitch**
- [Novo] «Bônus Twitch» na Espera, com Recompensas, notas, erro geral e Kick ao vivo. Duas colunas, oculto por padrão.
- [Novo] «Twitch · Baía N» para cada baía, com luz de estado, interruptor, lives, Foco e ações. Uma coluna, oculto por padrão; aparece pelo menu Widgets.
- [Novo] Erro de ação aparece na própria baía e some na próxima ação que der certo.
- [Ajuste] Estado salvo antigo: os cinco entram no fim, ocultos. «Restaurar padrão» os oculta de novo.
- [Ajuste] Lista de canais oficiais de cada baía com altura máxima de 240px e rolagem própria. Bloco de lives rola na horizontal dentro do widget.

**Correções e qualidade de vida**
- [Correção] Leitura inicial e abertura da Kick tratam a falha. Antes, a rejeição ficava sem tratamento.
- [Ajuste] Um controlador para Configurações e Espera: uma inscrição, um `liveGet` e uma repintura a cada 30 s.
- [Ajuste] `aria-describedby` do Foco só existe quando há aviso.
- [Ajuste] `live-bonus.test.js` passou de 74 para 66, com um teste por cenário.

**Notas técnicas**
- `standby-layout.js`: 11 ids, com padrão de largura e de ocultos.
- `live-bonus.js`: `criarVista(ctl, prefixo, modo)`; ids com prefixo `live-bonus` e `live-bonus-espera`.
- Ações de layout só mudam `cfg.standby`.
- Ordem de carga: `standby.js`, `live-bonus.js` e `view.js`, que chama as duas montagens.

**Problemas conhecidos**
- Mensagem de falha da Kick quase não aparece: `openOutside` engole a falha do sistema.
- Erro de aplicação do primeiro snapshot pode aparecer como falha de leitura.
- «Nenhuma live da Kick no ar.» aparece antes do primeiro snapshot.
- Erros nascem ocultos e recebem texto depois; leitor de tela pode não anunciar.
- Erro do topo nas Configurações não some após sucesso (já era assim).
- Lista da Kick sem altura máxima.
- `erros-log.test.js` fora do script `test`.

## 2026-11-07 — Patch «Vigília» · um resgate por vez e diagnóstico no log

> Só um resgate roda por vez em toda a Mesa, entre baías e lives, mesmo com contas diferentes; entre dois resgates há 20 s. O diagnóstico de falha saiu do painel e fica no log de resgates. Na Twitch real, em tftoddy, XP e Captura foram confirmados com multi-live; Shiny ficou sem clique.

### Destaques do patch
- **Um resgate por vez:** trava global entre baías e lives, com intervalo de 20 s entre resgates.
- **Painel limpo:** uma frase curta por falha e a nota «Detalhes no log de resgates.».
- **Na fila:** baía que espera a vez mostra «Na fila» e não conta falha.

### O que mudou
- **Um resgate por vez:** `outraLiveOcupada` (`controller.js`) segura a baía quando outra tem resgate pendente ou soltou/resgatou há menos de `INTERVALO_RESGATE_MS` (20 s, `points.js`).
- **Ordem que gira:** a vez começa na baía seguinte à última que resgatou (`vez = (i + 1) % BAYS`). Sem resgate, segue de 0 a 3.
- **Trava na conta, em todas as baías:** `travadosDaConta` filtra as travas globais pela conta, não pela baía que clicou.
- **Leitura de bônus velha:** usa o maior prazo por tipo entre as baías com o mesmo login.
- **Na fila:** `outra-live` mostra «Na fila» e «Outra live está resgatando. Este resgate vem depois.» (`live-bonus.js`). Sai sem registrar falha nem log.
- **Painel:** a linha de último resgate mostra a frase curta, por exemplo «XP falhou às 01:16: recompensa indisponível agora (canal)», mais «Detalhes no log de resgates.». Percurso, Vi, diálogos, botões, card, fase, clicou, cabeçalho e Diag saíram da tela.
- **Log:** `comDiag` (`controller.js`) anexa `detalhe.diag` às falhas e aos cliques sem confirmação. Antes, esse diagnóstico não ia ao log.
- **Regra de clique:** a terceira exceção, card da lista pelo número do custo exato, foi autorizada pelo usuário em 2026-11-07. Está documentada em `projeto.md`.

### Por quê
Pedido do usuário: não resgatar em duas lives juntas. No log de 2026-11-07 não havia duplicata; o furo era entre baías com a mesma conta. Agora só um resgate roda por vez em toda a Mesa. O usuário também pediu tirar os diagnósticos da tela e deixá-los nos logs.

### Mudança de comportamento
- Um resgate em curso segura as outras baías. Pior caso de 180 s (`PRAZO_CONFIRMACAO_MS`), não medido.
- Baía que espera não grava falha nem log.
- Clique sem confirmação vale para a conta em todas as baías, não só na que clicou.
- Painel sem diagnóstico; o detalhe fica em `%APPDATA%\Mesa\logs\twitch-resgate.log`.

### Arquivos de produto
Lista feita por leitura e busca no código. O repositório ainda não tem commit (branch `master` sem commits), então o diff não isola esta entrega. Trechos confirmados:
- `dashboard/src/main/twitch/controller.js`: `outraLiveOcupada`, `travadosDaConta`, ordem por vez, prazo maior por tipo, `comDiag`.
- `dashboard/src/main/twitch/points.js`: `INTERVALO_RESGATE_MS`, `PRAZO_CONFIRMACAO_MS`, `limparDiag`.
- `dashboard/src/renderer/live-bonus.js`: «Na fila», frase curta, nota de log, retirada do diagnóstico.
- `dashboard/src/renderer/live-bonus.test.js`: lista `TERMOS_FORA_DA_TELA`.

### Testes
- `npm test` em `dashboard/`: **784** passaram em 2026-11-07, segundo o relato do usuário; mais **12** de `erros-log.test.js`, fora do script. A documentação não rodou a suíte.
- Simulação de 4 baías × 4 lives por 4 h: nenhum resgate simultâneo (relato do usuário).

### Confirmado na Twitch real (2026-11-07, tftoddy)
- **XP** às 01:15:38 e **Captura** às 01:16:06: confirmados, com multi-live e correção do saldo.
- **Shiny** às 01:16:28: Redeem desabilitado, sem clique e sem gasto. Causa provável: saldo insuficiente, não confirmada, porque o log não grava o saldo.
- Isto substitui qualquer frase anterior de que o resgate do multi-live não fechou.
- Não rodaram na Twitch real: a trava global, o foco e o painel limpo.

### Não confirmado
- Causa do Shiny (saldo insuficiente): inferência; o log não grava saldo.
- Espera de até 180 s no pior caso: mapeada pela constante, não medida.
- Trava global, foco e painel limpo: sem rodada na Twitch real.

### Limites conhecidos
- Tentativas sem clique podem se repetir, sem gastar pontos.
- Ao tirar um canal, pode sair um resgate nele no tick seguinte.
- A trava vive só em memória.

### Patch note

**Patch «Vigília» · um resgate por vez · 07/11/2026**

Resumo: só um resgate roda por vez em toda a Mesa, com 20 s entre um e outro. O diagnóstico de falha sai do painel e vai para o log. XP e Captura confirmados na Twitch real; Shiny ficou sem clique.

**Novidades**
- [Novo] Um resgate por vez entre baías e lives, com contas diferentes; intervalo global de 20 s.
- [Novo] Baía que espera a vez mostra «Na fila», sem contar falha.

**Correções**
- [Correção] Diagnóstico completo (percurso, Vi, diálogos, botões, fase, diag) vai para o log, não para a tela.

**Ajustes**
- [Ajuste] Painel mostra uma frase curta por falha e «Detalhes no log de resgates.».
- [Ajuste] A ordem entre baías gira a cada resgate.
- [Ajuste] Leitura de bônus velha usa o maior prazo da mesma conta.

**Mudança de comportamento**
- [Mudança] Clique sem confirmação vale para a conta em todas as baías.
- [Mudança] Baía em espera não grava falha nem log.
- [Mudança] Terceira exceção à regra de clique: card da lista pelo número do custo exato, autorizada pelo usuário.

**Conhecidos**
- Tentativas sem clique podem se repetir, sem gastar pontos.
- Ao tirar um canal, pode sair um resgate nele no tick seguinte.
- Trava só em memória.
- Shiny às 01:16 ficou sem clique; causa provável saldo insuficiente, não confirmada.

## 2026-11-07 — Patch «Vigília» · saldo do Redeem e foco por live

> Cada live ganha um foco (Automático, XP, Captura ou Shiny). Com foco, a live gasta só naquele bônus e guarda o saldo até dar o custo. O botão de saldo deixa de ser lido como recompensa no Redeem. Nada disso foi testado na Twitch real.

### Destaques do patch
- **Foco por live:** seletor Foco em cada linha de live, salvo por canal e mantido entre vagas.
- **Saldo que não resgata:** o botão de saldo, com número exato ou com o texto abreviado do resumo, não é mais clicado como recompensa.
- **Boost desligado avisado:** aviso e botão «Ligar X» na própria linha, em que X é o boost do foco.

### O que mudou
- **Botão de saldo:** `saldoDoResumo` lê o saldo uma vez por fluxo de resgate. `eBotaoSaldo` reconhece o botão de saldo exato (número igual ao saldo) ou com texto idêntico ao saldo abreviado do resumo (ex.: 1.2K). Saldo ilegível não exclui nenhum botão.
- **Lista do Redeem:** o card real e o botão de saldo são ambos só número. O botão de saldo só sai da lista se tiver `aria-label` preenchido; a checagem é de presença do atributo, sem ler o texto.
- **Foco por canal:** `twitchFoco` na baía (login em minúsculas para xp, captura ou shiny; ausência da chave é Automático; até 64 entradas), normalizado em `catalog.js`. O foco acompanha o canal entre vagas; canal novo começa em Automático.
- **Escolha entre lives:** live com foco só gasta naquele tipo e guarda o saldo até dar o custo. Com as duas com saldo, vence a focada. Automático pode pagar um boost focado por outra live sem saldo. Sem candidato, vale a espera agregada já existente.
- **Boost desligado em Recompensas:** a opção mostra «(desligado)», a linha mostra um aviso e o botão «Ligar X», que liga só o boost do foco (XP, Captura ou Shiny). Live com foco num tipo desligado só junta pontos.

### Por quê
Falhas reais do log de 2026-11-06 e 07. Em tftoddy, `redeem-lista` com saldo acima de 1.000: o log indica saldo abreviado, mas o texto do botão não foi gravado, então é inferência forte. Em BengaPoints, `redeem-varios` com saldo exatamente 300, igual ao custo. Nos dois casos, o botão de saldo era lido como recompensa. O foco deixa cada live gastar só no bônus que o usuário escolheu.

### Mudança de comportamento
- Botão de saldo reconhecido deixa de contar como recompensa na lista do Redeem.
- Foco por live altera a escolha de resgate entre as lives da baía.
- O saldo do resumo é lido uma vez por fluxo, antes das buscas por custo.

### Arquivos de produto
Lista feita por leitura e busca no código. O diff de `dashboard/` mistura trabalho anterior ainda não commitado, então esta lista não é isolada por entrega:
- `dashboard/src/shared/twitch-dom.js`: `saldoDoResumo`, `eSaldoExato`, `eBotaoSaldo`, `cardsPorCusto`, `acharRedeemPorTexto`, `resgatarFluxo`.
- `dashboard/src/shared/catalog.js`: `mesaTwitchFoco`.
- `dashboard/src/main/twitch/points.js`: escolha entre lives com foco.
- `dashboard/src/main/twitch/controller.js`: `focoDe`, foco por vaga.
- `dashboard/src/main/index.js`: foco por baía no estado.
- `dashboard/src/renderer/live-bonus.js` e `live-bonus.css`: seletor Foco, aviso e «Ligar X».

### Testes
- `npm test` em `dashboard/`: **751** passaram em 2026-11-07, rodado na suíte final; mais **12** de `erros-log.test.js`, fora do script. A documentação não rodou a suíte.
- Harness de foco com 8 h simuladas.
- Reprodução com DOM falso dos dois casos do log (tftoddy e BengaPoints).
- Capturas de prévia em 1024 e 1440 px, tema escuro e claro, sem rolagem lateral.

### Não confirmado
- **Nada disso rodou na Twitch real.** O multi-live chegou até a tela do Redeem na Twitch real, mas o resgate ainda não fechou.
- Texto exato do botão de saldo de tftoddy: inferência pelo log abreviado.

### Limites conhecidos
- Trocar o foco com resgate já em curso não cancela esse resgate.
- Foco num boost que o canal não oferece deixa os pontos parados e pode pausar o canal. Ex.: patopapao não tem card de 300.
- Saldo sem `aria-label` e sem card do custo ainda pode ser clicado (regra antiga); clicar nele não resgata.

### Patch note

**Patch «Vigília» · saldo do Redeem e foco por live · 07/11/2026**

Resumo: cada live ganha um foco de bônus, e o botão de saldo deixa de ser lido como recompensa no Redeem. Nada disso foi testado na Twitch real.

**Novidades**
- [Novo] Foco por live: Automático, XP, Captura ou Shiny, salvo por canal.
- [Novo] Boost desligado em Recompensas mostra aviso e «Ligar X» na linha.

**Correções**
- [Correção] Botão de saldo com número exato (ex.: 300) ou abreviado (ex.: 1.2K) não é mais clicado como recompensa no Redeem.
- [Correção] Saldo lido uma vez por fluxo de resgate.

**Ajustes**
- [Ajuste] Live com foco só gasta naquele bônus e guarda o saldo; com as duas com saldo, vence a focada.

**Conhecidos**
- Nada disso foi testado na Twitch real; o resgate do multi-live ainda não fechou.
- Foco num boost que o canal não oferece deixa os pontos parados.
- Saldo sem aria e sem card do custo ainda pode ser clicado, sem resgatar.

## 2026-11-06 — Patch «Vigília» · multi-live: cada baía assiste até 4 lives

> Cada baía assiste de 1 a 4 lives oficiais da Twitch ao mesmo tempo (padrão 4). Cada live é um widget no painel «Bônus Twitch», com a sua medição de ganho/h. A Twitch real ainda não foi testada com esta entrega.

### Destaques do patch
- **Até 4 lives por baía:** só canais oficiais; sem escolha, a Mesa escolhe sozinha.
- **Fora do ar:** a escolha fica salva e volta sozinha; o resumo mostra «· X fora do ar» e o botão «Limpar fora do ar».
- **Medição por vaga:** ganho/h por canal, com «Medindo» nos primeiros 15 min.

### O que mudou
- Config: `twitchStreams` (1 a 4, padrão 4) e `twitchCanais` por baía. Valor fora da faixa vira 4; canal inválido, repetido ou além do limite sai.
- Painel «Bônus Twitch»: um widget por baía, com seletor de 1 a 4 lives e «Escolher canais (N de L)».
- Pontos por canal, sem soma: a Mesa resgata numa live aberta com saldo, com uma janela por tick no total. Em 4 baías × 4 lives são 16 janelas.
- Uma janela escondida da Twitch por vaga (`windows.js`), na partição da baía.
- Log `%APPDATA%\Mesa\logs\twitch-resgate.log` traz canal e stream, e grava `confirmado`, `ganho` a cada 30 min, `trava-vencida`, `clicado-depois-da-troca` e `trava-por-troca-de-login`.

### Por quê
O usuário pediu mais de uma live por baía. Como os pontos são por canal, cada live rende em separado, e a medição por vaga mostra quanto cada uma dá.

### Mudança de comportamento
- **Trava de gasto duplo:** clique sem confirmação vira trava por conta e tipo, só em memória. Desligar o automático ou trocar de conta não solta mais a trava (decisão do usuário).
- A trava sai quando o bônus da mesma conta sobe, ou vence em 3 h (`PRAZO_TRAVA_MS`). Bônus de outra conta não solta.
- Reiniciar a Mesa limpa a trava e pode gerar um novo resgate.
- Clique que chega depois de troca de login é atribuído à conta que clicou.

### Arquivos de produto
Lista feita por busca de termos no código, não pelo diff: `dashboard/` aparece como não rastreado no git, então o diff não estava disponível. Lidos:
- `dashboard/src/main/twitch/controller.js`: decisão por baía e vaga, trava, medição e log.
- `dashboard/src/main/twitch/points.js`: escolha de resgate por canal.
- `dashboard/src/main/twitch/windows.js`: `createTwitchWindows`, uma janela por vaga.
- `dashboard/src/shared/catalog.js`: `twitchStreams` e `twitchCanais`.
- `dashboard/src/renderer/live-bonus.js`: widget por baía e resumo «fora do ar».

Também aparecem na busca, sem leitura do conteúdo: `dashboard/src/main/index.js` e `dashboard/src/renderer/view.js`.

### Testes
- `npm test` em `dashboard/`: **713** passaram, segundo o relato da entrega. Esta documentação não rodou a suíte.
- `src/main/twitch/erros-log.test.js` tem **12** testes e não entra no `npm test`.
- Cenários com janelas falsas.
- Capturas do painel em 1024 e 1440 px, temas escuro e claro, sem rolagem lateral e sem controle sem nome. As capturas foram feitas antes dos três últimos ajustes de contagem.

### Não confirmado
- **Nada disso rodou na Twitch real.**
- **Limite de 2 streams:** não confirmado oficialmente; só relatos de terceiros. Hipóteses: H1, todas as lives contam (~1280 pts/h por baía); H2, só duas contam (~640 a 1040 pts/h); H3, acima de duas nada conta. Não há rotação: a medição por canal decide, e se indicar, reduz para 2.
- **Roteiro de medição:** uma baía com 4 lives por 60 min, lendo o ganho/h de cada vaga; depois repetir com 4 baías.
- **Consumo de 16 janelas:** não medido aqui. Estimativa de terceiros: ~4 GB de RAM e ~21% de CPU.

### Limites conhecidos
- Tentativas sem clique podem se repetir com login oscilando ou quando a página não responde. Não gastam pontos.
- Expiração sem clique conta falha na baía inteira: três seguidas pausam o tipo por 1 h em todas as lives da baía.
- Mesma conta em duas baías: uma trava não barra a outra.
- Recarga numa troca de login pode derrubar um clique em curso (janela mínima).
- Abertura por ordem de baía: a baía 4 pode começar ~26 s depois.

### Patch note

**Patch «Vigília» · multi-live · 06/11/2026 · cada baía assiste até 4 lives**

Resumo: cada baía assiste de 1 a 4 lives oficiais da Twitch ao mesmo tempo, com medição de ganho/h por canal. A Twitch real ainda não foi testada.

**Novidades**
- [Novo] Até 4 lives por baía, com escolha de canais oficiais no painel «Bônus Twitch».
- [Novo] Escolha fora do ar volta sozinha, com «Limpar fora do ar» no resumo.
- [Novo] Ganho/h por canal, com «Medindo» nos primeiros 15 min.

**Ajustes**
- [Ajuste] Padrão de 4 lives por baía; configurável de 1 a 4.
- [Ajuste] Log do resgate traz canal e stream, e registra confirmações e medições.

**Correções**
- [Correção] Clique que chega depois de troca de login é atribuído à conta que clicou.

**Mudança de comportamento**
- [Mudança] Clique sem confirmação vira trava por conta e tipo. Desligar o automático ou trocar de conta não solta a trava. Ela sai quando o bônus da conta sobe ou em 3 h.
- [Mudança] Pontos e resgates são contados por live; a Mesa faz uma janela de resgate por tick no total.

**Conhecidos**
- Nada disso foi testado na Twitch real.
- Limite de 2 streams não confirmado oficialmente; a medição por canal decide.
- Consumo de 16 janelas não medido.

## 2026-11-06 — Patch 0.3.4 «Vigília» · widget Capturas da Espera mostra shiny e normais

> A Espera mostra quantas capturas a sessão já fez, em duas seções: Shiny e Normais. Cada uma tem total, hora da última captura e uma linha por baía. A contagem vem do evento de batalha do jogo e fica só em memória. O formato do evento ainda não foi conferido numa captura real.

### Destaques do patch
- **Duas seções:** Shiny e Normais, cada uma com total e última captura.
- **Por baía:** uma linha por baía; baía fora da grade ou sem login mostra «–» e não entra no total.
- **Só em memória:** a contagem zera ao fechar o app e não guarda espécie.

### O que mudou
- Espera: o widget Capturas deixa de ser um aviso fixo e passa a mostrar as duas seções, com total, «Última: HH:MM» ou «Nenhuma ainda», e uma linha por baía.
- Layout: acima de 900px, com o widget em duas colunas (padrão), as seções ficam lado a lado; abaixo disso, empilhadas.
- Nota «Nenhuma captura registrada nesta sessão.»: aparece só com total zero.
- Contagem: o preload conta o evento `{ k: 'bola', sucesso: true, shiny }`; o app soma o delta de cada relatório cumulativo, e uma repetição não soma.
- Validação: relatório com valor fora de 0 a 1e9 é descartado e não vira zero.

### Por quê
A entrega pediu ver capturas shiny e normais na Espera. O aviso fixo «Nenhuma captura registrada» não mostrava nada além disso. O código não registra motivo adicional.

### Arquivos de produto
- `dashboard/src/preload/hunt-page-state.js`: `applyBattle` conta o evento `bola`.
- `dashboard/src/preload/hunt-page.js`: inclui `capturas` no resumo de caça.
- `dashboard/src/preload/hunt-bridge.js`: `cleanCapturas` (cópia da validação, ver Problemas conhecidos).
- `dashboard/src/shared/capture-tally.js`: `empty`, `apply`, `cleanCapturaReport` (delta por relatório cumulativo).
- `dashboard/src/renderer/app.js`: evento `hunt` aplica `MesaCaptureTally.apply` em `live[i].capturas`.
- `dashboard/src/renderer/standby.js`: `buildCapturesBody`, `paintStandbyCaptures`.
- `dashboard/src/renderer/espera.css`: `.standby-caps`, duas colunas acima de 900px com span 2.
- `dashboard/src/renderer/index.html`: carrega `capture-tally.js`.

### Testes
- `npm test` em `dashboard/`: **626** passaram, segundo o relato da entrega. Esta documentação não rodou a suíte.
- Cobertos: `src/shared/capture-tally.test.js` (delta, repetição, recarga, relatório perdido, troca de nick, validação) e `src/preload/hunt-page.test.js` (evento `bola`, fingerprint).
- Verificado no app isolado: duas colunas acima de 900px, empilhado em 800px e nota de zero.
- Sem teste direto: `cleanCapturas` no `hunt-bridge.js` (depende de electron) e `paintStandbyCaptures`.

### Não confirmado
- **Formato do evento `bola`:** vem de `tools-analysis\pokeidle-manager` (terceiros). Não foi visto num frame real do jogo. Se o formato for outro, o widget fica em zero sem erro.
- **Captura real no jogo:** não feita. A validação com captura real é do usuário.
- **Nota sumindo com captura maior que zero:** não verificada no app.

### Limites conhecidos
- A contagem é só da sessão: fechar o app zera tudo.
- Total e última hora somam só as baías na grade e com login.

### Problemas conhecidos
- **Validação pendente com captura real** no jogo.
- **Validação duplicada:** `cleanCapturas` (`hunt-bridge.js`) e `cleanCapturaReport` (`capture-tally.js`) precisam ficar iguais. `cleanCapturas` existe porque o bridge é concatenado no game-preload; não tem teste direto.
- `forgetBay` não zera o tally. Decisão de produto, a confirmar.
- Possível recarga com crescimento acima do valor anterior: pode contar a mais.
- Ordem state/hunt na troca de nick: não verificada.
- A versão 0.3.4 foi escolhida pelo documentador. `dashboard/package.json` segue em 0.3.2 e não foi tocado; a versão é decisão do usuário.

### Patch note

**Patch 0.3.4 «Vigília» · 06/11/2026 · widget Capturas da Espera mostra shiny e normais**

Resumo: a Espera mostra capturas shiny e normais da sessão, com total, última hora e uma linha por baía. A contagem vem do evento do jogo e ainda não foi conferida numa captura real.

**Espera**
- [Novo] Capturas em duas seções, Shiny e Normais. Antes: aviso fixo «Nenhuma captura registrada nesta sessão.». Depois: total, «Última: HH:MM» e uma linha por baía.
- [Ajuste] Duas colunas acima de 900px; empilhadas até lá.
- [Ajuste] A nota de zero aparece só sem nenhuma captura.

**Capturas**
- [Novo] Contagem da sessão a partir do evento de batalha do jogo. Só em memória: fechar o app zera.
- [Ajuste] Baía fora da grade ou sem login mostra «–» e não entra no total.
- [Correção] Relatório fora de 0 a 1 bilhão é descartado e não vira zero.

**Conhecidos**
- A captura real no jogo não foi feita. Se o formato do evento for outro, o widget fica em zero sem erro.
- `forgetBay` não zera a contagem; recarga com crescimento acima do valor anterior pode contar a mais.

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

## 2026-11-06 — Patch 0.3.3 «Vigília» · widgets modulares na tela Espera

> A Espera vira um quadro de seis widgets: Capturas, Baía 1 a 4 e Recursos do app. Cada um pode ser reordenado, ter uma ou duas colunas, ser recolhido ou ocultado, e a ordem fica salva na configuração. A tela Automações não mudou.

### Destaques do patch
- **Quadro de widgets:** a grade 2×2 de fichas de baía vira um quadro com moldura comum em cada widget.
- **Três formas de reordenar:** arrastar pela alça, Mover antes ou depois no menu, e Alt + seta para cima ou para baixo.
- **Botão Widgets:** lista o que está oculto e restaura o padrão.

### O que mudou
- Espera: seis widgets, duas colunas acima de 900px e uma coluna até 900px. Capturas e Recursos do app ocupam a linha inteira por padrão; cada baía ocupa metade.
- Widget: alça de arrastar, título, marcas de estado nas baías e menu de opções (Mover antes, Mover depois, Uma coluna, Duas colunas, Recolher ou Abrir, Ocultar).
- Arrasto: placeholder no lugar de destino, os outros widgets deslizam em 240ms, Esc cancela.
- Estado vazio: com todos os widgets ocultos, a tela mostra "Todos os widgets estão ocultos." e o botão "Mostrar todos".
- Rodapé de texto da Espera continua fora do quadro e não virou widget.

### Por quê
O plano da entrega pede widgets modulares na Espera. O motivo de produto não está registrado no código.

Antes, segundo `dashboard/docs/projeto.md` como estava antes desta entrega: Capturas acima da grade e grade 2×2 com quatro fichas de baía. O painel «Recursos do app» não aparecia descrito nesse documento, e não há histórico de commits para confirmar como era.

### Arquivos de produto
- `dashboard/src/shared/standby-layout.js`: ordem, largura, ocultos e recolhidos (`normalize`, `move`, `moveTo`, `set`, `reset`).
- `dashboard/src/shared/catalog.js`: `standby` em `MESA_CATALOG.normalize`.
- `dashboard/src/renderer/standby.js`: quadro, alça, arrasto, menus, botão Widgets, estado vazio, anúncios e leitura de processos.
- `dashboard/src/renderer/espera.css`: quadro, moldura, menus, placeholder e reduced-motion.
- `dashboard/src/renderer/index.html`: carrega `standby-layout.js` antes de `standby.js`.

Esta lista vem do código atual. Como o repositório não tem commits, não há diff para confirmar o que mudou em cada arquivo.

### Testes
- `npm test` em `dashboard/`: **562** passaram, 0 falharam, segundo a entrega. Esta documentação não rodou a suíte.
- `src/shared/standby-layout.test.js` cobre ordem, largura, ocultos, recolhidos e normalização. `src/shared/catalog.test.js` cobre o `standby` da configuração.
- `standby.js` não tem suíte própria: arrasto, menus, FLIP e anúncios não têm teste automatizado.

### Não confirmado
- **Verificação em tela:** arrasto, persistência depois de reiniciar, Esc, Alt + seta e reduced-motion não foram vistos no app. Só os testes automatizados rodaram.
- **Estado anterior de «Recursos do app»:** não confirmado.

### Problemas conhecidos
- Alt + seta move só para cima e para baixo. Alt + esquerda e Alt + direita não fazem nada.
- Falta a verificação em tela listada acima antes de considerar a entrega fechada.

### Patch note

**Patch 0.3.3 «Vigília» · 06/11/2026 · widgets modulares na tela Espera**

Resumo: a Espera vira um quadro de seis widgets, com ordem, largura, recolhido e oculto salvos. Dá para reordenar pelo arrasto, pelo menu ou com Alt + seta, e o botão Widgets devolve o que estiver oculto.

**Espera**
- [Novo] Quadro de widgets no lugar da grade 2×2. Antes: Capturas acima e quatro fichas de baía fixas. Depois: Capturas, Baía 1 a 4 e Recursos do app na mesma grade.
- [Ajuste] Duas colunas acima de 900px; uma coluna até 900px. Capturas e Recursos do app ocupam a linha inteira por padrão.
- [Ajuste] O rodapé de texto continua fora do quadro.

**Widgets**
- [Novo] Moldura comum: alça de arrastar, título, marcas de estado nas baías e botão de opções.
- [Novo] Arrastar pela alça, com placeholder e deslize de 240ms. Esc cancela.
- [Novo] Menu: Mover antes, Mover depois, Uma coluna, Duas colunas, Recolher ou Abrir, Ocultar.
- [Novo] Alt + seta para cima ou para baixo, com a alça focada.
- [Novo] Botão Widgets: mostra cada oculto e restaura o padrão.
- [Novo] Estado vazio com "Mostrar todos".
- [Novo] Estado salvo em `cfg.standby`, a cada ação.
- [Novo] Anúncio em região de status: "Baía 2 movida para a posição 3."

**Correções e qualidade de vida**
- [Ajuste] A leitura de processos para quando o widget Recursos do app está oculto ou recolhido. Há um só intervalo, sem duplicar.
- [Ajuste] Os movimentos pulam widgets ocultos.
- [Ajuste] Com redução de movimento, não há deslize, o arrasto não escala e as transições dos widgets são zeradas.
- [Ajuste] As baías da tela Automações não mudaram.

**Problemas conhecidos**
- A verificação em tela não foi feita: arrasto, persistência após reinício, Esc, Alt + seta e redução de movimento. Só os testes automatizados rodaram.
- Alt + seta move só para cima e para baixo.

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
