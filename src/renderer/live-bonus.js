// Painel "Bônus Twitch" de Configurações. Só textContent: nada do snapshot vira HTML.
const LIVE_BONUS_TIPOS = ['xp', 'captura', 'shiny'];
const LIVE_BONUS_ROTULO = { xp: 'XP', captura: 'Captura', shiny: 'Shiny' };
const LIVE_BONUS_CUSTO = { xp: 300, captura: 500, shiny: 1000 };
const LIVE_BONUS_LIMIARES = [2, 5, 10, 15];
const LIVE_BONUS_PARADO = new Set([
  'sem-saldo-lido', 'sem-recompensa', 'sem-login-pagina', 'nao-vinculado',
  'sem-login-jogo', 'conta-diferente', 'pausado', 'sem-ganho', 'erro-baia', 'erro-pagina',
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
  'sem-login': () => 'Entre na Twitch nesta baía, pelo navegador ou na janela da Mesa.',
  'sem-canal': () => 'Nenhuma live oficial com pontos no ar agora.',
  'janela-aberta': () => 'Janela aberta. O resgate espera você esconder ou fechar a janela.',
  abrindo: (c) => (c ? `Abrindo a live de ${c}.` : 'Abrindo a live.'),
  assistindo: (c) => (c ? `Assistindo ${c}.` : 'Assistindo.'),
  juntando: (c) => `${c ? `Assistindo ${c}. ` : ''}Juntando pontos para o próximo resgate.`,
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
          ultimo: { tipo: 'xp', em: agora - 3600000, estado: 'ok', motivo: '' }, pausadoAte: 0, situacao: 'assistindo',
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

let liveBonusView = null;

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

function liveBonusUltimo(ultimo) {
  if (!ultimo) return '—';
  const nome = LIVE_BONUS_ROTULO[ultimo.tipo] || 'Bônus';
  const hora = liveBonusHora(ultimo.em);
  if (ultimo.estado === 'ok') return `${nome} às ${hora}`;
  if (ultimo.estado === 'falhou') {
    let base = `${nome} falhou às ${hora}: ${LIVE_BONUS_MOTIVO[ultimo.motivo] || LIVE_BONUS_MOTIVO.outro}`;
    if (ultimo.motivo === 'sem-centro') {
      base += `, fase=${ultimo.fase || '-'}, clicou=${ultimo.clicou === true ? 'sim' : 'não'}`;
      const pistas = Array.isArray(ultimo.pistas) ? ultimo.pistas.filter((p) => typeof p === 'string' && p) : [];
      return pistas.length ? `${base}. Vi no DOM: ${pistas.join(', ')}` : base;
    }
    const vistos = Array.isArray(ultimo.vistos) ? ultimo.vistos.filter((t) => typeof t === 'string' && t) : [];
    return vistos.length ? `${base}. Vi: ${vistos.join(', ')}` : base;
  }
  return `${nome} sem confirmação do jogo às ${hora}`;
}

// Diagnóstico da página: só contagens e sim/não, sem texto da Twitch.
function liveBonusDiag(d) {
  if (!d || typeof d !== 'object') return '';
  const sn = (v) => (v ? 'sim' : 'não');
  const num = (v) => (Number.isFinite(v) ? String(v) : '—');
  const botoes = Array.isArray(d.botoesResumo) ? d.botoesResumo : [];
  const itens = botoes.map((b) => {
    const o = b && typeof b === 'object' ? b : {};
    return [o.dts, o.alvo, o.aria].map((v) => (typeof v === 'string' && v ? v : '-')).join('|');
  });
  const resumo = itens.length ? itens.join('; ') : 'nenhum';
  return `Diag: resumo=${sn(d.resumo)}, botão=${sn(d.botaoPontos)}, botões=${num(d.botoesNoResumo)}, `
    + `saldo#=${num(d.saldoSeletor)}, saldo=${num(d.saldoTamanho)} chars, lido=${sn(d.saldoLido)}, centro#=${num(d.centroSeletor)}, `
    + `resumo: ${resumo}`;
}

function liveBonusFatos(bay, decorrido) {
  let jogo = '—';
  if (bay.vinculado === true) jogo = `${bay.loginJogo || '—'} · ${bay.contaBate ? 'a mesma' : 'outra conta'}`;
  else if (bay.vinculado === false) jogo = 'não vinculada';
  const canal = bay.canal ? (bay.canal.nome || bay.canal.login) : '';
  return [
    bay.loginTwitch || 'não entrou',
    jogo,
    canal || '—',
    bay.pontos && bay.pontos.texto ? bay.pontos.texto : '—',
    liveBonusAtivos(bay, decorrido),
    liveBonusUltimo(bay.ultimo),
  ];
}

function liveBonusFrase(bay) {
  const canal = bay.canal ? (bay.canal.nome || bay.canal.login) : '';
  const frase = LIVE_BONUS_FRASE[bay.situacao];
  return frase ? frase(canal, bay) : '';
}

// Dica do login pelo navegador: fica fora da região role="status" da baía.
const LIVE_BONUS_NAVEGADOR = {
  aberto: () => 'A Mesa abriu uma janela para esta baía. Entre na Twitch nesta janela que abriu e feche-a. O login entra sozinho nesta baía.',
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

function mountLiveBonus(parent) {
  if (!parent) return;
  let snap = null;
  let kickKey = null;
  const linhas = [];
  // Um "ok" anterior a esta tela não conta: recarregar não religa o interruptor.
  const loginVistoEm = new Array(4).fill(Date.now());

  const root = el('article', 'settings-wide card card-border mesa-panel live-bonus');
  root.append(
    el('h2', 'settings-card-title', 'Bônus Twitch'),
    el('p', 'live-bonus-lead', 'A Mesa assiste a uma live oficial em cada baía e troca os pontos do canal por horas de bônus no jogo. Entre na Twitch uma vez por baía, com a conta vinculada no jogo.'),
  );

  // Recompensas: tipos e limiar de resgate, globais para as quatro baías.
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
      paint();
    });
    tiposBox.append(label);
  }
  const limiarGrupo = el('div', 'join live-bonus-limiar');
  limiarGrupo.setAttribute('role', 'group');
  limiarGrupo.setAttribute('aria-label', 'Resgatar quando faltar');
  const limiarBotoes = LIVE_BONUS_LIMIARES.map((n) => {
    const botao = el('button', 'btn btn-sm join-item', `${n} min`);
    botao.type = 'button';
    botao.addEventListener('click', () => {
      cfg.twitch.limiarMin = n;
      liveBonusSalvar();
      paint();
    });
    limiarGrupo.append(botao);
    return { n, botao };
  });
  const campoTipos = el('div', 'settings-field');
  const textoTipos = el('div', 'settings-field-text');
  textoTipos.append(el('strong', null, 'Recompensas'), el('p', null, 'Cada uma vale 1 hora de +15%. As horas se somam.'));
  campoTipos.append(textoTipos, tiposBox);
  const campoLimiar = el('div', 'settings-field');
  const textoLimiar = el('div', 'settings-field-text');
  textoLimiar.append(el('strong', null, 'Resgatar quando faltar'), el('p', null, 'Resgata de novo antes de o bônus acabar.'));
  campoLimiar.append(textoLimiar, limiarGrupo);
  root.append(campoTipos, campoLimiar);
  root.append(el('p', 'live-bonus-note', 'Assistindo, uma conta junta cerca de 320 pontos por hora: 10 a cada 5 minutos e o baú de 50 a cada 15. O XP custa 300 por hora.'));

  const erro = el('p', 'live-bonus-erro alert alert-soft');
  erro.hidden = true;
  root.append(erro);

  function mostrarErro(error, padrao) {
    erro.hidden = false;
    erro.textContent = error && error.message ? error.message : padrao;
  }

  // Uma linha por baía, montada uma vez. Repintar só troca textos, para o foco do teclado não se perder.
  const lista = el('ul', 'live-bonus-bays');
  for (let i = 0; i < 4; i += 1) {
    const li = el('li', 'live-bonus-bay');
    const head = el('div', 'live-bonus-bay-head');
    const nome = el('strong', 'live-bonus-bay-name');
    const status = el('p', 'live-bonus-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-atomic', 'true');
    const auto = el('label', 'live-bonus-auto');
    const sw = el('input', 'toggle toggle-sm');
    sw.type = 'checkbox';
    sw.setAttribute('role', 'switch');
    auto.append(el('span', 'label-text', 'Assistir e resgatar sozinho'), sw);
    head.append(nome, status, auto);

    const dl = el('dl', 'live-bonus-facts');
    const dds = [];
    for (const rotulo of ['Twitch', 'No jogo', 'Canal', 'Pontos', 'Bônus', 'Último resgate']) {
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
    const entrar = el('button', 'btn btn-sm btn-ghost', 'Entrar na janela da Mesa');
    entrar.type = 'button';
    const mostrar = el('button', 'btn btn-sm btn-ghost', 'Mostrar janela');
    mostrar.type = 'button';
    const sair = el('button', 'btn btn-sm btn-leave', 'Sair da Twitch');
    sair.type = 'button';
    acoes.append(navegador, jaEntrei, entrar, mostrar, sair);
    const dica = el('p', 'live-bonus-hint');
    const diagP = el('p', 'live-bonus-hint');

    li.append(head, dl, acoes, dica, diagP);
    lista.append(li);

    const linha = { i, nome, status, sw, dds, navegador, jaEntrei, entrar, mostrar, sair, dica, diagP, armado: false, timer: 0 };
    linhas.push(linha);

    navegador.addEventListener('click', () => {
      if (!liveBonusTemMesa()) return;
      window.mesa.twitchNavegador(i).then(aplicar).catch((error) => mostrarErro(error, 'Não foi possível abrir o navegador.'));
    });
    jaEntrei.addEventListener('click', () => {
      if (!liveBonusTemMesa()) return;
      window.mesa.twitchJaEntrei(i).then(aplicar).catch((error) => mostrarErro(error, 'Não foi possível importar o login.'));
    });

    sw.addEventListener('change', () => {
      cfg.bays[i].twitchAuto = sw.checked;
      liveBonusSalvar();
      paint();
    });
    entrar.addEventListener('click', () => {
      if (!liveBonusTemMesa()) return;
      window.mesa.twitchEntrar(i).then(aplicar).catch((error) => mostrarErro(error, 'Não foi possível abrir a Twitch.'));
    });
    mostrar.addEventListener('click', () => {
      if (!liveBonusTemMesa()) return;
      const visivel = snap && snap.twitch && snap.twitch.bays[i] && snap.twitch.bays[i].janela === 'visivel';
      window.mesa.twitchMostrar(i, !visivel).then(aplicar).catch((error) => mostrarErro(error, 'Não foi possível mostrar a janela.'));
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
      window.mesa.twitchSair(i).then(aplicar).catch((error) => mostrarErro(error, 'Não foi possível sair da Twitch.'));
    });
  }

  const kickBox = el('section', 'live-bonus-kick');

  root.append(lista, kickBox);
  parent.append(root);

  function paintControles() {
    for (const tipo of LIVE_BONUS_TIPOS) {
      tipoInputs[tipo].checked = cfg.twitch.tipos[tipo] === true;
      const custo = snap && snap.twitch && snap.twitch.custos ? snap.twitch.custos[tipo] : LIVE_BONUS_CUSTO[tipo];
      const texto = `${LIVE_BONUS_ROTULO[tipo]} · ${Number(custo).toLocaleString('pt-BR')} pontos`;
      if (tipoLabels[tipo].textContent !== texto) tipoLabels[tipo].textContent = texto;
    }
    for (const { n, botao } of limiarBotoes) {
      const on = cfg.twitch.limiarMin === n;
      botao.classList.toggle('btn-active', on);
      botao.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function paintBay(i, tw, decorrido) {
    const linha = linhas[i];
    const cfgBay = cfg.bays[i] || {};
    const nomeBaia = cfgBay.name || `Baía ${i + 1}`;
    if (linha.nome.textContent !== nomeBaia) linha.nome.textContent = nomeBaia;
    linha.sw.checked = cfgBay.twitchAuto === true;
    linha.sw.setAttribute('aria-label', `Assistir e resgatar sozinho na ${nomeBaia}`);
    const bay = tw && tw.bays ? tw.bays[i] : null;
    if (!bay) {
      if (linha.status.textContent !== 'Aguardando a Mesa.') linha.status.textContent = 'Aguardando a Mesa.';
      linha.status.classList.remove('is-parado');
      linha.dds.forEach((dd) => { if (dd.textContent !== '—') dd.textContent = '—'; });
      linha.navegador.hidden = true;
      linha.jaEntrei.hidden = true;
      linha.entrar.hidden = true;
      linha.mostrar.hidden = true;
      linha.sair.hidden = true;
      linha.dica.hidden = true;
      linha.diagP.hidden = true;
      return;
    }
    const frase = liveBonusFrase(bay);
    if (linha.status.textContent !== frase) linha.status.textContent = frase;
    linha.status.classList.toggle('is-parado', LIVE_BONUS_PARADO.has(bay.situacao));
    liveBonusFatos(bay, decorrido).forEach((valor, k) => {
      if (linha.dds[k].textContent !== valor) linha.dds[k].textContent = valor;
    });
    const semLogin = !bay.loginTwitch;
    linha.navegador.hidden = !semLogin;
    linha.jaEntrei.hidden = !semLogin;
    linha.entrar.hidden = !semLogin;
    const dica = liveBonusDica(bay.navegador, Date.now(), cfgBay.twitchAuto === true);
    if (linha.dica.textContent !== dica.texto) linha.dica.textContent = dica.texto;
    linha.dica.hidden = !dica.texto;
    linha.dica.classList.toggle('is-parado', dica.parado);
    const diagTexto = liveBonusDiag(bay.diag);
    if (linha.diagP.textContent !== diagTexto) linha.diagP.textContent = diagTexto;
    linha.diagP.hidden = !diagTexto;
    linha.mostrar.hidden = semLogin;
    const texto = bay.janela === 'visivel' ? 'Esconder janela' : 'Mostrar janela';
    if (linha.mostrar.textContent !== texto) linha.mostrar.textContent = texto;
    linha.sair.hidden = !bay.loginTwitch;
    const textoSair = linha.armado ? 'Confirmar saída' : 'Sair da Twitch';
    if (linha.sair.textContent !== textoSair) linha.sair.textContent = textoSair;
    linha.sair.classList.toggle('btn-leave-armed', linha.armado);
  }

  function paintKick() {
    const itens = snap && Array.isArray(snap.kickAoVivo) ? snap.kickAoVivo : [];
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
        if (liveBonusTemMesa()) window.mesa.liveKickOpen(item.slug);
      });
      row.append(abrir);
      kickBox.append(row);
    }
  }

  function paint() {
    const tw = snap && snap.twitch ? snap.twitch : null;
    const agora = Date.now();
    const decorrido = tw ? Math.max(0, agora - (tw.enviadoEm || agora)) : 0;
    paintControles();
    for (let i = 0; i < 4; i += 1) paintBay(i, tw, decorrido);
    paintKick();
  }

  function ligarAposLogin() {
    const novas = liveBonusLoginsNovos(snap.twitch, loginVistoEm)
      .filter((i) => cfg.bays[i].twitchAuto !== true);
    if (!novas.length) return;
    for (const i of novas) cfg.bays[i].twitchAuto = true;
    liveBonusSalvar();
  }

  function aplicar(data) {
    if (!data) return;
    snap = liveBonusJuntar(snap, data);
    ligarAposLogin();
    paint();
  }

  liveBonusView = { paint };

  // Sem window.mesa (file://), mostra a pré-visualização e os botões não fazem nada.
  if (liveBonusTemMesa()) {
    window.mesa.onLiveStatus(aplicar);
    window.mesa.liveGet().then(aplicar);
  } else {
    snap = LIVE_BONUS_PREVIEW;
  }
  paint();
  setInterval(paint, 30000);
}

function paintLiveBonus() {
  if (liveBonusView) liveBonusView.paint();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { liveBonusDica, liveBonusDiag, liveBonusJuntar, liveBonusLoginsNovos, mountLiveBonus };
}
