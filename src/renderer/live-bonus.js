// Painel "Bônus Twitch" de Configurações. Só textContent: nada do snapshot vira HTML.
const LIVE_BONUS_TIPOS = ['xp', 'captura', 'shiny'];
const LIVE_BONUS_ROTULO = { xp: 'XP', captura: 'Captura', shiny: 'Shiny' };
const LIVE_BONUS_CUSTO = { xp: 300, captura: 500, shiny: 1000 };
const LIVE_BONUS_PARADO = new Set([
  'sem-saldo-lido', 'sem-recompensa', 'sem-login-pagina', 'nao-vinculado',
  'sem-login-jogo', 'conta-diferente', 'pausado', 'sem-ganho', 'erro-baia', 'erro-pagina', 'sem-confirmacao', 'sem-leitura',
]);
const LIVE_BONUS_MOTIVO = {
  'sem-resumo': 'não achei os pontos do canal',
  'sem-recompensa': 'não achei a recompensa',
  'sem-botao': 'não achei o botão de resgatar',
  indisponivel: 'recompensa indisponível agora',
  'pede-texto': 'a recompensa pede texto',
  tempo: 'a página demorou',
  ocupado: 'outro resgate em andamento',
  outro: 'erro na página',
  'sem-centro': 'não abriu a lista de recompensas',
  'recompensa-ambigua': 'mais de uma recompensa com esse nome',
};
const LIVE_BONUS_FRASE = {
  desligado: () => 'Desligado.',
  'sem-jogo': () => 'Baía sem sessão do jogo. A Twitch fica fechada.',
  'sem-bloco': () => 'O jogo ainda não mandou o bônus Twitch desta conta.',
  'sem-login': () => 'Entre na Twitch nesta baía, pelo navegador ou na janela do app.',
  'sem-canal': () => 'Nenhuma live oficial com pontos no ar agora.',
  'janela-aberta': () => 'Janela aberta. O resgate espera você esconder ou fechar a janela.',
  abrindo: (c) => (c ? `Abrindo a live de ${c}.` : 'Abrindo a live.'),
  assistindo: (c) => (c ? `Assistindo ${c}.` : 'Assistindo.'),
  juntando: (c) => `${c ? `Assistindo ${c}. ` : ''}Juntando pontos para o próximo resgate.`,
  'outra-live': () => 'Outra live está resgatando. Este resgate vem depois.',
  resgatando: () => 'Resgatando um bônus.',
  'sem-saldo-lido': (c) => (c
    ? `Assistindo ${c}, mas não achei o saldo de pontos na página.`
    : 'Não achei o saldo de pontos na página.'),
  'sem-recompensa': () => 'Este canal não mostrou a recompensa escolhida.',
  'sem-login-pagina': () => 'A página da Twitch saiu da conta. Entre de novo.',
  'nao-vinculado': () => 'Vincule a Twitch no jogo, na linha Bônus Twitch. Resgate parado.',
  'sem-login-jogo': () => 'O jogo não mandou a conta vinculada. Resgate parado.',
  'conta-diferente': (_c, bay) => `A Twitch desta baía (${bay.loginTwitch}) não é a vinculada no jogo (${bay.loginJogo}). Resgate parado.`,
  pausado: (_c, bay) => `Resgate pausado depois de 3 falhas. Volta às ${liveBonusHora(bay.pausadoAte)}.`,
  'sem-ganho': () => 'Os pontos não sobem nesta baía. Mostre a janela para conferir.',
  'erro-baia': () => 'Esta baía teve um erro interno na Twitch. As outras seguem normalmente.',
  'erro-pagina': () => 'A página da Twitch não carregou. Tento de novo sozinho.',
  'sem-leitura': () => 'O jogo ainda não mandou o prazo dos bônus. Resgate parado.',
  'sem-confirmacao': () => 'Cliquei no resgate e a Twitch não confirmou. Este tipo fica parado até o bônus subir ou por 3 h. Reiniciar o app também libera, mas pode gerar um novo resgate.',
};

// Dados de pré-visualização para abrir o painel em file:// (sem window.mesa).
const LIVE_BONUS_PREVIEW = (() => {
  const agora = Date.now();
  const vazio = { xp: 0, captura: 0, shiny: 0 };
  return {
    kickAoVivo: [{ slug: 'exemplo', nome: 'Exemplo Kick', espectadores: 120 }],
    twitch: {
      enviadoEm: agora,
      custos: { ...LIVE_BONUS_CUSTO },
      bays: [
        {
          auto: true, jogo: true, vinculado: true, loginJogo: 'treinador', loginTwitch: 'treinador', contaBate: true,
          janela: 'oculta', modo: 'oculta', canal: { login: 'canalx', nome: 'Canal X' }, video: 'rodando',
          pontos: { texto: '1,2 mil', minimo: 1150 }, bonus: { xp: 42 * 60000, captura: 0, shiny: 0 }, pct: 15,
          ultimo: { tipo: 'xp', em: agora - 3600000, estado: 'ok', motivo: '', canal: 'canalx' }, pausadoAte: 0, situacao: 'assistindo',
          alvo: 2, ganhoTotalHora: 1200, escolhidos: ['canalx'],
          oficiais: [
            { login: 'canalx', nome: 'Canal X', espectadores: 300, aoVivo: true, ativo: true },
            { login: 'canalz', nome: 'Canal Z', espectadores: 90, aoVivo: true, ativo: true },
          ],
          streams: [
            { k: 0, s: 0, canal: { login: 'canalx', nome: 'Canal X' }, escolhido: true, substitui: null, janela: 'oculta', modo: 'oculta', video: 'rodando', pontos: { texto: '1,2 mil', minimo: 1150 }, ganhoHora: 1200, baus: 1, aproximado: true, medindo: false, semGanho: false, pausadoAte: 0, situacao: 'assistindo' },
            { k: 4, s: 1, canal: { login: 'canalz', nome: 'Canal Z' }, escolhido: false, substitui: null, janela: 'oculta', modo: 'oculta', video: 'rodando', pontos: { texto: '900', minimo: 900 }, ganhoHora: null, baus: 0, aproximado: false, medindo: true, semGanho: false, pausadoAte: 0, situacao: 'juntando' },
          ],
        },
        {
          auto: true, jogo: true, vinculado: true, loginJogo: 'treinador', loginTwitch: 'outra', contaBate: false,
          janela: 'oculta', modo: 'oculta', canal: { login: 'canaly', nome: 'Canal Y' }, video: 'rodando',
          pontos: { texto: '800', minimo: 800 }, bonus: vazio, pct: 0,
          ultimo: null, pausadoAte: 0, situacao: 'conta-diferente',
        },
        {
          auto: true, jogo: true, vinculado: true, loginJogo: 'treinador', loginTwitch: '', contaBate: false,
          janela: 'fechada', modo: 'oculta', canal: null, video: '', pontos: null, bonus: vazio, pct: 0,
          ultimo: null, pausadoAte: 0, situacao: 'sem-login', navegador: { estado: 'aberto', motivo: '', em: agora },
        },
        {
          auto: false, jogo: false, vinculado: null, loginJogo: '', loginTwitch: '', contaBate: false,
          janela: 'fechada', modo: 'oculta', canal: null, video: '', pontos: null, bonus: vazio, pct: 0,
          ultimo: null, pausadoAte: 0, situacao: 'desligado',
        },
      ],
    },
  };
})();

function liveBonusTemMesa() {
  return !!(window.mesa && typeof window.mesa.liveGet === 'function');
}

function liveBonusSalvar() {
  if (liveBonusTemMesa() && typeof save === 'function') save();
}

function liveBonusHora(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function liveBonusDuracao(ms) {
  const minutos = Math.floor(ms / 60000);
  if (minutos < 1) return 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

function liveBonusAtivos(bay, decorrido) {
  const partes = [];
  for (const tipo of LIVE_BONUS_TIPOS) {
    const restante = Math.max(0, ((bay.bonus && bay.bonus[tipo]) || 0) - decorrido);
    if (restante > 0) partes.push(`${LIVE_BONUS_ROTULO[tipo]} ${liveBonusDuracao(restante)}`);
  }
  return partes.length ? partes.join(' · ') : 'nenhum ativo';
}

// Último resgate no painel: só a frase curta (nome, hora e motivo). O detalhe vai para o log de resgates.
function liveBonusUltimo(ultimo) {
  if (!ultimo) return '—';
  const nome = LIVE_BONUS_ROTULO[ultimo.tipo] || 'Bônus';
  const hora = liveBonusHora(ultimo.em);
  if (ultimo.estado === 'ok') return `${nome} às ${hora}`;
  if (ultimo.estado === 'clicado') return `${nome} clicado às ${hora}, aguardando confirmação`;
  if (ultimo.estado === 'falhou') return `${nome} falhou às ${hora}: ${LIVE_BONUS_MOTIVO[ultimo.motivo] || LIVE_BONUS_MOTIVO.outro}`;
  return `${nome} sem confirmação do jogo às ${hora}`;
}

function liveBonusFatos(bay, decorrido) {
  let jogo = '—';
  if (bay.vinculado === true) jogo = `${bay.loginJogo || '—'} · ${bay.contaBate ? 'a mesma' : 'outra conta'}`;
  else if (bay.vinculado === false) jogo = 'não vinculada';
  return [
    bay.loginTwitch || 'não entrou',
    jogo,
    liveBonusAtivos(bay, decorrido),
    liveBonusUltimoComCanal(bay.ultimo),
  ];
}

function liveBonusFrase(bay) {
  const canal = bay.canal ? (bay.canal.nome || bay.canal.login) : '';
  const frase = LIVE_BONUS_FRASE[bay.situacao];
  return frase ? frase(canal, bay) : '';
}

// Dica do login pelo navegador: fica fora da região role="status" da baía.
const LIVE_BONUS_NAVEGADOR = {
  aberto: () => 'O app abriu uma janela para esta baía. Entre na Twitch nesta janela que abriu e feche-a. O login entra sozinho nesta baía.',
  importando: () => 'Copiando o login do navegador.',
  ok: (auto) => (auto
    ? 'Login copiado do navegador. «Assistir e resgatar sozinho» ficou ligado nesta baía.'
    : 'Login copiado do navegador.'),
  pending: () => 'Ainda não há login nessa janela. Entre na Twitch nela, feche-a e clique em «Já entrei».',
  'leitura-falhou': () => 'Não consegui ler o navegador desta baía. Feche todas as janelas dele e clique em «Já entrei».',
  'no-browser': () => 'Instale o Microsoft Edge ou o Google Chrome para entrar pelo navegador.',
  'browser-open': () => 'Feche a janela do navegador de login desta baía antes de clicar em «Já entrei».',
  failed: () => 'Não foi possível copiar o login. Feche o navegador e clique em «Já entrei».',
  'perfil-em-uso': () => 'Feche o navegador de login desta baía para apagar o perfil dele.',
};

function liveBonusDica(nav, agora, auto) {
  if (!nav || !nav.estado) return { texto: '', parado: false };
  if (nav.estado === 'ok' && agora - (nav.em || 0) > 60000) return { texto: '', parado: false };
  const chave = nav.estado === 'falhou' ? (nav.motivo || 'failed') : nav.estado;
  const frase = LIVE_BONUS_NAVEGADOR[chave] || LIVE_BONUS_NAVEGADOR.failed;
  const parado = nav.estado === 'falhou' && (chave === 'failed' || chave === 'perfil-em-uso' || chave === 'leitura-falhou');
  return { texto: frase(auto), parado };
}

// live:status e live:get trazem o snapshot inteiro; as rotas twitch:* devolvem só o bloco da Twitch.
function liveBonusJuntar(snap, data) {
  return data.twitch ? data : { ...snap, twitch: data };
}

// O "ok" fica no snapshot até o Sair: só um horário novo conta. Devolve as baías e avança o marco.
function liveBonusLoginsNovos(tw, vistoEm) {
  const novas = [];
  const bays = tw && Array.isArray(tw.bays) ? tw.bays : [];
  bays.forEach((bay, i) => {
    const nav = bay && bay.navegador;
    if (!nav || nav.estado !== 'ok' || !(nav.em > vistoEm[i])) return;
    vistoEm[i] = nav.em;
    novas.push(i);
  });
  return novas;
}

function liveBonusKickKey(lista) {
  return JSON.stringify(lista || []);
}

// Texto curto da situação de cada live (coluna Estado). Situação fora da lista cai em 'Parado'.
const LIVE_BONUS_SITUACAO_CURTA = {
  desligado: 'Desligado',
  assistindo: 'Assistindo',
  juntando: 'Juntando',
  'outra-live': 'Na fila',
  resgatando: 'Resgatando',
  abrindo: 'Abrindo',
  'janela-aberta': 'Janela aberta',
  'sem-login-pagina': 'Sem login',
  'sem-ganho': 'Sem ganho',
  pausado: 'Pausado',
  'sem-saldo-lido': 'Sem saldo lido',
  'sem-recompensa': 'Sem recompensa',
  'sem-confirmacao': 'Sem confirmação',
  'sem-leitura': 'Sem leitura',
  'erro-pagina': 'Erro na página',
  'erro-baia': 'Erro interno',
};
const LIVE_BONUS_ATIVA = new Set(['assistindo', 'juntando', 'resgatando', 'janela-aberta', 'outra-live']);
const LIVE_BONUS_LIVES_MAX = 4;

// Login como o backend: minúsculas, sem espaço, 1 a 25 caracteres de letra, número ou sublinhado.
const LIVE_BONUS_LOGIN_RE = /^[a-z0-9_]{1,25}$/;
function liveBonusNorm(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

// Limite de canais da baía: o número de lives que ela assiste (padrão 4).
function liveBonusLimite(cfgBay) {
  return cfgBay && Number.isInteger(cfgBay.twitchStreams) ? cfgBay.twitchStreams : LIVE_BONUS_LIVES_MAX;
}

// Só troca o texto quando ele muda, para não mexer no DOM à toa.
function liveBonusDefinir(no, texto) {
  if (no.textContent !== texto) no.textContent = texto;
}

// Texto do erro de uma chamada à Mesa: a mensagem dela, ou o texto padrão quando não há.
function liveBonusMensagemErro(error, padrao) {
  return error && error.message ? error.message : padrao;
}

// Último resgate com o canal (quando o resultado trouxe o canal).
function liveBonusUltimoComCanal(u) {
  const base = liveBonusUltimo(u);
  return u && typeof u.canal === 'string' && u.canal ? `${base} (${u.canal})` : base;
}

// Forma e texto da luz da baía: nunca só cor.
function liveBonusLuz(bay) {
  if (bay.situacao === 'desligado') return { texto: '○ Desligado', parado: true };
  if (LIVE_BONUS_PARADO.has(bay.situacao)) return { texto: '○ Parado', parado: true };
  if (LIVE_BONUS_ATIVA.has(bay.situacao)) return { texto: '● Ativo', parado: false };
  return { texto: '◐ Em espera', parado: false };
}

// Taxa somada das lives da baía. Antes de 15 min de medição, não há número.
function liveBonusTaxa(bay) {
  const v = bay.ganhoTotalHora;
  if (!Number.isFinite(v)) return 'Medindo o ganho';
  return `≈ ${v.toLocaleString('pt-BR')} pontos/h`;
}

// Coluna Ganho/h de uma live: Medindo antes de 15 min, ≈ em leitura abreviada.
function liveBonusGanhoLinha(st) {
  if (!st || !st.canal) return '—';
  if (st.medindo === true) return 'Medindo';
  if (!Number.isFinite(st.ganhoHora)) return '—';
  return `${st.aproximado ? '≈ ' : ''}${st.ganhoHora.toLocaleString('pt-BR')}`;
}

// Coluna Estado de uma live. "Sem ganho" só com medição concluída.
function liveBonusEstadoLinha(st) {
  if (!st) return { texto: '—', parado: false };
  if (st.semGanho === true && st.medindo === false) return { texto: 'Sem ganho', parado: true };
  return {
    texto: LIVE_BONUS_SITUACAO_CURTA[st.situacao] || 'Parado',
    parado: LIVE_BONUS_PARADO.has(st.situacao),
  };
}

function liveBonusNomeCanal(canal) {
  return canal ? (canal.nome || canal.login || '') : '';
}

// Controlador do Bônus Twitch: um por cliente da API (window.mesa). Faz a única inscrição em onLiveStatus,
// o único liveGet e o único setInterval de repintura. Cada vista (Configurações e Espera) tem o próprio DOM.
let liveBonusCtl = null;

function liveBonusControlador() {
  const mesa = liveBonusTemMesa() ? window.mesa : null;
  if (!liveBonusCtl || liveBonusCtl.mesa !== mesa) liveBonusCtl = criarControlador(mesa);
  return liveBonusCtl;
}

function criarControlador(mesa) {
  const ctl = {
    mesa,
    snap: null,
    // Um "ok" anterior a esta tela não conta: recarregar não religa o interruptor.
    loginVistoEm: new Array(4).fill(Date.now()),
    vistas: [],
    prefixos: new Set(),
    // Falha da leitura inicial (liveGet). Fica aqui para uma vista montada depois também mostrar; some no próximo snapshot.
    erroLeitura: '',
    paint() {
      for (const vista of ctl.vistas) vista.paint();
    },
    aplicar(data) {
      if (!data) return;
      ctl.snap = liveBonusJuntar(ctl.snap, data);
      ctl.erroLeitura = '';
      ligarAposLogin(ctl);
      ctl.paint();
    },
  };
  // Sem window.mesa (file://), mostra a pré-visualização e os botões não fazem nada.
  if (mesa) {
    mesa.onLiveStatus(ctl.aplicar);
    mesa.liveGet().then(ctl.aplicar).catch((error) => {
      ctl.erroLeitura = liveBonusMensagemErro(error, 'Não foi possível ler o Bônus Twitch.');
      ctl.paint();
    });
  } else {
    ctl.snap = LIVE_BONUS_PREVIEW;
  }
  setInterval(ctl.paint, 30000);
  return ctl;
}

// Religa o interruptor da baía só com um "ok" novo. Roda uma vez por snapshot, não uma vez por vista.
function ligarAposLogin(ctl) {
  const novas = liveBonusLoginsNovos(ctl.snap.twitch, ctl.loginVistoEm)
    .filter((i) => cfg.bays[i].twitchAuto !== true);
  if (!novas.length) return;
  for (const i of novas) cfg.bays[i].twitchAuto = true;
  liveBonusSalvar();
}

// Uma vista do Bônus Twitch: Recompensas, notas, erro e Kick (o geral) e uma linha por baía.
// O prefixo dá ids únicos: 'live-bonus' nas Configurações, 'live-bonus-espera' na Espera.
// Modo 'ajustes' tem um erro só, no topo (como antes); modo 'espera' tem um erro em cada baía e um erro geral (leitura e Kick).
function criarVista(ctl, prefixoPedido, modo) {
  let prefixo = prefixoPedido;
  for (let n = 2; ctl.prefixos.has(prefixo); n += 1) prefixo = `${prefixoPedido}-${n}`;
  ctl.prefixos.add(prefixo);
  const espera = modo === 'espera';

  // Recompensas: tipos, globais para as quatro baías.
  const tiposBox = el('div', 'live-bonus-tipos');
  const tipoInputs = {};
  const tipoLabels = {};
  for (const tipo of LIVE_BONUS_TIPOS) {
    const label = el('label', 'live-bonus-tipo');
    const input = el('input', 'checkbox checkbox-sm');
    input.type = 'checkbox';
    const texto = el('span', null, '');
    label.append(input, texto);
    tipoInputs[tipo] = input;
    tipoLabels[tipo] = texto;
    input.addEventListener('change', () => {
      cfg.twitch.tipos[tipo] = input.checked;
      liveBonusSalvar();
      ctl.paint();
    });
    tiposBox.append(label);
  }
  const campoTipos = el('div', 'settings-field');
  const textoTipos = el('div', 'settings-field-text');
  textoTipos.append(el('strong', null, 'Recompensas'), el('p', null, 'Cada uma vale 1 hora de +15%. O app resgata de novo quando a anterior acabar.'));
  campoTipos.append(textoTipos, tiposBox);
  const notas = [
    el('p', 'live-bonus-note', 'Detalhes no log de resgates.'),
    el('p', 'live-bonus-note', 'Assistindo, uma conta junta cerca de 320 pontos por hora: 10 a cada 5 minutos e o baú de 50 a cada 15. O XP custa 300 por hora.'),
  ];

  // Erro do topo da vista. Nas Configurações é o erro de ação, como antes. Na Espera só recebe falhas gerais
  // (leitura inicial e Abrir da Kick); o erro de ação de uma baía fica no erro da própria baía.
  const erro = el('p', 'live-bonus-erro alert alert-soft');
  erro.hidden = true;
  if (espera) erro.setAttribute('aria-live', 'polite');
  // Erro do Abrir da Kick (Espera). Só some no Abrir seguinte que der certo.
  let erroKick = '';

  const linhas = [];
  const cards = [];

  function mostrarErro(no, error, padrao) {
    no.hidden = false;
    no.textContent = liveBonusMensagemErro(error, padrao);
  }

  // Erro de ação de uma baía: na Espera, o da própria baía; nas Configurações, o do topo.
  function mostrarErroDaBaia(i, error, padrao) {
    mostrarErro(espera ? linhas[i].erroBaia : erro, error, padrao);
  }

  // Ação de baía que deu certo: esconde o erro dela antes de aplicar o snapshot. Nas Configurações não há erro por baía.
  function aplicarDaBaia(i) {
    return (data) => {
      const linha = linhas[i];
      if (linha && linha.erroBaia) linha.erroBaia.hidden = true;
      ctl.aplicar(data);
    };
  }

  // Erro geral da Espera: o da leitura inicial ou o do Abrir da Kick. Nas Configurações não aparece (o silêncio de antes continua).
  function paintErroGeral() {
    if (!espera) return;
    const texto = ctl.erroLeitura || erroKick;
    if (erro.hidden !== !texto) erro.hidden = !texto;
    liveBonusDefinir(erro, texto);
  }

  // Uma linha por baía, montada uma vez. Repintar só troca textos, para o foco do teclado não se perder.
  for (let i = 0; i < 4; i += 1) {
    const li = el('li', 'live-bonus-bay');

    // Cabeçalho: luz de estado, nome, taxa somada e interruptor.
    const head = el('div', 'live-bonus-bay-head');
    const nome = el('strong', 'live-bonus-bay-name');
    const luz = el('span', 'live-bonus-lamp');
    const taxa = el('span', 'live-bonus-rate');
    const auto = el('label', 'live-bonus-auto');
    const sw = el('input', 'toggle toggle-sm');
    sw.type = 'checkbox';
    sw.setAttribute('role', 'switch');
    auto.append(el('span', 'label-text', 'Assistir e resgatar sozinho'), sw);
    head.append(nome, luz, taxa, auto);

    // Único role="status" da baía.
    const status = el('p', 'live-bonus-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-atomic', 'true');

    // Lives ao mesmo tempo: 1 a 4, com aria-pressed.
    const vidas = el('div', 'live-bonus-lives');
    const grupo = el('div', 'live-bonus-lives-group');
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', 'Lives ao mesmo tempo');
    const botoesLives = [];
    for (let n = 1; n <= LIVE_BONUS_LIVES_MAX; n += 1) {
      const botao = el('button', 'btn btn-sm btn-ghost', String(n));
      botao.type = 'button';
      botao.setAttribute('aria-pressed', 'false');
      botao.addEventListener('click', () => {
        const cb = cfg.bays[i] || (cfg.bays[i] = {});
        cb.twitchStreams = n;
        liveBonusSalvar();
        ctl.paint();
      });
      grupo.append(botao);
      botoesLives.push(botao);
    }
    vidas.append(el('span', 'live-bonus-lives-label', 'Lives ao mesmo tempo'), grupo);

    // Tabela de lives: uma linha por vaga. As linhas além de "Lives ao mesmo tempo" ficam escondidas.
    const tabela = el('table', 'live-bonus-canais');
    const cabeca = el('thead');
    const trCabeca = el('tr');
    for (const rotulo of ['Canal', 'Pontos', 'Ganho/h', 'Estado', 'Janela']) {
      const th = el('th', null, rotulo);
      th.setAttribute('scope', 'col');
      trCabeca.append(th);
    }
    cabeca.append(trCabeca);
    const corpo = el('tbody');
    const linhasLive = [];
    for (let s = 0; s < LIVE_BONUS_LIVES_MAX; s += 1) {
      const tr = el('tr', 'live-bonus-live');
      const canalNome = el('span', 'live-bonus-canal-nome');
      const marca = el('span', 'live-bonus-marca');
      const substitui = el('span', 'live-bonus-substitui');
      // Foco da live, abaixo do nome. Automático é o valor vazio (sem chave salva na baía).
      const focoSelect = el('select', 'live-bonus-foco-select');
      const focoOpcoes = {};
      for (const valor of ['', ...LIVE_BONUS_TIPOS]) {
        const opcao = el('option', null, valor ? LIVE_BONUS_ROTULO[valor] : 'Automático');
        opcao.value = valor;
        focoSelect.append(opcao);
        focoOpcoes[valor] = opcao;
      }
      const focoRotulo = el('label', 'live-bonus-foco');
      focoRotulo.append(el('span', 'live-bonus-foco-texto', 'Foco'), focoSelect);
      const focoAviso = el('p', 'live-bonus-foco-aviso', '');
      focoAviso.id = `${prefixo}-foco-aviso-${i}-${s}`;
      focoAviso.hidden = true;
      const focoLigar = el('button', 'btn btn-sm btn-soft live-bonus-foco-ligar', 'Ligar');
      focoLigar.type = 'button';
      focoLigar.hidden = true;
      const tdCanal = el('td', 'live-bonus-canal-cell');
      tdCanal.append(canalNome, focoRotulo, focoAviso, focoLigar, marca, substitui);
      const tdPontos = el('td', 'live-bonus-num', '—');
      const tdGanho = el('td', 'live-bonus-num', '—');
      const tdEstado = el('td', 'live-bonus-estado', '—');
      const mostrarLive = el('button', 'btn btn-sm btn-ghost', 'Mostrar');
      mostrarLive.type = 'button';
      const tdJanela = el('td');
      tdJanela.append(mostrarLive);
      tr.append(tdCanal, tdPontos, tdGanho, tdEstado, tdJanela);
      corpo.append(tr);
      mostrarLive.addEventListener('click', () => {
        if (!liveBonusTemMesa()) return;
        const streams = ctl.snap && ctl.snap.twitch && ctl.snap.twitch.bays[i] && Array.isArray(ctl.snap.twitch.bays[i].streams)
          ? ctl.snap.twitch.bays[i].streams : [];
        const st = streams[s];
        const visivel = !!st && st.janela === 'visivel';
        window.mesa.twitchMostrar(i, !visivel, s).then(aplicarDaBaia(i)).catch((error) => mostrarErroDaBaia(i, error, 'Não foi possível mostrar a janela.'));
      });
      const foco = { select: focoSelect, opcoes: focoOpcoes, aviso: focoAviso, ligar: focoLigar, login: '', tipo: '' };
      focoSelect.addEventListener('change', () => {
        // O login vem da linha pintada por último; sem canal o select fica desabilitado.
        if (!foco.login) return;
        const cb = cfg.bays[i] || (cfg.bays[i] = {});
        const atual = cb.twitchFoco && typeof cb.twitchFoco === 'object' ? Object.entries(cb.twitchFoco) : [];
        const entradas = atual.filter(([login]) => login !== foco.login);
        if (focoSelect.value) entradas.push([foco.login, focoSelect.value]);
        cb.twitchFoco = Object.fromEntries(entradas);
        liveBonusSalvar();
        ctl.paint();
      });
      focoLigar.addEventListener('click', () => {
        // Liga só o tipo do foco da linha (o que o aviso mostra).
        if (!foco.tipo) return;
        cfg.twitch.tipos[foco.tipo] = true;
        liveBonusSalvar();
        ctl.paint();
        if (typeof focoSelect.focus === 'function') focoSelect.focus();
      });
      linhasLive.push({ tr, canalNome, marca, substitui, tdPontos, tdGanho, tdEstado, mostrarLive, foco });
    }
    tabela.append(cabeca, corpo);

    // Escolha de canais: lista por login, reconciliada (sem recriar nós a cada repintura).
    const escolha = el('details', 'live-bonus-escolha');
    const resumoEscolha = el('summary', 'live-bonus-escolha-resumo', 'Escolher canais (0 de 4)');
    const oficiaisBox = el('div', 'live-bonus-oficiais');
    const notaEscolha = el('p', 'live-bonus-note');
    const foraAr = el('p', 'live-bonus-note');
    foraAr.hidden = true;
    const limparForaAr = el('button', 'btn btn-sm btn-ghost', 'Limpar fora do ar');
    limparForaAr.type = 'button';
    limparForaAr.hidden = true;
    escolha.append(resumoEscolha, oficiaisBox, foraAr, limparForaAr, notaEscolha);

    const dl = el('dl', 'live-bonus-facts');
    const dds = [];
    for (const rotulo of ['Twitch', 'No jogo', 'Bônus', 'Último resgate']) {
      dl.append(el('dt', null, rotulo));
      const dd = el('dd', null, '—');
      dds.push(dd);
      dl.append(dd);
    }

    const acoes = el('div', 'live-bonus-actions');
    const navegador = el('button', 'btn btn-sm btn-primary', 'Entrar pelo navegador');
    navegador.type = 'button';
    navegador.title = 'Abre o Edge ou o Chrome só desta baía para entrar na Twitch';
    const jaEntrei = el('button', 'btn btn-sm btn-ja-entrou', 'Já entrei');
    jaEntrei.type = 'button';
    jaEntrei.title = 'Copia o login do navegador para esta baía';
    const entrar = el('button', 'btn btn-sm btn-ghost', 'Entrar na janela do app');
    entrar.type = 'button';
    const mostrar = el('button', 'btn btn-sm btn-ghost', 'Mostrar janela');
    mostrar.type = 'button';
    const sair = el('button', 'btn btn-sm btn-leave', 'Sair da Twitch');
    sair.type = 'button';
    acoes.append(navegador, jaEntrei, entrar, mostrar, sair);
    const dica = el('p', 'live-bonus-hint');
    const nota = el('p', 'live-bonus-note', 'Os pontos são de cada canal. Cada live extra gasta mais CPU e memória; veja Processamento.');

    // Erro de ação da própria baía: só na Espera (nas Configurações o erro é o do topo). Anuncia com aria-live, sem role="alert".
    const erroBaia = espera ? el('p', 'live-bonus-erro alert alert-soft') : null;
    if (erroBaia) {
      erroBaia.hidden = true;
      erroBaia.setAttribute('aria-live', 'polite');
    }

    // Bloco de lives (fica escondido quando a baía não tem dados da Mesa).
    const box = el('div', 'live-bonus-live-box');
    box.append(vidas, tabela, escolha);

    const partes = [head, status, box, dl, acoes];
    if (erroBaia) partes.push(erroBaia);
    partes.push(dica, nota);
    li.append(...partes);
    cards.push(li);

    const linha = {
      i, nome, luz, taxa, status, sw, box, botoesLives, linhasLive, oficiaisBox, oficiaisMap: new Map(), foraAr, limparForaAr, presentes: new Set(), elegiveis: new Set(), foraDoAr: [],
      semOficiais: el('p', 'live-bonus-note', 'Nenhuma live oficial listada agora.'),
      resumoEscolha, notaEscolha, dds, navegador, jaEntrei, entrar, mostrar, sair, dica, armado: false, timer: 0, erroBaia,
    };
    linhas.push(linha);
    oficiaisBox.append(linha.semOficiais);
    limparForaAr.addEventListener('click', () => {
      const cb = cfg.bays[i] || (cfg.bays[i] = {});
      const aRemover = new Set(linha.foraDoAr);
      cb.twitchCanais = (Array.isArray(cb.twitchCanais) ? cb.twitchCanais : []).filter((login) => !aRemover.has(login));
      liveBonusSalvar();
      ctl.paint();
    });

    navegador.addEventListener('click', () => {
      if (!liveBonusTemMesa()) return;
      window.mesa.twitchNavegador(i).then(aplicarDaBaia(i)).catch((error) => mostrarErroDaBaia(i, error, 'Não foi possível abrir o navegador.'));
    });
    jaEntrei.addEventListener('click', () => {
      if (!liveBonusTemMesa()) return;
      window.mesa.twitchJaEntrei(i).then(aplicarDaBaia(i)).catch((error) => mostrarErroDaBaia(i, error, 'Não foi possível importar o login.'));
    });

    sw.addEventListener('change', () => {
      cfg.bays[i].twitchAuto = sw.checked;
      liveBonusSalvar();
      ctl.paint();
    });
    entrar.addEventListener('click', () => {
      if (!liveBonusTemMesa()) return;
      window.mesa.twitchEntrar(i).then(aplicarDaBaia(i)).catch((error) => mostrarErroDaBaia(i, error, 'Não foi possível abrir a Twitch.'));
    });
    mostrar.addEventListener('click', () => {
      if (!liveBonusTemMesa()) return;
      const visivel = ctl.snap && ctl.snap.twitch && ctl.snap.twitch.bays[i] && ctl.snap.twitch.bays[i].janela === 'visivel';
      window.mesa.twitchMostrar(i, !visivel).then(aplicarDaBaia(i)).catch((error) => mostrarErroDaBaia(i, error, 'Não foi possível mostrar a janela.'));
    });
    sair.addEventListener('click', () => {
      if (!liveBonusTemMesa()) return;
      if (!linha.armado) {
        linha.armado = true;
        linha.timer = setTimeout(() => {
          linha.armado = false;
          paint();
        }, 4000);
        paint();
        return;
      }
      clearTimeout(linha.timer);
      linha.armado = false;
      window.mesa.twitchSair(i).then(aplicarDaBaia(i)).catch((error) => mostrarErroDaBaia(i, error, 'Não foi possível sair da Twitch.'));
    });
  }

  const kickBox = el('section', 'live-bonus-kick');
  // Chave da lista Kick desta vista: cada vista tem o próprio DOM, então a chave também é da vista.
  let kickKey = null;

  function paintControles() {
    for (const tipo of LIVE_BONUS_TIPOS) {
      tipoInputs[tipo].checked = cfg.twitch.tipos[tipo] === true;
      const custo = ctl.snap && ctl.snap.twitch && ctl.snap.twitch.custos ? ctl.snap.twitch.custos[tipo] : LIVE_BONUS_CUSTO[tipo];
      const texto = `${LIVE_BONUS_ROTULO[tipo]} · ${Number(custo).toLocaleString('pt-BR')} pontos`;
      if (tipoLabels[tipo].textContent !== texto) tipoLabels[tipo].textContent = texto;
    }
  }

  // Lives ao mesmo tempo: o botão marcado é o número salvo na baía (padrão 4).
  function paintLives(linha, cfgBay) {
    const n = Number.isInteger(cfgBay.twitchStreams) ? cfgBay.twitchStreams : LIVE_BONUS_LIVES_MAX;
    linha.botoesLives.forEach((botao, idx) => {
      const marcado = idx + 1 === n;
      botao.setAttribute('aria-pressed', marcado ? 'true' : 'false');
      botao.classList.toggle('btn-active', marcado);
    });
  }

  // Lista de canais oficiais: reconciliada por login. Os nós não são removidos: quem sai fica oculto, quem entra é anexado.
  // Só conta a escolha que está nas oficiais agora; o login salvo que saiu fica como "fora do ar" e volta sozinho.
  function paintOficiais(linha, i, bay, cfgBay) {
    // Login normalizado (minúsculas, sem espaço) e válido, como o backend. Maiúscula não vira outro canal.
    const lista = Array.isArray(bay.oficiais)
      ? bay.oficiais.filter((o) => o && typeof o.login === 'string').map((o) => ({ ...o, login: liveBonusNorm(o.login) })).filter((o) => LIVE_BONUS_LOGIN_RE.test(o.login))
      : [];
    const limite = liveBonusLimite(cfgBay);
    const salvos = (Array.isArray(cfgBay.twitchCanais) ? cfgBay.twitchCanais : []).map(liveBonusNorm).filter(Boolean);
    const presentes = new Set(lista.map((o) => o.login));
    // Mesma regra do backend (canalElegivel): ao vivo e ativo. Fora do ar é salvo fora dessa regra.
    const elegiveis = new Set(lista.filter((o) => o.aoVivo === true && o.ativo === true).map((o) => o.login));
    linha.presentes = presentes;
    // Efetivas: elegíveis salvas, na ordem salva, cortadas no limite (como o backend). Salvo cortado fica em cfg e não é fora do ar.
    linha.elegiveis = elegiveis;
    const efetivos = salvos.filter((login) => elegiveis.has(login)).slice(0, limite);
    // Sem oficiais (jogo desconectado) não há como saber o que está fora do ar: não calcula.
    const foraDoAr = lista.length ? salvos.filter((login) => !elegiveis.has(login)) : [];
    linha.foraDoAr = foraDoAr;
    const cheio = efetivos.length >= limite;
    for (const o of lista) {
      if (linha.oficiaisMap.has(o.login)) continue;
      const login = o.login;
      const label = el('label', 'live-bonus-canal');
      const input = el('input', 'checkbox checkbox-sm');
      input.type = 'checkbox';
      const span = el('span', 'live-bonus-canal-texto', '');
      label.append(input, span);
      input.addEventListener('change', () => {
        const cb = cfg.bays[i] || (cfg.bays[i] = {});
        const atual = Array.isArray(cb.twitchCanais) ? cb.twitchCanais.slice() : [];
        const contando = atual.filter((l) => linha.elegiveis.has(l)).length;
        if (input.checked && !atual.includes(login)) {
          if (contando >= liveBonusLimite(cb)) {
            input.checked = false;
          } else {
            atual.push(login);
          }
        } else if (!input.checked) {
          const pos = atual.indexOf(login);
          if (pos >= 0) atual.splice(pos, 1);
        }
        cb.twitchCanais = atual;
        liveBonusSalvar();
        ctl.paint();
      });
      linha.oficiaisMap.set(login, { label, input, span });
      linha.oficiaisBox.append(label);
    }
    for (const [login, entrada] of linha.oficiaisMap) {
      entrada.label.hidden = !presentes.has(login);
      if (!presentes.has(login)) continue;
      const marcado = efetivos.includes(login) || (salvos.includes(login) && !elegiveis.has(login));
      entrada.input.checked = marcado;
      entrada.input.disabled = !marcado && cheio;
      const o = lista.find((x) => x.login === login);
      const espectadores = Number.isFinite(o.espectadores) ? o.espectadores : 0;
      liveBonusDefinir(entrada.span, `${o.nome || o.login} · ${espectadores} espectadores${o.aoVivo === true ? '' : ' · fora do ar'}`);
    }
    linha.semOficiais.hidden = lista.length > 0;
    const sufixo = foraDoAr.length ? ` · ${foraDoAr.length} fora do ar` : '';
    liveBonusDefinir(linha.resumoEscolha, `Escolher canais (${efetivos.length} de ${limite}${sufixo})`);
    let nota = '';
    if (!efetivos.length) nota = 'O app escolhe as lives com mais espectadores.';
    else if (cheio) nota = `Limite de ${limite} canais. Desmarque um para escolher outro.`;
    liveBonusDefinir(linha.notaEscolha, nota);
    linha.notaEscolha.hidden = !nota;
    liveBonusDefinir(linha.foraAr, foraDoAr.length ? `${foraDoAr.length} ${foraDoAr.length === 1 ? 'escolhida' : 'escolhidas'} fora do ar` : '');
    linha.foraAr.hidden = !foraDoAr.length;
    linha.limparForaAr.hidden = !foraDoAr.length;
  }

  // Uma linha por vaga: canal, marca, pontos, ganho/h, estado e botão de janela. Linhas além das lives escolhidas somem.
  // Foco de uma linha: canal da vaga, valor salvo (Automático sem chave) e, se o tipo do foco está desligado em Recompensas, aviso e "Ligar" do próprio tipo.
  function paintFoco(foco, st, nomeCanal, s, cfgBay) {
    const login = st && st.canal && typeof st.canal.login === 'string' ? liveBonusNorm(st.canal.login) : '';
    foco.login = login;
    const mapa = cfgBay && cfgBay.twitchFoco && typeof cfgBay.twitchFoco === 'object' ? cfgBay.twitchFoco : null;
    const salvo = login && mapa && Object.hasOwn(mapa, login) ? mapa[login] : '';
    const atual = LIVE_BONUS_TIPOS.includes(salvo) ? salvo : '';
    foco.tipo = atual;
    for (const tipo of LIVE_BONUS_TIPOS) {
      const ligado = cfg.twitch.tipos[tipo] === true;
      liveBonusDefinir(foco.opcoes[tipo], ligado ? LIVE_BONUS_ROTULO[tipo] : `${LIVE_BONUS_ROTULO[tipo]} (desligado)`);
    }
    foco.select.disabled = !login;
    foco.select.setAttribute('aria-label', `Foco da live de ${nomeCanal || `vaga ${s + 1}`}`);
    // Com o foco no select, a repintura não troca o valor que o usuário está escolhendo.
    if (typeof document === 'undefined' || document.activeElement !== foco.select) foco.select.value = atual;
    const desligado = !!atual && cfg.twitch.tipos[atual] !== true && !!login;
    const rotulo = atual ? LIVE_BONUS_ROTULO[atual] : '';
    liveBonusDefinir(foco.aviso, desligado ? `${rotulo} está desligado em Recompensas. Esta live só junta pontos.` : '');
    foco.aviso.hidden = !desligado;
    liveBonusDefinir(foco.ligar, desligado ? `Ligar ${rotulo}` : 'Ligar');
    foco.ligar.hidden = !desligado;
    // aria-describedby só existe quando há aviso desta vista (o id já traz o prefixo da vista).
    if (desligado) foco.select.setAttribute('aria-describedby', foco.aviso.id);
    else foco.select.removeAttribute('aria-describedby');
  }

  function paintStreams(linha, bay, cfgBay) {
    const streams = Array.isArray(bay.streams) ? bay.streams : [];
    const alvo = Number.isInteger(bay.alvo) ? bay.alvo : Math.max(1, streams.length);
    linha.linhasLive.forEach((lr, s) => {
      const st = streams[s] || null;
      const ativa = s < alvo;
      lr.tr.hidden = !ativa;
      if (!ativa) return;
      const nomeCanal = liveBonusNomeCanal(st ? st.canal : null);
      liveBonusDefinir(lr.canalNome, nomeCanal || 'Sem canal');
      paintFoco(lr.foco, st, nomeCanal, s, cfgBay);
      liveBonusDefinir(lr.marca, st ? (st.escolhido === true ? 'Escolhido' : 'Automático') : '');
      const trocado = st && typeof st.substitui === 'string' && st.substitui ? `no lugar de ${st.substitui}, fora do ar` : '';
      liveBonusDefinir(lr.substitui, trocado);
      lr.substitui.hidden = !trocado;
      liveBonusDefinir(lr.tdPontos, st && st.pontos && st.pontos.texto ? st.pontos.texto : '—');
      liveBonusDefinir(lr.tdGanho, liveBonusGanhoLinha(st));
      const estado = liveBonusEstadoLinha(st);
      liveBonusDefinir(lr.tdEstado, estado.texto);
      lr.tdEstado.classList.toggle('is-parado', estado.parado);
      const visivel = !!st && st.janela === 'visivel';
      const texto = visivel ? 'Esconder' : 'Mostrar';
      liveBonusDefinir(lr.mostrarLive, texto);
      lr.mostrarLive.setAttribute('aria-label', `${texto} a live de ${nomeCanal || `vaga ${s + 1}`}`);
    });
  }

  function paintBay(i, tw, decorrido) {
    const linha = linhas[i];
    const cfgBay = cfg.bays[i] || {};
    const nomeBaia = cfgBay.name || `Baía ${i + 1}`;
    liveBonusDefinir(linha.nome, nomeBaia);
    linha.sw.checked = cfgBay.twitchAuto === true;
    linha.sw.setAttribute('aria-label', `Assistir e resgatar sozinho na ${nomeBaia}`);
    const bay = tw && tw.bays ? tw.bays[i] : null;
    if (!bay) {
      liveBonusDefinir(linha.status, 'Aguardando o app.');
      linha.status.classList.remove('is-parado');
      linha.dds.forEach((dd) => liveBonusDefinir(dd, '—'));
      liveBonusDefinir(linha.luz, '○ Aguardando');
      liveBonusDefinir(linha.taxa, '');
      linha.box.hidden = true;
      linha.navegador.hidden = true;
      linha.jaEntrei.hidden = true;
      linha.entrar.hidden = true;
      linha.mostrar.hidden = true;
      linha.sair.hidden = true;
      linha.dica.hidden = true;
      return;
    }
    linha.box.hidden = false;
    const frase = liveBonusFrase(bay);
    liveBonusDefinir(linha.status, frase);
    linha.status.classList.toggle('is-parado', LIVE_BONUS_PARADO.has(bay.situacao));
    const luz = liveBonusLuz(bay);
    liveBonusDefinir(linha.luz, luz.texto);
    linha.luz.classList.toggle('is-parado', luz.parado);
    liveBonusDefinir(linha.taxa, liveBonusTaxa(bay));
    liveBonusFatos(bay, decorrido).forEach((valor, k) => {
      liveBonusDefinir(linha.dds[k], valor);
    });
    paintLives(linha, cfgBay);
    paintOficiais(linha, i, bay, cfgBay);
    paintStreams(linha, bay, cfgBay);
    const semLogin = !bay.loginTwitch;
    linha.navegador.hidden = !semLogin;
    linha.jaEntrei.hidden = !semLogin;
    linha.entrar.hidden = !semLogin;
    const dica = liveBonusDica(bay.navegador, Date.now(), cfgBay.twitchAuto === true);
    liveBonusDefinir(linha.dica, dica.texto);
    linha.dica.hidden = !dica.texto;
    linha.dica.classList.toggle('is-parado', dica.parado);
    linha.mostrar.hidden = semLogin;
    liveBonusDefinir(linha.mostrar, bay.janela === 'visivel' ? 'Esconder janela' : 'Mostrar janela');
    linha.sair.hidden = !bay.loginTwitch;
    const textoSair = linha.armado ? 'Confirmar saída' : 'Sair da Twitch';
    liveBonusDefinir(linha.sair, textoSair);
    linha.sair.classList.toggle('btn-leave-armed', linha.armado);
  }

  function paintKick() {
    const itens = ctl.snap && Array.isArray(ctl.snap.kickAoVivo) ? ctl.snap.kickAoVivo : [];
    const chave = liveBonusKickKey(itens);
    if (chave === kickKey) return;
    kickKey = chave;
    kickBox.replaceChildren(el('h3', 'live-bonus-kick-title', 'Kick ao vivo'));
    if (!itens.length) {
      kickBox.append(el('p', 'live-bonus-note', 'Nenhuma live da Kick no ar.'));
      return;
    }
    for (const item of itens) {
      const row = el('div', 'live-bonus-kick-row');
      const espectadores = item.espectadores != null ? item.espectadores : '—';
      row.append(el('span', null, `${item.nome || item.slug} (${espectadores})`));
      const abrir = el('button', 'btn btn-sm btn-ghost', 'Abrir');
      abrir.type = 'button';
      abrir.addEventListener('click', () => {
        if (!liveBonusTemMesa()) return;
        window.mesa.liveKickOpen(item.slug)
          .then(() => {
            erroKick = '';
            paintErroGeral();
          })
          .catch((error) => {
            erroKick = liveBonusMensagemErro(error, 'Não foi possível abrir a live da Kick.');
            paintErroGeral();
          });
      });
      row.append(abrir);
      kickBox.append(row);
    }
  }

  function paint() {
    const tw = ctl.snap && ctl.snap.twitch ? ctl.snap.twitch : null;
    const agora = Date.now();
    const decorrido = tw ? Math.max(0, agora - (tw.enviadoEm || agora)) : 0;
    paintControles();
    for (let i = 0; i < 4; i += 1) paintBay(i, tw, decorrido);
    paintKick();
    paintErroGeral();
  }

  const vista = { prefixo, espera, campoTipos, notas, erro, kickBox, cards, paint };
  ctl.vistas.push(vista);
  paint();
  return vista;
}

// Configurações: a mesma saída DOM de antes (erro no topo, lista de baías, Kick no fim).
function mountLiveBonus(parent) {
  if (!parent) return;
  const vista = criarVista(liveBonusControlador(), 'live-bonus', 'ajustes');
  const root = el('article', 'settings-wide card card-border mesa-panel live-bonus');
  const lista = el('ul', 'live-bonus-bays');
  lista.append(...vista.cards);
  root.append(
    el('h2', 'settings-card-title', 'Bônus Twitch'),
    el('p', 'live-bonus-lead', 'O app assiste de 1 a 4 lives oficiais em cada baía e troca os pontos de cada canal por horas de bônus no jogo. Entre na Twitch uma vez por baía, com a conta vinculada no jogo.'),
    vista.campoTipos,
    ...vista.notas,
    vista.erro,
    lista,
    vista.kickBox,
  );
  parent.append(root);
}

// Espera: a mesma inscrição, com vista própria. Devolve o bloco geral e as quatro baías (cards) para o standby.js.
function mountLiveBonusStandby() {
  const vista = criarVista(liveBonusControlador(), 'live-bonus-espera', 'espera');
  const geral = el('div', 'live-bonus-geral');
  geral.append(vista.campoTipos, ...vista.notas, vista.erro, vista.kickBox);
  return { geral, bays: vista.cards };
}

// Repinta todas as vistas (Configurações e Espera).
function paintLiveBonus() {
  if (liveBonusCtl) liveBonusCtl.paint();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { liveBonusDica, liveBonusJuntar, liveBonusLoginsNovos, mountLiveBonus, mountLiveBonusStandby, paintLiveBonus };
}
