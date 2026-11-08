'use strict';

// Máquina de estado do bônus Twitch, uma por baía, com até 4 lives (vagas) por baía. Sem electron: janelas, prefs e relógio entram por parâmetro.
// Identificador da janela: k = i + 4 * s (i = baía, s = vaga). A vaga 0 da baía i tem k = i.
const P = require('./points');

const TICK_MS = 2000;
const ESPERA_NAVEGAR_MS = 15000;
const ESPERA_PAGINA_MS = 45000;
const ESPERA_RECARGA_MS = 300000;
const VIDEO_PARADO_MS = 90000;
const CMD_PORTAO_MS = 10000;
const CMD_PLAY_MS = 15000;
const CMD_BAU_MS = 20000;
const HOME = 'https://www.twitch.tv/';
const LOGIN = 'https://www.twitch.tv/login';
const BAYS = 4;
const CUSTOS_PADRAO = { xp: 300, captura: 500, shiny: 1000 };
const LOGIN_RAPIDO_MS = 10 * 60000;
const LOG_GANHO_MS = 30 * 60000;
// Prazo da trava de confirmação, contado da hora em que ela foi criada (em). Vencido, o tipo volta a ser elegível.
// Garantia: a trava de 2 h sem reenvio continua valendo. Sem prazo, uma leitura de bônus quebrada travaria o tipo até reiniciar a Mesa.
// Com 3 h, o pior caso de leitura quebrada cai para um reenvio a cada 3 h (com 30 min seria a cada 30 min). A saída rápida é reiniciar a Mesa.
const PRAZO_TRAVA_MS = 3 * 3600000;

const SITUACAO_ESPERA = {
  'sem-tipos': 'assistindo',
  'em-dia': 'assistindo',
  saldo: 'juntando',
  'sem-saldo-lido': 'sem-saldo-lido',
  pausado: 'pausado',
  'sem-recompensa': 'sem-recompensa',
  'sem-confirmacao': 'sem-confirmacao',
  'sem-leitura': 'sem-leitura',
  'foco-desligado': 'assistindo',
};

function kDe(i, s) {
  return i + BAYS * s;
}

function bayDe(k) {
  return k % BAYS;
}

function slotDe(k) {
  return Math.floor(k / BAYS);
}

// Estado de uma vaga (uma janela da Twitch).
function estadoStream() {
  return {
    pagina: null,
    paginaEm: 0,
    canal: '',
    visivelUsuario: false,
    modo: 'oculta',
    abertoEm: 0,
    navegouEm: 0,
    recarregouEm: 0,
    rodandoEm: 0,
    cmdEm: { portao: 0, play: 0, bau: 0 },
    bauEm: 0,
    ganho: null,
    semGanho: false,
    med: null,
    medCanal: '',
    erroPaginaEm: 0,
    situacao: 'desligado',
    // Dados do ciclo atual (recalculados a cada tick).
    alcancou: false,
    logada: false,
    pronta: false,
    saldo: null,
  };
}

function estadoInicial() {
  return {
    jogo: { ativo: false, twitch: null, offsetMs: 0 },
    loginTwitch: '',
    streams: [estadoStream(), estadoStream(), estadoStream(), estadoStream()],
    canais: ['', '', '', ''],
    logGanhoEm: {},
    falhasCanal: {},
    pendente: null,
    orfaos: [],
    falhas: {},
    ultimo: null,
    ultimoResgateEm: 0,
    soltouEm: 0,
    loginRapidoAte: 0,
    navegador: { estado: '', motivo: '', em: 0 },
    ultimoLoginValido: '',
    situacao: 'desligado',
  };
}

function nomeDoCanal(tw, login) {
  const lista = tw && Array.isArray(tw.oficiais) ? tw.oficiais : [];
  const achado = lista.find((o) => o && typeof o.login === 'string' && o.login.toLowerCase() === login);
  return { login, nome: achado && achado.nome ? achado.nome : login };
}

// Trava de confirmação: uma por login e tipo. Só vale para a conta que clicou.
function chaveTrava(login, tipo) {
  return `${login || ''}|${tipo}`;
}

// Travas de confirmação são globais (todas as baías): a conta que clicou não resgata o tipo em nenhuma baía enquanto a trava vale.
function travadosDaConta(b, travas) {
  return Object.values(travas).filter((sc) => sc.conta === b.loginTwitch).map((sc) => sc.tipo);
}

// Zera a medição de todas as vagas (troca de conta e saída).
function zerarMedidas(b) {
  for (const st of b.streams) {
    st.med = null;
    st.medCanal = '';
    st.bauEm = 0;
  }
}

// Limpa a falha de um canal depois de uma confirmação: o canal volta a render.
function limparFalhaCanal(b, canal, tipo) {
  if (!canal || !b.falhasCanal[canal]) return;
  const nova = P.registrarSucesso(b.falhasCanal[canal], tipo);
  if (Object.keys(nova).length) b.falhasCanal[canal] = nova;
  else delete b.falhasCanal[canal];
}

// Vagas de uma baía, pelas prefs. Prefs sem o campo valem 1 (testes e chamadas antigas); o catálogo normaliza a config para 4.
function vagasDe(p, i) {
  const v = Array.isArray(p.streams) ? p.streams[i] : 1;
  return Number.isInteger(v) && v >= 1 && v <= BAYS ? v : 1;
}

function canaisEscolhidos(p, i) {
  const lista = Array.isArray(p.canais) && Array.isArray(p.canais[i]) ? p.canais[i] : [];
  return lista.filter(P.loginValido).map((x) => x.trim().toLowerCase());
}

// Foco da live (tipo de P.TIPOS) salvo por canal na baía. Sem a chave, vale Automático (''). Prefs sem o campo também dão ''.
function focoDe(p, i, login) {
  const mapa = Array.isArray(p.foco) ? p.foco[i] : null;
  if (!mapa || typeof mapa !== 'object' || typeof login !== 'string') return '';
  if (!Object.hasOwn(mapa, login)) return '';
  return P.TIPOS.includes(mapa[login]) ? mapa[login] : '';
}

function noAr(tw, login) {
  const lista = tw && Array.isArray(tw.oficiais) ? tw.oficiais : [];
  return lista.some((o) => o && typeof o.login === 'string' && o.login.trim().toLowerCase() === login && P.canalElegivel(o));
}

function vagaZeroLogada(b, t) {
  const st = b.streams[0];
  return !!st.pagina && t - st.paginaEm <= P.PAGINA_VELHA_MS && st.pagina.logado === true && st.pagina.deslogado !== true;
}

function createTwitchController({ janelas, prefs, agora, onChange, registrarErro }) {
  const bays = [];
  for (let i = 0; i < BAYS; i += 1) bays.push(estadoInicial());
  let seq = 0;
  let ultimaMarca = '';
  // Travas globais por conta e tipo, e a vez de quem começa o próximo tick (rodízio entre baías).
  const travas = {};
  // Quem começa o próximo tick. Não zera de propósito: o intervalo de 20 s faz o próximo resgate acontecer muitos ticks depois;
  // zerar na volta anularia a rotação e traria a fome de volta.
  let vez = 0;

  // Log de erros é opcional e nunca pode derrubar o resgate.
  function registrar(entrada) {
    try {
      if (typeof registrarErro === 'function') registrarErro(entrada);
    } catch {
      /* falha de log não interfere no resgate */
    }
  }

  // Trava de um clique (pendente ou órfão), na conta que clicou (pd.conta). Sem conta válida não grava: vai para o log.
  function gravarTrava(i, pd, t) {
    if (!P.loginValido(pd.conta)) {
      registrar({ baia: i, tipo: pd.tipo, motivo: 'clique-sem-conta', canal: pd.canal, stream: slotDe(pd.k), clicou: true });
      return;
    }
    travas[chaveTrava(pd.conta, pd.tipo)] = { tipo: pd.tipo, conta: pd.conta, bonusAntes: pd.bonusAntes, em: t, canal: pd.canal, k: pd.k, baia: i };
  }

  function gravarTravaDoPendente(i, t) {
    const pd = bays[i].pendente;
    if (!pd || !pd.clicado) return;
    gravarTrava(i, pd, t);
  }

  // Maior prazo por tipo entre as baías com o mesmo login e leitura de bônus válida (a própria baía entra).
  function bonusDaConta(b, tw) {
    const out = { ...(tw.bonus || {}) };
    for (const o of [b, ...bays]) {
      const twO = o.jogo.ativo ? o.jogo.twitch : null;
      if (!twO || twO.bonusLido !== true || !P.mesmoLogin(twO.login, tw.login)) continue;
      for (const tp of P.TIPOS) out[tp] = Math.max(out[tp] || 0, (twO.bonus && twO.bonus[tp]) || 0);
    }
    return out;
  }

  // Tipos com clique órfão ainda no prazo, na mesma conta, em qualquer baía: bloqueiam o tipo para a conta.
  function tiposEmOrfao(conta, t) {
    const out = [];
    for (const o of bays) {
      for (const x of o.orfaos) if (x.conta === conta && t < x.ate && !out.includes(x.tipo)) out.push(x.tipo);
    }
    return out;
  }

  // Outra baía tem resgate em curso ou soltou/resgatou há menos de INTERVALO_RESGATE_MS: esta espera a vez.
  function outraLiveOcupada(b, t) {
    return bays.some((o) => o !== b && (!!o.pendente || t - o.ultimoResgateEm < P.INTERVALO_RESGATE_MS || t - o.soltouEm < P.INTERVALO_RESGATE_MS));
  }

  // Diag da página da vaga (já saneado em limparFatos) entra no detalhe do log quando existe. Nunca vai para a tela.
  function comDiag(k, detalhe) {
    const st = stOf(k);
    const diag = st && st.pagina && st.pagina.diag ? st.pagina.diag : null;
    return diag ? { ...detalhe, diag } : detalhe;
  }

  // Troca de login solta o pendente. Clicado vira trava da conta que clicou. Não clicado vira órfão, reconhecido depois por k e id:
  // o clique que ainda chegar desse pedido grava a trava da conta antiga. A janela é recarregada, sem tirar a janela do usuário.
  function soltarPendente(i, t) {
    const b = bays[i];
    const pd = b.pendente;
    if (!pd) return;
    b.soltouEm = t;
    if (pd.clicado) {
      gravarTravaDoPendente(i, t);
      b.ultimo = { tipo: pd.tipo, em: t, estado: 'sem-confirmacao', motivo: 'sem-confirmacao', clicou: true, canal: pd.canal };
      if (P.loginValido(pd.conta)) registrar({ baia: i, tipo: pd.tipo, motivo: 'trava-por-troca-de-login', canal: pd.canal, stream: slotDe(pd.k), clicou: true, detalhe: { conta: pd.conta } });
    } else {
      b.orfaos.push({ id: pd.id, k: pd.k, conta: pd.conta, tipo: pd.tipo, canal: pd.canal, bonusAntes: pd.bonusAntes, ate: t + P.PRAZO_CONFIRMACAO_MS });
      recarregarPendente(pd, t);
    }
    b.pendente = null;
  }

  // Resultado de um pedido órfão, reconhecido por k e id. 'clicado' grava a trava da conta antiga; qualquer outro resultado
  // só tira o órfão da lista. Sem órfão de mesmo k e id, nada acontece.
  function tratarOrfao(i, k, id, estado) {
    const b = bays[i];
    const idx = b.orfaos.findIndex((o) => o.k === k && o.id === id);
    if (idx < 0) return;
    const o = b.orfaos[idx];
    b.orfaos.splice(idx, 1);
    if (estado !== 'clicado') return;
    gravarTrava(i, o, agora());
    registrar({ baia: i, tipo: o.tipo, motivo: 'clicado-depois-da-troca', canal: o.canal, stream: slotDe(k), clicou: true });
  }

  function stOf(k) {
    return bays[bayDe(k)].streams[slotDe(k)];
  }

  // Recarrega a janela do pendente para matar o fluxo antigo e limpa a última página. A janela visível do usuário não é recarregada.
  function recarregarPendente(pd, t) {
    if (janelas.existe(pd.k) && !stOf(pd.k).visivelUsuario) {
      janelas.recarregar(pd.k);
      stOf(pd.k).recarregouEm = t;
      stOf(pd.k).pagina = null;
    }
  }

  // Conta a falha da baía; quando ela pausa o tipo, deixa a pausa (e a hora de volta) no log.
  function contarFalha(b, i, tipo, t) {
    b.falhas = P.registrarFalha(b.falhas, tipo, t);
    const f = b.falhas[tipo];
    if (f && f.n >= P.MAX_FALHAS) {
      registrar({
        baia: i,
        tipo: 'pausa',
        motivo: 'falhas-repetidas',
        pausado: f.ate,
        detalhe: { tipo, falhas: f.n },
      });
    }
  }

  // Falha de um canal (sem-recompensa e parecidos): pausa só aquele canal.
  function contarFalhaCanal(b, i, canal, tipo, t) {
    if (!canal) {
      contarFalha(b, i, tipo, t);
      return;
    }
    const nova = P.registrarFalha(b.falhasCanal[canal], tipo, t);
    b.falhasCanal[canal] = nova;
    const f = nova[tipo];
    if (f && f.n >= P.MAX_FALHAS) {
      registrar({
        baia: i,
        tipo: 'pausa',
        motivo: 'falhas-repetidas',
        canal,
        pausado: f.ate,
        detalhe: { tipo, falhas: f.n },
      });
    }
  }

  function enviar(k, tipo) {
    stOf(k).cmdEm[tipo] = agora();
    janelas.enviar(k, { tipo });
  }

  function querJanela(k) {
    const i = bayDe(k);
    const b = bays[i];
    const st = stOf(k);
    return prefs().auto[i] === true && b.jogo.ativo && !!b.jogo.twitch && !!b.loginTwitch && !!st.canal;
  }

  // Passo de uma vaga: abrir, janela do usuário, canal, página, player, vigia de ganho e prontidão para resgate.
  function passoStream(i, s, c) {
    const b = bays[i];
    const st = b.streams[s];
    const k = kDe(i, s);
    const t = c.t;
    st.alcancou = false;
    st.logada = false;
    st.pronta = false;
    st.saldo = null;
    st.canal = b.canais[s];
    // Trocar o canal da vaga zera a medição e o baú: a taxa é por canal, desde a entrada nele.
    if (st.medCanal !== st.canal) {
      st.med = null;
      st.bauEm = 0;
      st.medCanal = st.canal;
    }
    const url = HOME + st.canal;

    // 2. abrir: uma janela de vídeo por tick no total (orçamento global); as vagas extras também exigem a vaga 0 logada.
    if (!janelas.existe(k)) {
      // Orçamento global: uma janela de vídeo por tick no total (vaga 0 de qualquer baía inclusive).
      if (c.global.abriu || (s > 0 && !vagaZeroLogada(b, t))) {
        st.situacao = 'abrindo';
        return;
      }
      janelas.abrir(k, url, { modo: st.modo, visivel: false });
      c.global.abriu = true;
      st.abertoEm = t;
      st.navegouEm = t;
      st.pagina = null;
      st.ganho = null;
      st.med = null;
      st.bauEm = 0;
      st.situacao = 'abrindo';
      return;
    }
    const fresca = !!st.pagina && t - st.paginaEm <= P.PAGINA_VELHA_MS;

    // 3. janela do usuário: só o baú
    if (st.visivelUsuario) {
      if (fresca && st.pagina.bau && t - st.cmdEm.bau >= CMD_BAU_MS) enviar(k, 'bau');
      st.situacao = 'janela-aberta';
      return;
    }

    // 4. canal certo (raid, navegação)
    if (P.canalDaUrl(janelas.url(k)) !== st.canal) {
      // A janela do pendente não navega: o resultado do clique ainda pode chegar por ela.
      if (k !== c.pendK && t - st.navegouEm >= ESPERA_NAVEGAR_MS) {
        janelas.navegar(k, url);
        st.navegouEm = t;
        st.pagina = null;
      }
      st.situacao = 'abrindo';
      return;
    }

    // 5. página respondendo
    if (!fresca) {
      const ultimaAcao = Math.max(st.abertoEm, st.navegouEm, st.recarregouEm);
      if (k !== c.pendK && t - ultimaAcao >= ESPERA_PAGINA_MS && t - st.recarregouEm >= ESPERA_RECARGA_MS) {
        janelas.recarregar(k);
        st.recarregouEm = t;
      }
      st.situacao = 'abrindo';
      return;
    }
    const pg = st.pagina;

    // 6. player
    if (pg.portao && t - st.cmdEm.portao >= CMD_PORTAO_MS) enviar(k, 'portao');
    else if (pg.pausado && t - st.cmdEm.play >= CMD_PLAY_MS) enviar(k, 'play');
    if (pg.bau && t - st.cmdEm.bau >= CMD_BAU_MS) {
      enviar(k, 'bau');
      st.bauEm = t;
    }
    if (pg.rodando) {
      st.rodandoEm = t;
    } else if (k !== c.pendK && !pg.portao && st.rodandoEm && t - st.rodandoEm >= VIDEO_PARADO_MS && t - st.recarregouEm >= ESPERA_RECARGA_MS) {
      janelas.recarregar(k);
      st.recarregouEm = t;
    }

    // 7. vigia de ganho (D12), por vaga. Sem ganho, a vaga sai da tela uma vez.
    // O vigia só conta com a página logada (T1): tela de login não é ganho de pontos.
    const logadoOk = pg.logado && !pg.deslogado;
    const saldo = P.parsePontos(pg.saldoTexto);
    const saldoLogado = logadoOk && saldo ? saldo : null;
    const g = P.avaliarGanho(st.ganho, { rodando: pg.rodando && logadoOk, saldoMinimo: saldoLogado ? saldoLogado.minimo : null, bauEm: st.bauEm }, t);
    st.ganho = g.estado;
    if (g.semGanho && st.modo === 'oculta') {
      st.modo = 'fora-da-tela';
      janelas.fechar(k);
      st.ganho = null;
      st.situacao = 'abrindo';
      return;
    }
    st.semGanho = g.semGanho && st.modo === 'fora-da-tela';

    // Medição de ganho por canal (só com a página logada). Log de ganho a cada 30 min por canal.
    if (logadoOk) {
      const med = P.medirGanho(st.med ? st.med.estado : null, { saldo: saldoLogado, bauEm: st.bauEm }, t);
      st.med = med;
      const ultimoLog = b.logGanhoEm[st.canal] || 0;
      if (!med.medindo && med.ganhoHora !== null && t - ultimoLog >= LOG_GANHO_MS) {
        b.logGanhoEm[st.canal] = t;
        registrar({ baia: i, motivo: 'ganho', canal: st.canal, stream: s, detalhe: { ganhoHora: med.ganhoHora, baus: med.baus, ativas: c.ativas } });
      }
    }

    // 8. prontidão desta live (a trava e a escolha ficam com a baía)
    st.alcancou = true;
    st.logada = logadoOk;
    if (!logadoOk) {
      st.situacao = 'sem-login-pagina';
      return;
    }
    st.saldo = saldo;
    st.pronta = pg.canal === st.canal && noAr(c.tw, st.canal);
    st.situacao = pg.canal === st.canal ? 'assistindo' : 'abrindo';
  }

  function passo(i, global) {
    const p = prefs();
    const b = bays[i];
    const t = agora();
    const tw = b.jogo.ativo ? b.jogo.twitch : null;
    const n = vagasDe(p, i);

    // Órfãos vencidos somem: o clique que não chegou no prazo não trava mais nada.
    b.orfaos = b.orfaos.filter((o) => t < o.ate);
    // 0. pendente: confere sempre, mesmo que o resto mude
    if (b.pendente) {
      const pd = b.pendente;
      // Bônus só confirma o pendente da conta vinculada no jogo (tw.login). Bônus de outra conta não confirma.
      const confirma = tw && P.mesmoLogin(tw.login, pd.conta) ? tw.bonus : null;
      const e = P.estadoPendente(pd, confirma, t);
      if (e === 'confirmado') {
        b.ultimo = { tipo: pd.tipo, em: t, estado: 'ok', motivo: pd.via === 'texto' ? 'confirmado' : '', canal: pd.canal };
        registrar({ baia: i, tipo: pd.tipo, motivo: 'confirmado', canal: pd.canal, stream: slotDe(pd.k), clicou: pd.clicado === true });
        b.falhas = P.registrarSucesso(b.falhas, pd.tipo);
        limparFalhaCanal(b, pd.canal, pd.tipo);
        b.pendente = null;
        b.ultimoResgateEm = t;
      } else if (e === 'expirado' && pd.clicado) {
        // Clicou e o jogo não confirmou: não conta falha. A trava é da conta que clicou (pd.conta): o tipo fica travado nela
        // até o bônus subir tarde da mesma conta ou vencer em PRAZO_TRAVA_MS (3 h). A trava vive só em memória.
        const tipo = pd.tipo;
        gravarTravaDoPendente(i, t);
        const detalhe = { via: pd.via || '', redeem: pd.redeem || null, posClique: pd.posClique || null };
        b.ultimo = Object.assign({ tipo, em: t, estado: 'sem-confirmacao', motivo: 'sem-confirmacao', clicou: true, canal: pd.canal }, detalhe);
        registrar({ baia: i, tipo, motivo: 'sem-confirmacao', clicou: true, canal: pd.canal, stream: slotDe(pd.k), detalhe: comDiag(pd.k, detalhe) });
        b.pendente = null;
        b.ultimoResgateEm = t;
      } else if (e === 'expirado') {
        b.ultimo = { tipo: pd.tipo, em: t, estado: 'sem-confirmacao', motivo: '', canal: pd.canal };
        contarFalha(b, i, pd.tipo, t);
        // Libera a baía antes de recarregar: uma exceção na recarga não prende o pendente nem as outras baías.
        b.pendente = null;
        b.ultimoResgateEm = t;
        // Sem clique e sem resultado: recarrega a janela do pendente para matar o fluxo antigo.
        // Janela visível do usuário não é recarregada; a recarga limpa a última página.
        recarregarPendente(pd, t);
      }
    }
    // Confirmação tardia: o bônus da mesma conta subiu depois do prazo. Destrava o tipo e conta como sucesso.
    for (const chave of Object.keys(travas)) {
      const sc = travas[chave];
      const tipo = sc.tipo;
      const dona = bays[sc.baia];
      // Só o bônus da conta que clicou solta a trava (lido na baía atual); o vencimento por tempo vale para qualquer conta.
      const mesmaConta = !!tw && P.mesmoLogin(tw.login, sc.conta);
      if (mesmaConta && tw.bonus && (tw.bonus[tipo] || 0) > sc.bonusAntes) {
        delete travas[chave];
        dona.falhas = P.registrarSucesso(dona.falhas, tipo);
        limparFalhaCanal(dona, sc.canal, tipo);
        dona.ultimo = { tipo, em: t, estado: 'ok', motivo: '', canal: sc.canal || '' };
        registrar({ baia: sc.baia, tipo, motivo: 'confirmado-tardio', canal: sc.canal, stream: sc.k === undefined ? undefined : slotDe(sc.k), clicou: true });
      } else if (t - sc.em >= PRAZO_TRAVA_MS) {
        delete travas[chave];
        registrar({ baia: sc.baia, tipo, motivo: 'trava-vencida', canal: sc.canal, stream: sc.k === undefined ? undefined : slotDe(sc.k), detalhe: { conta: P.loginValido(sc.conta) ? sc.conta : '' } });
      }
    }

    // Automático desligado não apaga a trava: ela segue até o bônus subir tarde ou vencer em PRAZO_TRAVA_MS.

    const pendK = b.pendente ? b.pendente.k : -1;
    // 1. pré-requisitos; sem eles, fecha só as janelas que NÃO são do usuário
    let motivo = !p.auto[i] ? 'desligado' : !b.jogo.ativo ? 'sem-jogo' : !tw ? 'sem-bloco' : !b.loginTwitch ? 'sem-login' : '';
    if (!motivo) {
      // Com pendente, a lista de canais fica congelada até o pendente resolver.
      if (!b.pendente) b.canais = P.escolherCanais(tw.oficiais, canaisEscolhidos(p, i), b.canais, n).concat(new Array(BAYS - n).fill(''));
      const temCanal = [0, 1, 2, 3].some((s) => (s < n || kDe(i, s) === pendK) && !!b.canais[s]);
      if (!temCanal) motivo = 'sem-canal';
    }
    if (motivo) {
      // A janela do pendente fica: um motivo de pré-requisito não mata um resgate em curso.
      for (let s = 0; s < BAYS; s += 1) {
        const k = kDe(i, s);
        if (janelas.existe(k) && !b.streams[s].visivelUsuario && k !== pendK) janelas.fechar(k);
      }
      b.situacao = motivo;
      return;
    }

    const usados = [0, 1, 2, 3].filter((s) => (s < n || kDe(i, s) === pendK) && !!b.canais[s]);
    const c = { t, tw, global, ativas: usados.length, pendK };
    for (const s of usados) passoStream(i, s, c);

    // Vagas que sobraram fecham, exceto a do pendente e a janela do usuário.
    for (let s = 0; s < BAYS; s += 1) {
      if (usados.includes(s)) continue;
      const st = b.streams[s];
      const k = kDe(i, s);
      st.canal = '';
      st.med = null;
      st.medCanal = '';
      st.bauEm = 0;
      st.pagina = null;
      st.ganho = null;
      st.semGanho = false;
      st.situacao = 'desligado';
      if (janelas.existe(k) && !st.visivelUsuario && k !== pendK) janelas.fechar(k);
    }

    // Janela visível em qualquer vaga bloqueia o resgate da baía inteira.
    if (b.streams.some((st) => st.visivelUsuario)) {
      b.situacao = 'janela-aberta';
      return;
    }

    const semGanhoTodas = usados.length > 0 && usados.every((s) => b.streams[s].semGanho);
    const alcancadas = usados.filter((s) => b.streams[s].alcancou);
    const fechar = (sit) => {
      b.situacao = sit;
      for (const s of usados) {
        const st = b.streams[s];
        if (st.alcancou && st.logada && st.pronta) st.situacao = sit === 'resgatando' ? 'assistindo' : sit;
      }
    };
    if (!alcancadas.length) {
      b.situacao = usados.length ? b.streams[usados[0]].situacao : 'abrindo';
      return;
    }
    const logadas = alcancadas.filter((s) => b.streams[s].logada);
    if (!logadas.length) {
      b.situacao = 'sem-login-pagina';
      return;
    }
    // 8. trava e resgate
    const trava = P.travaSeguranca({ vinculado: tw.vinculado, loginJogo: tw.login, loginTwitch: b.loginTwitch });
    if (!trava.ok) {
      b.situacao = trava.motivo;
      return;
    }
    const prontas = logadas.filter((s) => b.streams[s].pronta);
    if (!prontas.length) {
      b.situacao = 'abrindo';
      return;
    }
    if (b.pendente) {
      fechar('resgatando');
      return;
    }
    if (t - b.ultimoResgateEm < P.INTERVALO_RESGATE_MS) {
      fechar(semGanhoTodas ? 'sem-ganho' : 'assistindo');
      return;
    }
    const bonus = bonusDaConta(b, tw);
    const orfaos = tiposEmOrfao(b.loginTwitch, t);
    const esc = P.escolherResgateCanais({
      tipos: P.TIPOS.filter((tp) => p.tipos[tp] && !orfaos.includes(tp)),
      bonus,
      agoraServidor: t + (b.jogo.offsetMs || 0),
      streams: prontas.map((s) => ({
        s,
        canal: b.streams[s].canal,
        saldo: b.streams[s].saldo,
        falhasCanal: b.falhasCanal[b.streams[s].canal],
        foco: focoDe(p, i, b.streams[s].canal),
      })),
      recompensas: tw.recompensas,
      falhas: b.falhas,
      agora: t,
      travados: travadosDaConta(b, travas),
      leituraOk: tw.bonusLido === true && tw.relogioLido === true,
    });
    if (esc.espera) {
      let sit = SITUACAO_ESPERA[esc.espera];
      if (sit === 'assistindo' && semGanhoTodas) sit = 'sem-ganho';
      fechar(sit);
      return;
    }
    // Outra baía resgatando ou acabou de resgatar/soltar: esta espera. Não conta falha nem log.
    if (outraLiveOcupada(b, t)) {
      fechar(semGanhoTodas ? 'sem-ganho' : 'outra-live');
      return;
    }
    seq += 1;
    const k = kDe(i, esc.s);
    vez = (i + 1) % BAYS;
    b.pendente = {
      id: seq,
      tipo: esc.tipo,
      custo: esc.custo,
      bonusAntes: bonus[esc.tipo] || 0,
      em: t,
      clicado: false,
      k,
      canal: esc.canal,
      conta: b.loginTwitch,
    };
    janelas.enviar(k, { tipo: 'resgatar', id: b.pendente.id, titulo: esc.titulo, custo: esc.custo });
    b.streams[esc.s].ganho = null;
    fechar('resgatando');
    for (const s of usados) {
      if (kDe(i, s) === k) b.streams[s].situacao = 'resgatando';
    }
  }

  function custosAtuais() {
    for (const b of bays) {
      const tw = b.jogo.ativo ? b.jogo.twitch : null;
      const rec = tw && Array.isArray(tw.recompensas) ? tw.recompensas : [];
      if (!rec.length) continue;
      const out = { ...CUSTOS_PADRAO };
      for (const r of rec) {
        if (r && P.TIPOS.includes(r.tipo)) out[r.tipo] = r.custo;
      }
      return out;
    }
    return { ...CUSTOS_PADRAO };
  }

  // Ganho/h arredondado para dezenas.
  function dezenas(v) {
    return Number.isFinite(v) ? Math.round(v / 10) * 10 : null;
  }

  // tempo = true traz o bônus em ms restantes (para a UI); false traz o prazo absoluto (para comparar sem o relógio).
  function montar(tempo) {
    const t = agora();
    const prefsAgora = prefs();
    const bays_ = bays.map((b, i) => {
      const tw = b.jogo.ativo ? b.jogo.twitch : null;
      const n = vagasDe(prefsAgora, i);
      const s0 = b.streams[0];
      const pg = s0.pagina;
      const bonus = {};
      for (const k of P.TIPOS) {
        const bruto = tw && tw.bonus ? tw.bonus[k] : 0;
        bonus[k] = tempo ? P.restanteMs(bruto, t + (b.jogo.offsetMs || 0)) : (bruto || 0);
      }
      const saldo = pg && pg.saldoTexto ? P.parsePontos(pg.saldoTexto) : null;
      const ativas = Object.values(b.falhas).filter((f) => f && f.ate > t).map((f) => f.ate);
      const escolhidos = canaisEscolhidos(prefsAgora, i);
      const foraDoAr = escolhidos.filter((login) => !noAr(tw, login));
      let substituir = 0;
      const streams = [];
      for (let s = 0; s < n; s += 1) {
        const st = b.streams[s];
        const k = kDe(i, s);
        const pgs = st.pagina;
        const med = st.canal && st.medCanal === st.canal ? st.med : null;
        const pausadoCanal = st.canal && b.falhasCanal[st.canal]
          ? Object.values(b.falhasCanal[st.canal]).filter((f) => f && f.ate > t).map((f) => f.ate)
          : [];
        const escolhido = !!st.canal && escolhidos.includes(st.canal);
        let substitui = null;
        if (st.canal && !escolhido && foraDoAr.length > substituir) {
          substitui = foraDoAr[substituir];
          substituir += 1;
        }
        const ganhoHora = med ? dezenas(med.ganhoHora) : null;
        streams.push({
          k,
          s,
          canal: st.canal ? nomeDoCanal(tw, st.canal) : null,
          escolhido,
          substitui,
          janela: janelas.existe(k) ? (st.visivelUsuario ? 'visivel' : 'oculta') : 'fechada',
          modo: st.modo,
          video: !pgs ? '' : (pgs.rodando ? 'rodando' : (pgs.pausado ? 'parado' : 'carregando')),
          pontos: pgs && pgs.saldoTexto ? { texto: pgs.saldoTexto, minimo: P.parsePontos(pgs.saldoTexto) ? P.parsePontos(pgs.saldoTexto).minimo : null } : null,
          ganhoHora,
          baus: med ? med.baus : 0,
          aproximado: med ? med.aproximado === true : false,
          medindo: med ? med.medindo === true : true,
          semGanho: st.semGanho === true,
          pausadoAte: pausadoCanal.length ? Math.max(...pausadoCanal) : 0,
          situacao: erroPaginaRecente(st, t) && st.situacao === 'abrindo' ? 'erro-pagina' : st.situacao,
        });
      }
      const ganhos = streams.map((x) => x.ganhoHora).filter((v) => v !== null);
      return {
        auto: prefsAgora.auto[i] === true,
        jogo: !!(b.jogo.ativo && b.jogo.twitch),
        vinculado: tw && typeof tw.vinculado === 'boolean' ? tw.vinculado : null,
        loginJogo: tw && typeof tw.login === 'string' ? tw.login : '',
        loginTwitch: b.loginTwitch,
        contaBate: P.mesmoLogin(b.loginTwitch, tw && tw.login),
        janela: janelas.existe(kDe(i, 0)) ? (s0.visivelUsuario ? 'visivel' : 'oculta') : 'fechada',
        modo: s0.modo,
        canal: s0.canal ? nomeDoCanal(tw, s0.canal) : null,
        video: !pg ? '' : (pg.rodando ? 'rodando' : (pg.pausado ? 'parado' : 'carregando')),
        pontos: pg && pg.saldoTexto ? { texto: pg.saldoTexto, minimo: saldo ? saldo.minimo : null } : null,
        bonus,
        pct: tw && typeof tw.pct === 'number' ? tw.pct : 0,
        ultimo: b.ultimo,
        pausadoAte: ativas.length ? Math.max(...ativas) : 0,
        navegador: { estado: b.navegador.estado, motivo: b.navegador.motivo, em: b.navegador.em },
        situacao: erroPaginaRecente(s0, t) && b.situacao === 'abrindo' ? 'erro-pagina' : b.situacao,
        alvo: n,
        streams,
        oficiais: tw && Array.isArray(tw.oficiais)
          ? tw.oficiais.filter((o) => o && typeof o.login === 'string').map((o) => ({
            login: o.login,
            nome: typeof o.nome === 'string' ? o.nome : o.login,
            espectadores: Number.isFinite(o.espectadores) ? o.espectadores : 0,
            aoVivo: o.aoVivo === true,
            ativo: o.ativo === true,
          }))
          : [],
        escolhidos,
        ganhoTotalHora: ganhos.length ? dezenas(ganhos.reduce((soma, v) => soma + v, 0)) : null,
      };
    });
    return {
      enviadoEm: tempo ? t : 0,
      custos: custosAtuais(),
      bays: bays_,
    };
  }

  function snapshot() {
    return montar(true);
  }

  // Impressão do estado sem o relógio: só muda quando algo de fato muda.
  function marca() {
    return JSON.stringify(montar(false));
  }

  function avisar() {
    const atual = marca();
    if (atual === ultimaMarca) return;
    ultimaMarca = atual;
    if (typeof onChange === 'function') onChange();
  }

  function setJogo(i, { ativo, twitch, offsetMs }) {
    bays[i].jogo = {
      ativo: ativo === true,
      twitch: twitch || null,
      offsetMs: Number.isFinite(offsetMs) ? offsetMs : 0,
    };
    avisar();
  }

  // Só um login válido diferente do último válido troca de conta (O-2). null (leitura falhou) não muda nada e não avisa.
  // Vazio ou inválido zera a conta da baía, sem apagar o último login válido.
  function setLoginTwitch(i, login) {
    const b = bays[i];
    if (login === null) return;
    if (P.loginValido(login)) {
      const nova = login.trim().toLowerCase();
      if (b.ultimoLoginValido && b.ultimoLoginValido !== nova) {
        // Clique que ainda não virou bônus vira trava da conta que clicou, como no sair. O intervalo da baía segue valendo.
        soltarPendente(i, agora());
        b.falhas = {};
        b.falhasCanal = {};
        zerarMedidas(b);
        b.logGanhoEm = {};
      }
      b.ultimoLoginValido = nova;
      b.loginTwitch = nova;
    } else {
      b.loginTwitch = '';
    }
    avisar();
  }

  function pagina(k, fatos) {
    const st = stOf(k);
    st.pagina = fatos || null;
    st.paginaEm = agora();
    avisar();
  }

  function resultado(k, { id, estado, motivo, trava, vistos, fase, clicou, pistas, pistasAntes, dialogoAntes, dialogos, botoesCentro, totalBotoesCentro, cabecalho, classes, cardClicado = null, percurso = null, via = '', redeem = null, posClique = null }) {
    const i = bayDe(k);
    const b = bays[i];
    // Só vale o resultado do pendente desta janela: id e k precisam bater. Sem pendente de mesmo id e k, o resultado pode ser
    // de um pedido órfão (pendente solto por troca de login): só ele mexe no órfão, nunca no pendente novo.
    if (!b.pendente || b.pendente.id !== id || b.pendente.k !== k) {
      tratarOrfao(i, k, id, estado);
      return;
    }
    const pd = b.pendente;
    if (estado === 'clicado') {
      pd.clicado = true;
      if (via === 'texto' || via === 'dedicado') pd.via = via;
      if (via === 'texto' && posClique && typeof posClique === 'object') {
        pd.redeem = redeem && typeof redeem === 'object' ? redeem : null;
        pd.posClique = posClique;
        b.ultimo = { tipo: pd.tipo, em: agora(), estado: 'clicado', motivo: 'clicado-texto', clicou: true, via: 'texto', redeem: pd.redeem, posClique, canal: pd.canal };
      }
      return;
    }
    if (estado === 'falhou') {
      if (pd.clicado) {
        // Depois do clique a falha não derruba o pendente: o jogo ainda pode confirmar.
        registrar({ baia: i, tipo: pd.tipo, motivo: 'falha-depois-do-clique', clicou: true, canal: pd.canal, stream: slotDe(k), detalhe: comDiag(k, { motivo: typeof motivo === 'string' ? motivo : '' }) });
        return;
      }
      const t = agora();
      b.ultimo = {
        tipo: pd.tipo,
        em: t,
        estado: 'falhou',
        motivo,
        trava: typeof trava === 'string' ? trava : '',
        vistos: Array.isArray(vistos) ? vistos : [],
        fase: fase || '',
        clicou: clicou === true,
        pistas: Array.isArray(pistas) ? pistas : [],
        pistasAntes: Array.isArray(pistasAntes) ? pistasAntes : null,
        dialogoAntes: dialogoAntes === true,
        dialogos: Array.isArray(dialogos) ? dialogos : [],
        botoesCentro: Array.isArray(botoesCentro) ? botoesCentro : [],
        totalBotoesCentro: typeof totalBotoesCentro === 'number' ? totalBotoesCentro : 0,
        cabecalho: cabecalho && typeof cabecalho === 'object' ? cabecalho : null,
        classes: Array.isArray(classes) ? classes : [],
        cardClicado: cardClicado && typeof cardClicado === 'object' ? cardClicado : null,
        percurso: percurso && typeof percurso === 'object' ? percurso : null,
        canal: pd.canal,
      };
      const u = b.ultimo;
      // Diagnóstico da página da live que falhou (já saneado em limparFatos). Vai só para o log, não para a tela.
      const diagPagina = stOf(k).pagina && stOf(k).pagina.diag ? stOf(k).pagina.diag : null;
      registrar({
        baia: i,
        tipo: u.tipo,
        motivo: u.motivo,
        fase: u.fase,
        trava: u.trava,
        clicou: u.clicou,
        canal: pd.canal,
        stream: slotDe(k),
        detalhe: {
          vistos: u.vistos,
          pistas: u.pistas,
          pistasAntes: u.pistasAntes,
          dialogoAntes: u.dialogoAntes,
          ...(diagPagina ? { diag: diagPagina } : {}),
          dialogos: u.dialogos,
          botoesCentro: u.botoesCentro,
          totalBotoesCentro: u.totalBotoesCentro,
          cabecalho: u.cabecalho,
          classes: u.classes,
          cardClicado: u.cardClicado,
          percurso: u.percurso,
        },
      });
      if (P.MOTIVOS_DO_CANAL.includes(motivo)) contarFalhaCanal(b, i, pd.canal, pd.tipo, t);
      else contarFalha(b, i, pd.tipo, t);
      b.pendente = null;
      b.ultimoResgateEm = t;
      avisar();
    }
  }

  function entrar(i) {
    const b = bays[i];
    const st = b.streams[0];
    const k = kDe(i, 0);
    if (janelas.existe(k)) janelas.navegar(k, LOGIN);
    else janelas.abrir(k, LOGIN, { modo: st.modo, visivel: true });
    janelas.mostrar(k);
    st.visivelUsuario = true;
    b.loginRapidoAte = agora() + LOGIN_RAPIDO_MS;
    avisar();
  }

  function mostrar(k, on) {
    const st = stOf(k);
    if (on) {
      if (!janelas.existe(k)) janelas.abrir(k, st.canal ? HOME + st.canal : HOME, { modo: st.modo, visivel: true });
      else janelas.mostrar(k);
      st.visivelUsuario = true;
    } else {
      st.visivelUsuario = false;
      if (querJanela(k)) janelas.esconder(k, st.modo);
      else janelas.fechar(k);
    }
    avisar();
  }

  function sair(i) {
    const b = bays[i];
    const t = agora();
    const pd = b.pendente;
    if (pd) {
      b.soltouEm = t;
      // Não clicado vira órfão, como na troca de login: um 'clicado' que ainda chegar grava a trava da conta antiga.
      if (!pd.clicado) b.orfaos.push({ id: pd.id, k: pd.k, conta: pd.conta, tipo: pd.tipo, canal: pd.canal, bonusAntes: pd.bonusAntes, ate: t + P.PRAZO_CONFIRMACAO_MS });
    }
    gravarTravaDoPendente(i, t);
    b.pendente = null;
    for (let s = 0; s < BAYS; s += 1) {
      const st = b.streams[s];
      st.visivelUsuario = false;
      janelas.fechar(kDe(i, s));
    }
    b.loginTwitch = '';
    b.navegador = { estado: '', motivo: '', em: 0 };
    b.falhasCanal = {};
    zerarMedidas(b);
    b.logGanhoEm = {};
    avisar();
    return janelas.limpar(i);
  }

  function janelaEscondida(k) {
    stOf(k).visivelUsuario = false;
    avisar();
  }

  function janelaFechada(k) {
    const st = stOf(k);
    st.visivelUsuario = false;
    st.pagina = null;
    avisar();
  }

  // Estado do login pelo navegador. Com "ok" e login, a conta entra nesta baía e as janelas da baía recarregam.
  function navegadorEstado(i, { estado, motivo, login }) {
    const b = bays[i];
    b.navegador = { estado: estado || '', motivo: motivo || '', em: agora() };
    if (estado === 'ok' && login) {
      setLoginTwitch(i, login);
      // A janela do pendente não recarrega: o resultado do clique ainda pode chegar por ela.
      const pendK = b.pendente ? b.pendente.k : -1;
      for (let s = 0; s < BAYS; s += 1) {
        const k = kDe(i, s);
        if (k !== pendK && janelas.existe(k)) janelas.recarregar(k);
      }
    }
    avisar();
  }

  // Erro de carga da página aparece por um minuto; a recarga normal (passo) continua valendo.
  function erroPaginaRecente(st, t) {
    return st.erroPaginaEm > 0 && t - st.erroPaginaEm < 60000;
  }

  function erroPagina(k) {
    stOf(k).erroPaginaEm = agora();
    avisar();
  }

  function precisaLoginRapido(i) {
    const b = bays[i];
    return b.streams.some((st) => st.visivelUsuario) || agora() < b.loginRapidoAte;
  }

  function tick() {
    const global = { abriu: false };
    // A ordem começa na baía da vez (a seguinte à última que resgatou). Sem resgate, segue 0..3.
    const ini = vez;
    for (let n = 0; n < BAYS; n += 1) {
      const i = (ini + n) % BAYS;
      // Uma baía que lança não derruba as outras: ela mostra o estado de erro e o laço segue.
      try {
        passo(i, global);
      } catch {
        bays[i].situacao = 'erro-baia';
      }
    }
    avisar();
  }

  return {
    setJogo,
    setLoginTwitch,
    pagina,
    resultado,
    entrar,
    mostrar,
    sair,
    querJanela,
    janelaEscondida,
    janelaFechada,
    precisaLoginRapido,
    tick,
    snapshot,
    marca,
    navegadorEstado,
    erroPagina,
  };
}

module.exports = {
  createTwitchController,
  kDe,
  bayDe,
  slotDe,
  TICK_MS,
  ESPERA_NAVEGAR_MS,
  ESPERA_PAGINA_MS,
  ESPERA_RECARGA_MS,
  VIDEO_PARADO_MS,
  CMD_PORTAO_MS,
  CMD_PLAY_MS,
  CMD_BAU_MS,
  HOME,
  LOGIN,
  PRAZO_TRAVA_MS,
};
