'use strict';

// Máquina de estado do bônus Twitch, uma por baía. Sem electron: janelas, prefs e relógio entram por parâmetro.
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

const SITUACAO_ESPERA = {
  'sem-tipos': 'assistindo',
  'em-dia': 'assistindo',
  saldo: 'juntando',
  'sem-saldo-lido': 'sem-saldo-lido',
  pausado: 'pausado',
  'sem-recompensa': 'sem-recompensa',
};

function estadoInicial() {
  return {
    jogo: { ativo: false, twitch: null, offsetMs: 0 },
    loginTwitch: '',
    pagina: null,
    paginaEm: 0,
    canal: '',
    visivelUsuario: false,
    modo: 'oculta',
    abertoEm: 0,
    navegouEm: 0,
    recarregouEm: 0,
    rodandoEm: 0,
    pendente: null,
    falhas: {},
    ultimo: null,
    ultimoResgateEm: 0,
    cmdEm: { portao: 0, play: 0, bau: 0 },
    bauEm: 0,
    ganho: null,
    semGanho: false,
    loginRapidoAte: 0,
    navegador: { estado: '', motivo: '', em: 0 },
    erroPaginaEm: 0,
    ultimoLoginValido: '',
    situacao: 'desligado',
  };
}

function nomeDoCanal(tw, login) {
  const lista = tw && Array.isArray(tw.oficiais) ? tw.oficiais : [];
  const achado = lista.find((o) => o && typeof o.login === 'string' && o.login.toLowerCase() === login);
  return { login, nome: achado && achado.nome ? achado.nome : login };
}

function createTwitchController({ janelas, prefs, agora, onChange }) {
  const bays = [];
  for (let i = 0; i < BAYS; i += 1) bays.push(estadoInicial());
  let seq = 0;
  let ultimaMarca = '';

  function enviar(i, tipo) {
    bays[i].cmdEm[tipo] = agora();
    janelas.enviar(i, { tipo });
  }

  function querJanela(i) {
    const b = bays[i];
    return prefs().auto[i] === true && b.jogo.ativo && !!b.jogo.twitch && !!b.loginTwitch && !!b.canal;
  }

  function passo(i) {
    const p = prefs();
    const b = bays[i];
    const t = agora();
    const tw = b.jogo.ativo ? b.jogo.twitch : null;

    // 0. pendente: confere sempre, mesmo que o resto mude
    if (b.pendente) {
      const e = P.estadoPendente(b.pendente, tw && tw.bonus, t);
      if (e === 'confirmado') {
        b.ultimo = { tipo: b.pendente.tipo, em: t, estado: 'ok', motivo: '' };
        b.falhas = P.registrarSucesso(b.falhas, b.pendente.tipo);
        b.pendente = null;
        b.ultimoResgateEm = t;
      } else if (e === 'expirado') {
        b.ultimo = { tipo: b.pendente.tipo, em: t, estado: 'sem-confirmacao', motivo: '' };
        b.falhas = P.registrarFalha(b.falhas, b.pendente.tipo, t);
        b.pendente = null;
        b.ultimoResgateEm = t;
      }
    }

    // 1. pré-requisitos; sem eles, fecha só a janela que NÃO é do usuário
    let motivo = !p.auto[i] ? 'desligado' : !b.jogo.ativo ? 'sem-jogo' : !tw ? 'sem-bloco' : !b.loginTwitch ? 'sem-login' : '';
    if (!motivo) {
      b.canal = P.escolherCanal(tw.oficiais, b.canal);
      if (!b.canal) motivo = 'sem-canal';
    }
    if (motivo) {
      if (janelas.existe(i) && !b.visivelUsuario) janelas.fechar(i);
      b.situacao = motivo;
      return;
    }
    const url = HOME + b.canal;

    // 2. abrir
    if (!janelas.existe(i)) {
      janelas.abrir(i, url, { modo: b.modo, visivel: false });
      b.abertoEm = t;
      b.navegouEm = t;
      b.pagina = null;
      b.ganho = null;
      b.situacao = 'abrindo';
      return;
    }
    const fresca = !!b.pagina && t - b.paginaEm <= P.PAGINA_VELHA_MS;

    // 3. janela do usuário: só o baú
    if (b.visivelUsuario) {
      if (fresca && b.pagina.bau && t - b.cmdEm.bau >= CMD_BAU_MS) enviar(i, 'bau');
      b.situacao = 'janela-aberta';
      return;
    }

    // 4. canal certo (raid, navegação)
    if (P.canalDaUrl(janelas.url(i)) !== b.canal) {
      if (t - b.navegouEm >= ESPERA_NAVEGAR_MS) {
        janelas.navegar(i, url);
        b.navegouEm = t;
        b.pagina = null;
      }
      b.situacao = 'abrindo';
      return;
    }

    // 5. página respondendo
    if (!fresca) {
      const ultimaAcao = Math.max(b.abertoEm, b.navegouEm, b.recarregouEm);
      if (t - ultimaAcao >= ESPERA_PAGINA_MS && t - b.recarregouEm >= ESPERA_RECARGA_MS) {
        janelas.recarregar(i);
        b.recarregouEm = t;
      }
      b.situacao = 'abrindo';
      return;
    }
    const pg = b.pagina;

    // 6. player
    if (pg.portao && t - b.cmdEm.portao >= CMD_PORTAO_MS) enviar(i, 'portao');
    else if (pg.pausado && t - b.cmdEm.play >= CMD_PLAY_MS) enviar(i, 'play');
    if (pg.bau && t - b.cmdEm.bau >= CMD_BAU_MS) {
      enviar(i, 'bau');
      b.bauEm = t;
    }
    if (pg.rodando) {
      b.rodandoEm = t;
    } else if (!pg.portao && b.rodandoEm && t - b.rodandoEm >= VIDEO_PARADO_MS && t - b.recarregouEm >= ESPERA_RECARGA_MS) {
      janelas.recarregar(i);
      b.recarregouEm = t;
    }

    // 7. vigia de ganho (D12)
    // O vigia de ganho só conta com a página logada (T1): tela de login não é ganho de pontos.
    const logadoOk = pg.logado && !pg.deslogado;
    const saldo = P.parsePontos(pg.saldoTexto);
    const g = P.avaliarGanho(b.ganho, { rodando: pg.rodando && logadoOk, saldoMinimo: logadoOk && saldo ? saldo.minimo : null, bauEm: b.bauEm }, t);
    b.ganho = g.estado;
    if (g.semGanho && b.modo === 'oculta') {
      b.modo = 'fora-da-tela';
      janelas.fechar(i);
      b.ganho = null;
      b.situacao = 'abrindo';
      return;
    }
    b.semGanho = g.semGanho && b.modo === 'fora-da-tela';

    // 8. trava e resgate
    if (pg.deslogado || !pg.logado) {
      b.situacao = 'sem-login-pagina';
      return;
    }
    const trava = P.travaSeguranca({ vinculado: tw.vinculado, loginJogo: tw.login, loginTwitch: b.loginTwitch });
    if (!trava.ok) {
      b.situacao = trava.motivo;
      return;
    }
    if (pg.canal !== b.canal) {
      b.situacao = 'abrindo';
      return;
    }
    if (b.pendente) {
      b.situacao = 'resgatando';
      return;
    }
    if (t - b.ultimoResgateEm < P.INTERVALO_RESGATE_MS) {
      b.situacao = b.semGanho ? 'sem-ganho' : 'assistindo';
      return;
    }
    const bonus = tw.bonus || {};
    const esc = P.escolherResgate({
      tipos: P.TIPOS.filter((k) => p.tipos[k]),
      limiarMin: p.limiarMin,
      bonus,
      agoraServidor: t + (b.jogo.offsetMs || 0),
      saldo,
      recompensas: tw.recompensas,
      falhas: b.falhas,
      agora: t,
    });
    if (esc.espera) {
      b.situacao = SITUACAO_ESPERA[esc.espera];
      if (b.situacao === 'assistindo' && b.semGanho) b.situacao = 'sem-ganho';
      return;
    }
    seq += 1;
    b.pendente = {
      id: seq,
      tipo: esc.tipo,
      custo: esc.custo,
      bonusAntes: bonus[esc.tipo] || 0,
      em: t,
      clicado: false,
    };
    janelas.enviar(i, { tipo: 'resgatar', id: b.pendente.id, titulo: esc.titulo, custo: esc.custo });
    b.ganho = null;
    b.situacao = 'resgatando';
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

  // tempo = true traz o bônus em ms restantes (para a UI); false traz o prazo absoluto (para comparar sem o relógio).
  function montar(tempo) {
    const t = agora();
    const bays_ = bays.map((b, i) => {
      const tw = b.jogo.ativo ? b.jogo.twitch : null;
      const pg = b.pagina;
      const bonus = {};
      for (const k of P.TIPOS) {
        const bruto = tw && tw.bonus ? tw.bonus[k] : 0;
        bonus[k] = tempo ? P.restanteMs(bruto, t + (b.jogo.offsetMs || 0)) : (bruto || 0);
      }
      const saldo = pg && pg.saldoTexto ? P.parsePontos(pg.saldoTexto) : null;
      const ativas = Object.values(b.falhas).filter((f) => f && f.ate > t).map((f) => f.ate);
      return {
        auto: prefs().auto[i] === true,
        jogo: !!(b.jogo.ativo && b.jogo.twitch),
        vinculado: tw && typeof tw.vinculado === 'boolean' ? tw.vinculado : null,
        loginJogo: tw && typeof tw.login === 'string' ? tw.login : '',
        loginTwitch: b.loginTwitch,
        contaBate: P.mesmoLogin(b.loginTwitch, tw && tw.login),
        janela: janelas.existe(i) ? (b.visivelUsuario ? 'visivel' : 'oculta') : 'fechada',
        modo: b.modo,
        canal: b.canal ? nomeDoCanal(b.jogo.twitch, b.canal) : null,
        video: !pg ? '' : (pg.rodando ? 'rodando' : (pg.pausado ? 'parado' : 'carregando')),
        pontos: pg && pg.saldoTexto ? { texto: pg.saldoTexto, minimo: saldo ? saldo.minimo : null } : null,
        bonus,
        pct: tw && typeof tw.pct === 'number' ? tw.pct : 0,
        ultimo: b.ultimo,
        pausadoAte: ativas.length ? Math.max(...ativas) : 0,
        navegador: { estado: b.navegador.estado, motivo: b.navegador.motivo, em: b.navegador.em },
        situacao: erroPaginaRecente(b, t) && b.situacao === 'abrindo' ? 'erro-pagina' : b.situacao,
        diag: pg && pg.diag ? pg.diag : null,
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
        b.pendente = null;
        b.falhas = {};
      }
      b.ultimoLoginValido = nova;
      b.loginTwitch = nova;
    } else {
      b.loginTwitch = '';
    }
    avisar();
  }

  function pagina(i, fatos) {
    bays[i].pagina = fatos || null;
    bays[i].paginaEm = agora();
    avisar();
  }

  function resultado(i, { id, estado, motivo, trava, vistos, fase, clicou, pistas, pistasAntes, dialogoAntes, dialogos, cabecalho, classes }) {
    const b = bays[i];
    if (!b.pendente || b.pendente.id !== id) return;
    if (estado === 'clicado') {
      b.pendente.clicado = true;
      return;
    }
    if (estado === 'falhou') {
      const t = agora();
      b.ultimo = {
        tipo: b.pendente.tipo,
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
        cabecalho: cabecalho && typeof cabecalho === 'object' ? cabecalho : null,
        classes: Array.isArray(classes) ? classes : [],
      };
      b.falhas = P.registrarFalha(b.falhas, b.pendente.tipo, t);
      b.pendente = null;
      b.ultimoResgateEm = t;
      avisar();
    }
  }

  function entrar(i) {
    const b = bays[i];
    if (janelas.existe(i)) janelas.navegar(i, LOGIN);
    else janelas.abrir(i, LOGIN, { modo: b.modo, visivel: true });
    janelas.mostrar(i);
    b.visivelUsuario = true;
    b.loginRapidoAte = agora() + LOGIN_RAPIDO_MS;
    avisar();
  }

  function mostrar(i, on) {
    const b = bays[i];
    if (on) {
      if (!janelas.existe(i)) janelas.abrir(i, b.canal ? HOME + b.canal : HOME, { modo: b.modo, visivel: true });
      else janelas.mostrar(i);
      b.visivelUsuario = true;
    } else {
      b.visivelUsuario = false;
      if (querJanela(i)) janelas.esconder(i, b.modo);
      else janelas.fechar(i);
    }
    avisar();
  }

  function sair(i) {
    const b = bays[i];
    b.visivelUsuario = false;
    b.pendente = null;
    janelas.fechar(i);
    b.loginTwitch = '';
    b.navegador = { estado: '', motivo: '', em: 0 };
    avisar();
    return janelas.limpar(i);
  }

  function janelaEscondida(i) {
    bays[i].visivelUsuario = false;
    avisar();
  }

  function janelaFechada(i) {
    bays[i].visivelUsuario = false;
    bays[i].pagina = null;
    avisar();
  }

  // Estado do login pelo navegador. Com "ok" e login, a conta entra nesta baía e a janela recarrega.
  function navegadorEstado(i, { estado, motivo, login }) {
    const b = bays[i];
    b.navegador = { estado: estado || '', motivo: motivo || '', em: agora() };
    if (estado === 'ok' && login) {
      setLoginTwitch(i, login);
      if (janelas.existe(i)) janelas.recarregar(i);
    }
    avisar();
  }

  // Erro de carga da página aparece por um minuto; a recarga normal (passo) continua valendo.
  function erroPaginaRecente(b, t) {
    return b.erroPaginaEm > 0 && t - b.erroPaginaEm < 60000;
  }

  function erroPagina(i) {
    bays[i].erroPaginaEm = agora();
    avisar();
  }

  function precisaLoginRapido(i) {
    return bays[i].visivelUsuario || agora() < bays[i].loginRapidoAte;
  }

  function tick() {
    for (let i = 0; i < BAYS; i += 1) {
      // Uma baía que lança não derruba as outras: ela mostra o estado de erro e o laço segue.
      try {
        passo(i);
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
};
