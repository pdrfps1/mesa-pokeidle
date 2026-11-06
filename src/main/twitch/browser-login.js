'use strict';

// Login da Twitch pelo navegador do sistema, com um perfil por baía.
// Os cookies da Twitch só são lidos em importarSessaoTwitch e só são gravados na partição da baía.
// Nenhum valor de cookie vai para log, IPC, snapshot ou arquivo da Mesa.
const { findSystemBrowser } = require('../browser/find-browser');
const { cdpRpc } = require('../browser/cdp');
const {
  loginProfileDir,
  clearLoginProfile,
  isLoginBrowserRunning,
  listDevToolsPages,
  openProfileBrowser,
  readViaHeadless,
  applyCookies,
  createImportWatcher,
} = require('../browser/profile-login');

const TWITCH_LOGIN_URL = 'https://www.twitch.tv/login';
const TWITCH_COOKIE_URLS = [
  'https://twitch.tv/',
  'https://www.twitch.tv/',
  'https://m.twitch.tv/',
  'https://passport.twitch.tv/',
  'https://id.twitch.tv/',
  'https://gql.twitch.tv/',
];
const LOGIN_RE = /^[A-Za-z0-9_]{1,25}$/;
const MAX_COOKIES = 200;

function isTwitchCookie(cookie) {
  if (!cookie || typeof cookie !== 'object' || typeof cookie.domain !== 'string') return false;
  const dominio = cookie.domain.replace(/^\./, '').toLowerCase();
  return dominio === 'twitch.tv' || dominio.endsWith('.twitch.tv');
}

function filtrarCookiesTwitch(cookies) {
  if (!Array.isArray(cookies)) return [];
  return cookies
    .filter((c) => isTwitchCookie(c) && typeof c.name === 'string' && typeof c.value === 'string')
    .slice(0, MAX_COOKIES);
}

// Login público da conta: vale só com o cookie de autenticação presente e o login válido.
// O valor do cookie de autenticação não é lido, só o nome.
function loginDosCookies(cookies) {
  if (!Array.isArray(cookies)) return '';
  const temToken = cookies.some((c) => c && c.name === 'auth-token');
  if (!temToken) return '';
  const cookieLogin = cookies.find((c) => c && c.name === 'login');
  const valor = cookieLogin && typeof cookieLogin.value === 'string' ? cookieLogin.value.trim() : '';
  return LOGIN_RE.test(valor) ? valor.toLowerCase() : '';
}

// Leitor do perfil da Twitch: pede os cookies da aba de página; sem aba, pede ao navegador.
async function lerSessaoTwitch({ base, browserWsUrl }) {
  let cookies = null;
  if (base) {
    const abas = await listDevToolsPages(base);
    const aba = abas.find((t) => t && t.type === 'page' && t.webSocketDebuggerUrl);
    if (aba) {
      const res = await cdpRpc(aba.webSocketDebuggerUrl, 'Network.getCookies', { urls: TWITCH_COOKIE_URLS });
      cookies = res && Array.isArray(res.cookies) ? res.cookies : null;
    }
  }
  if (!cookies) {
    const res = await cdpRpc(browserWsUrl, 'Storage.getCookies');
    cookies = res && Array.isArray(res.cookies) ? res.cookies : [];
  }
  const filtrados = filtrarCookiesTwitch(cookies);
  const login = loginDosCookies(filtrados);
  // Cookies lidos, mas sem login válido: semSessao, para não se confundir com falha de leitura.
  return login ? { cookies: filtrados, login } : { semSessao: true };
}

// vigente() diz se o pedido ainda vale (a baía não saiu nem foi trocada). Sem ele, a cópia não acontece.
async function importarSessaoTwitch({
  browserExe, userData, catalog, session, lerPerfil = readViaHeadless, vigente = () => true,
  naFila = (tarefa) => tarefa(),
}, i) {
  if (!browserExe) return { ok: false, reason: 'no-browser' };
  if (!vigente()) return { ok: false, reason: 'cancelado' };
  const raiz = typeof userData === 'function' ? userData() : userData;
  const part = catalog.twitchPartitions[i];
  const perfil = loginProfileDir(raiz, part);
  if (isLoginBrowserRunning(perfil)) return { ok: false, reason: 'browser-open' };
  const sessao = await lerPerfil(browserExe, perfil, lerSessaoTwitch).catch((err) => {
    // Só o nome do erro: nunca cookie ou valor de sessão.
    console.warn('[twitch-login] leitura do perfil falhou:', err && err.name);
    return null;
  });
  if (!vigente()) return { ok: false, reason: 'cancelado' };
  // Leitura que falhou (null ou erro) é diferente de perfil sem login (semSessao → pending).
  if (!sessao) return { ok: false, reason: 'leitura-falhou' };
  if (sessao.semSessao) return { ok: false, reason: 'pending' };
  const ses = session.fromPartition(part);
  return naFila(async () => {
    if (!vigente()) return { ok: false, reason: 'cancelado' };
    // A partição é só da Twitch: limpa os cookies antes, para não sobrar conta de outra sessão.
    await ses.clearStorageData({ storages: ['cookies'] });
    if (!vigente()) return { ok: false, reason: 'cancelado' };
    const completo = await applyCookies(ses, sessao.cookies, vigente);
    if (!completo || !vigente()) {
      // Sair no meio da cópia: nenhum cookie desta sessão pode ficar na partição.
      await ses.clearStorageData({ storages: ['cookies'] }).catch(() => {});
      return { ok: false, reason: 'cancelado' };
    }
    return { ok: true, login: sessao.login };
  });
}

function createTwitchBrowserLogin(deps) {
  const { catalog, session, userData, aoEstado } = deps;
  const achaNavegador = deps.findBrowser || findSystemBrowser;
  const apagarPerfil = deps.apagarPerfil || clearLoginProfile;
  const raiz = () => (typeof userData === 'function' ? userData() : userData);
  const vigia = createImportWatcher();
  // Uma escrita de cookies por baía: a nova espera a cancelada terminar a limpeza.
  const filas = new Map();
  function naFila(i, tarefa) {
    const atual = (filas.get(i) || Promise.resolve()).then(tarefa, tarefa);
    filas.set(i, atual);
    return atual;
  }
  // Geração por baía: sair da baía invalida qualquer importação em andamento.
  const geracoes = new Map();
  const geracaoDe = (i) => geracoes.get(i) || 0;
  const invalidar = (i) => geracoes.set(i, geracaoDe(i) + 1);

  function informar(i, dados) {
    if (typeof aoEstado === 'function') aoEstado(i, dados);
  }

  function perfilDe(i) {
    return loginProfileDir(raiz(), catalog.twitchPartitions[i]);
  }

  // Erro inesperado na importação vira falha genérica na UI; o detalhe não sai daqui.
  async function importarSeguro(i, g) {
    try {
      return await importarSessaoTwitch({
        browserExe: achaNavegador(),
        userData,
        catalog,
        session,
        lerPerfil: deps.lerPerfil,
        vigente: () => geracaoDe(i) === g,
        naFila: (tarefa) => naFila(i, tarefa),
      }, i);
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }

  function resultadoFinal(i, res, g) {
    if (geracaoDe(i) !== g || res.reason === 'cancelado') return;
    if (res.ok) informar(i, { estado: 'ok', login: res.login });
    else informar(i, { estado: 'falhou', motivo: res.reason || 'failed' });
  }

  function abrir(i) {
    const exe = achaNavegador();
    if (!exe) {
      informar(i, { estado: 'falhou', motivo: 'no-browser' });
      return { ok: false, error: 'no-browser' };
    }
    const saida = concluirSaida(i);
    if (!saida.ok) {
      informar(i, { estado: 'falhou', motivo: saida.reason });
      return { ok: false, error: saida.reason };
    }
    const aberto = openProfileBrowser({ browserExe: exe, profileDir: perfilDe(i), url: TWITCH_LOGIN_URL });
    if (!aberto.ok) {
      informar(i, { estado: 'falhou', motivo: 'failed' });
      return aberto;
    }
    informar(i, { estado: 'aberto' });
    const g = geracaoDe(i);
    vigia.start(
      i,
      perfilDe(i),
      () => {
        informar(i, { estado: 'importando' });
        return importarSeguro(i, g);
      },
      (res) => resultadoFinal(i, res, g),
    );
    return { ok: true };
  }

  async function importar(i) {
    const saida = concluirSaida(i);
    if (!saida.ok) {
      informar(i, { estado: 'falhou', motivo: saida.reason });
      return saida;
    }
    const g = geracaoDe(i);
    informar(i, { estado: 'importando' });
    const res = await importarSeguro(i, g);
    resultadoFinal(i, res, g);
    return res;
  }

  // Cancela a importação em andamento e o vigia da baía, sem mexer em cookies nem no perfil.
  function cancelar(i) {
    invalidar(i);
    vigia.stop(i);
  }

  // Sair com o navegador aberto deixa o perfil no disco. A saída fica pendente: o perfil é apagado antes de qualquer novo login.
  const saidasPendentes = new Set();

  function apagarPerfilDaBaia(i) {
    if (isLoginBrowserRunning(perfilDe(i))) return { ok: false, reason: 'perfil-em-uso' };
    try {
      apagarPerfil(raiz(), catalog.twitchPartitions[i]);
    } catch (erro) {
      // Arquivo travado por outro processo: o perfil fica e o painel explica.
      if (erro && (erro.code === 'EBUSY' || erro.code === 'EPERM')) return { ok: false, reason: 'perfil-em-uso' };
      throw erro;
    }
    saidasPendentes.delete(i);
    return { ok: true };
  }

  function concluirSaida(i) {
    if (!saidasPendentes.has(i)) return { ok: true };
    try {
      return apagarPerfilDaBaia(i);
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }

  // Sair invalida a importação em andamento e o vigia da baía. Não apaga perfil com navegador aberto.
  function sair(i) {
    invalidar(i);
    vigia.stop(i);
    saidasPendentes.add(i);
    return apagarPerfilDaBaia(i);
  }

  function pararTudo() {
    vigia.stopAll();
  }

  return { abrir, importar, sair, cancelar, pararTudo };
}

// Sair da baía: limpa a conta na Mesa e, num finally, o perfil de login. Falha no perfil vira estado da baía.
async function sairDaBaia(controller, login, i) {
  login.cancelar(i);
  try {
    await controller.sair(i);
  } finally {
    const r = login.sair(i);
    if (!r.ok) controller.navegadorEstado(i, { estado: 'falhou', motivo: r.reason });
  }
}

module.exports = {
  TWITCH_COOKIE_URLS,
  isTwitchCookie,
  filtrarCookiesTwitch,
  loginDosCookies,
  lerSessaoTwitch,
  importarSessaoTwitch,
  createTwitchBrowserLogin,
  sairDaBaia,
};
