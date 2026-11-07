# PokeIdle Automation

PokeIdle Automation é o aplicativo de Windows para jogar [pokeidle.io](https://pokeidle.io/app) em até quatro contas ao mesmo tempo, neste computador. Cada conta fica numa baía, com a sessão guardada localmente. A senha continua na página do jogo.

[Baixar Mesa.exe](https://github.com/pdrfps1/mesa-pokeidle/releases/latest/download/Mesa.exe) · versão 0.3.2 · Windows

O Windows pode pedir confirmação na primeira abertura. O link acima baixa a versão 0.3.2, que se chama Mesa. A partir da release 0.4.0 (ainda não publicada), o app passa a se chamar PokeIdle Automation e a release traz `PokeIdle-Automation.exe` (portátil), `PokeIdle-Automation-Setup.exe` (instalador) e `Mesa.exe` (alias do portátil, com os mesmos bytes, para quem atualiza pela versão antiga).

As imagens abaixo usam contas de exemplo (Conta A, B e C) para mostrar os estados da mesa. No aplicativo, o jogo abre dentro de cada baía.

## Mesa

A tela principal mostra as quatro baías e o resumo: caçando, medindo, paradas e sem sessão. A baía em foco tem a borda azul. Os interruptores dessa baía apertam os controles que o jogo já mostra.

![Mesa com quatro baías, resumo de estados e automações da conta em foco](docs/imagens/mesa.png)

- **Caçando** — a conta está ganhando XP.
- **Medindo** — a sessão existe e o app ainda está calculando o XP/h.
- **Parada** — a sessão existe e o XP/h chegou a zero.
- **Sem sessão** — a baía ainda não tem login.

Na baía em foco dá para mudar o mapa, a Pokédex, o depot, o boss e o mercado, recarregar a página, igualar as quatro contas e sair daquela conta. Sair pede confirmação e apaga só a sessão daquela baía. **Fechar** esconde o jogo e guarda o login. **Tirar** tira a baía da grade e para o jogo dessa conta. Em Ajustes, **Fora da grade** devolve a baía, com o login guardado.

**Lançar até capturar** e **Lançar sem parar** são VIP e se excluem. **Usar revive ao desmaiar**, **Usar poções** e **Voltar à hunt ao morrer/reset** valem para a baía em foco. A poção só entra abaixo da porcentagem escolhida. Voltar à hunt só acontece enquanto houver poção ou revive na bolsa.

**Mapa automático** troca o mapa dessa conta quando outra hunt rende mais XP de treinador. O interruptor começa desligado. Com ele ligado, o app lê o guia de hunts e só manda trocar se a outra hunt render pelo menos cerca de 8% a mais do que o mapa atual, usando o comando do jogo. A troca respeita a trava do cliente: com a cena de combate ligada, só acontece entre ondas, quando o combate está liberado; em Modo Economia ou Modo Ultra, campo vazio não libera sozinho e vale o carimbo do servidor. Depois de entrar num mapa, o jogo impõe uma pausa de cerca de 10 segundos antes de trocar de novo. O app não sai do Safari sozinho. O melhor farm ao lado da baía (XP/h e ouro/h) é só informação — não troca o mapa por aparecer ali.

## Espera

Em Espera o jogo sai da tela e a conta continua. Poção e ball podem reagir um pouco mais devagar. Cada carta mostra nível, ouro, XP/h, mapa, memória e o que está ligado. **Ver jogo** volta para a Mesa naquela baía. Fechar e tirar a baía ficam na tela Mesa.

![Espera com o resumo das quatro contas fora da tela](docs/imagens/espera.png)

## Ajustes

![Ajustes de tema, disposição, rastreadores, sniper e processamento](docs/imagens/ajustes.png)

- **Modo noturno** e **Modo otimizado** usam opções que o jogo já oferece. O modo otimizado reduz animação na luta.
- **Disposição** alterna grade, fila, coluna ou livre. No modo **Livre**, cada baía tem o próprio tamanho: arraste o canto inferior direito da baía ou use **Largura** e **Altura** na coluna da baía em foco. Altura **Automática** deixa a baía do tamanho do conteúdo.
- **Rastreadores** corta anúncio e analytics da página. Passa a valer na próxima abertura.
- **Sniper da baía em foco** começa desligado. Com o mercado aberto, clica em Comprar só nos nomes listados, separados por vírgula, quando o preço da tela está até o teto.
- **Processamento** mede mesa, GPU e cada baía. A tabela enche depois de uns 20 segundos estáveis em cada situação: sem baía, uma baía, quatro baías, janela minimizada e Ajustes. O tempo passado em Espera entra na mesma leitura de Ajustes.

## Neste computador

São quatro baías, o teto de contas. Mudo, economia e a escala valem para a baía em foco. A escala volta para o tamanho automático pelo botão ao lado do controle.

Para instalar a partir deste repositório, no Windows, dê dois cliques em `instalar.cmd`. Ele instala o Node.js LTS se faltar, baixa as dependências e abre o PokeIdle Automation.

Pelo terminal, na pasta do repositório:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\instalar.ps1
```

### Build e release

`npm run dist`, na pasta `dashboard/`, gera em `dist/` três arquivos:

- `PokeIdle-Automation-Setup.exe`: instalador. Instala por usuário, sem UAC, com escolha de pasta, atalhos na área de trabalho e no menu Iniciar, e desinstalador.
- `PokeIdle-Automation.exe`: portátil, sem instalação.
- `Mesa.exe`: alias do portátil, com os mesmos bytes. Existe para quem tem a versão até 0.3.2, que só procura esse nome na release.

A release no GitHub precisa publicar os três arquivos. O build não é assinado (sem certificado), então o Windows pode avisar. O script reescreve o `package.json` durante o build e restaura no fim, por isso o build deve rodar fora de um checkout compartilhado.

Nome e marca: o nome visível e os nomes dos arquivos ficam em `src/shared/brand.js`. O `package.json` repete os mesmos valores, e `src/shared/brand.test.js` falha se divergirem. Para trocar o nome, mude os dois. A marca sai de `build/logo-source.webp` pelo script `python scripts/build-brand-assets.py` (requer Pillow), que gera os ícones e as imagens do instalador.

Os dados ficam em `%APPDATA%\Mesa`: configuração, logins e sessões. A pasta não mudou com o nome novo. Por isso o portátil e o instalado usam os mesmos dados: não abra os dois ao mesmo tempo.

## Licença

MIT. PokeIdle Automation não é o site pokeidle.io e não é afiliado a ele.
