'use strict';

// Lógica pura do bônus por pontos do canal. Sem electron e sem plataforma no nome:
// a Kick pode reaproveitar parse, trava, escolha, pendência e falhas.

const TIPOS = ['xp', 'captura', 'shiny'];
const PRAZO_CONFIRMACAO_MS = 180000;
const ESPERA_FALHA_MS = [120000, 300000];
const PAUSA_FALHAS_MS = 3600000;
const MAX_FALHAS = 3;
const INTERVALO_RESGATE_MS = 20000;
const JANELA_GANHO_MS = 1500000;
const PAGINA_VELHA_MS = 15000;
const MOTIVOS_PAGINA = ['sem-resumo', 'sem-centro', 'sem-recompensa', 'recompensa-ambigua', 'sem-botao', 'indisponivel', 'pede-texto', 'tempo', 'ocupado', 'outro'];
// Travas de quem não deixou clicar no Redeem (lista fechada). Qualquer outro valor vira ''.
const TRAVAS_PAGINA = ['sem-dedicado', 'fora-do-centro', 'cartao', 'outro-cartao', 'texto-solto', 'titulos', 'resto', 'descricao', 'custo'];
const VISTOS_MAX = 8;
const VISTOS_TAMANHO = 45;
const LOGIN_RE = /^[A-Za-z0-9_]{1,25}$/;

function loginValido(value) {
  return typeof value === 'string' && LOGIN_RE.test(value.trim());
}

// Saldo da página: "450", "1.234", "12 345", "1,2 mil", "15K". Abreviado vale pelo limite inferior.
function parsePontos(texto) {
  if (typeof texto !== 'string') return null;
  const s = texto.replace(/[  ]/g, ' ').trim();
  const m = /^(\d+(?:[.,]\d+)?|\d{1,3}(?:[., ]\d{3})+)\s*(mil|mi|k|m)?$/i.exec(s);
  if (!m) return null;
  const sufixo = (m[2] || '').toLowerCase();
  if (!sufixo) {
    if (!/^\d+$/.test(m[1]) && !/^\d{1,3}([., ]\d{3})+$/.test(m[1])) return null;
    const valor = Number(m[1].replace(/[., ]/g, ''));
    if (!Number.isSafeInteger(valor)) return null;
    return { valor, minimo: valor, exato: true };
  }
  if (!/^\d+(?:[.,]\d+)?$/.test(m[1])) return null;
  const mantissa = Number(m[1].replace(',', '.'));
  const fator = sufixo === 'k' || sufixo === 'mil' ? 1e3 : 1e6;
  const meio = mantissa < 10 ? 0.05 : 0.5;
  const minimo = Math.floor(Math.round((mantissa - meio) * fator * 1e6) / 1e6);
  return {
    valor: Math.round(mantissa * fator),
    minimo: Math.max(0, minimo),
    exato: false,
  };
}

function mesmoLogin(a, b) {
  if (!loginValido(a) || !loginValido(b)) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function canalElegivel(o) {
  return !!o && o.aoVivo === true && o.ativo === true && loginValido(o.login);
}

function espectadoresDe(o) {
  return Number.isFinite(o.espectadores) ? o.espectadores : 0;
}

// Fica com o canal atual enquanto ele estiver elegível. Senão, o de mais espectadores; empate por login.
function escolherCanal(oficiais, atual) {
  const lista = Array.isArray(oficiais) ? oficiais.filter(canalElegivel) : [];
  const cur = typeof atual === 'string' ? atual.trim().toLowerCase() : '';
  if (cur && lista.some((o) => o.login.trim().toLowerCase() === cur)) return cur;
  lista.sort((a, b) => {
    const diff = espectadoresDe(b) - espectadoresDe(a);
    if (diff !== 0) return diff;
    const la = a.login.trim().toLowerCase();
    const lb = b.login.trim().toLowerCase();
    if (la < lb) return -1;
    if (la > lb) return 1;
    return 0;
  });
  return lista.length ? lista[0].login.trim().toLowerCase() : '';
}

function canalDaUrl(url) {
  let u;
  try { u = new URL(String(url || '')); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  const host = u.hostname.toLowerCase();
  if (host !== 'twitch.tv' && host !== 'www.twitch.tv') return '';
  const login = (u.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
  return loginValido(login) ? login : '';
}

function restanteMs(ate, agoraServidor) {
  if (!Number.isInteger(ate) || !Number.isFinite(agoraServidor)) return 0;
  return Math.max(0, ate - agoraServidor);
}

// Só resgata com o vínculo confirmado pelo jogo e com a mesma conta na janela da Twitch.
function travaSeguranca({ vinculado, loginJogo, loginTwitch }) {
  if (vinculado !== true) return { ok: false, motivo: 'nao-vinculado' };
  if (!loginValido(loginJogo)) return { ok: false, motivo: 'sem-login-jogo' };
  if (!loginValido(loginTwitch)) return { ok: false, motivo: 'sem-login' };
  if (!mesmoLogin(loginJogo, loginTwitch)) return { ok: false, motivo: 'conta-diferente' };
  return { ok: true };
}

function escolherResgate({ tipos, limiarMin, bonus, agoraServidor, saldo, recompensas, falhas, agora }) {
  if (!Array.isArray(tipos) || !tipos.length) return { espera: 'sem-tipos' };
  const limite = limiarMin * 60000;
  const bon = bonus && typeof bonus === 'object' ? bonus : {};
  const precisa = tipos.filter((t) => restanteMs(bon[t], agoraServidor) < limite);
  if (!precisa.length) return { espera: 'em-dia' };
  const livres = precisa.filter((t) => !(falhas && falhas[t] && falhas[t].ate > agora));
  if (!livres.length) return { espera: 'pausado' };
  const lista = Array.isArray(recompensas) ? recompensas : [];
  const candidatos = [];
  for (const t of livres) {
    const r = lista.find((item) => item && item.tipo === t && typeof item.titulo === 'string' && item.titulo && item.custo > 0);
    if (r) candidatos.push({ tipo: t, titulo: r.titulo, custo: r.custo, restante: restanteMs(bon[t], agoraServidor) });
  }
  if (!candidatos.length) return { espera: 'sem-recompensa' };
  if (!saldo) return { espera: 'sem-saldo-lido' };
  candidatos.sort((a, b) => (a.restante - b.restante) || (TIPOS.indexOf(a.tipo) - TIPOS.indexOf(b.tipo)));
  const pronto = candidatos.find((c) => saldo.minimo >= c.custo);
  if (!pronto) return { espera: 'saldo' };
  return { tipo: pronto.tipo, titulo: pronto.titulo, custo: pronto.custo };
}

function estadoPendente(p, bonus, agora) {
  const atual = bonus && typeof bonus === 'object' ? (bonus[p.tipo] || 0) : 0;
  if (atual > p.bonusAntes) return 'confirmado';
  if (agora - p.em >= PRAZO_CONFIRMACAO_MS) return 'expirado';
  return 'aguardando';
}

function registrarFalha(falhas, tipo, agora) {
  const anterior = falhas && falhas[tipo];
  const n = ((anterior && anterior.n) || 0) + 1;
  const ate = agora + (n >= MAX_FALHAS ? PAUSA_FALHAS_MS : ESPERA_FALHA_MS[n - 1]);
  return { ...(falhas || {}), [tipo]: { n, ate } };
}

function registrarSucesso(falhas, tipo) {
  const next = { ...(falhas || {}) };
  delete next[tipo];
  return next;
}

// Vigia de ganho (D12): a base zera quando o saldo sobe ou quando o baú é clicado.
function avaliarGanho(estado, { rodando, saldoMinimo, bauEm }, agora) {
  if (!rodando) return { estado: null, semGanho: false };
  const bau = bauEm || 0;
  const lerSaldo = saldoMinimo == null ? null : saldoMinimo;
  let e = estado;
  if (!e) {
    e = { desde: agora, saldo: lerSaldo, bauEm: bau };
  } else {
    const subiu = lerSaldo != null && e.saldo != null && lerSaldo > e.saldo;
    if (subiu || bau > e.bauEm) {
      e = { desde: agora, saldo: lerSaldo, bauEm: bau };
    } else if (e.saldo == null && lerSaldo != null) {
      e = { ...e, saldo: lerSaldo };
    }
  }
  const semGanho = agora - e.desde >= JANELA_GANHO_MS;
  return { estado: e, semGanho };
}

// Diagnóstico do painel: só estas chaves, só número ou booleano. Texto livre não passa.
const DIAG_BOOL = ['resumo', 'botaoPontos', 'saldoLido'];
const DIAG_NUM = ['botoesNoResumo', 'saldoSeletor', 'saldoTamanho', 'centroSeletor'];
const BOTOES_RESUMO_MAX = 4;
const FASES_PAGINA = ['abrir', 'buscar', 'confirmar'];
const PISTAS_MAX = 8;

// Texto curto de diagnóstico: sem controle, dígito vira '#', até 40 caracteres. Não-string vira ''.
function textoCurto(v) {
  return (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\d/g, '#').trim().slice(0, 40);
}

function limparBotoesResumo(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, BOTOES_RESUMO_MAX).map((b) => {
    const o = b && typeof b === 'object' ? b : {};
    return { dts: textoCurto(o.dts), alvo: textoCurto(o.alvo), aria: textoCurto(o.aria) };
  });
}

function limparDiag(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const k of DIAG_BOOL) out[k] = raw[k] === true;
  for (const k of DIAG_NUM) out[k] = typeof raw[k] === 'number' && Number.isFinite(raw[k]) ? raw[k] : -1;
  out.botoesResumo = limparBotoesResumo(raw.botoesResumo);
  return out;
}

function limparFatos(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const flag = (v) => v === true;
  const saldoTexto = typeof raw.saldoTexto === 'string'
    ? raw.saldoTexto.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24)
    : '';
  const canal = typeof raw.canal === 'string' && loginValido(raw.canal)
    ? raw.canal.trim().toLowerCase()
    : '';
  return {
    canal,
    logado: flag(raw.logado),
    deslogado: flag(raw.deslogado),
    portao: flag(raw.portao),
    pausado: flag(raw.pausado),
    rodando: flag(raw.rodando),
    bau: flag(raw.bau),
    saldoTexto,
    diag: limparDiag(raw.diag),
  };
}

// Títulos vistos no centro: texto puro, controle removido, até 8 itens de 45 caracteres.
function limparVistos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => typeof t === 'string')
    .map((t) => t.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, VISTOS_TAMANHO))
    .filter(Boolean)
    .slice(0, VISTOS_MAX);
}

// Pistas do DOM no sem-centro: mesma regra de limparVistos, com dígito virando '#'.
function limparPistas(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const p of raw) {
    if (typeof p !== 'string') continue;
    const t = textoCurto(p).slice(0, 40);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= PISTAS_MAX) break;
  }
  return out;
}

// Diálogos do sem-centro: até 2 diálogos, 6 itens e 8 dts. Strings passam por textoCurto; números finitos com limite.
const DIALOGOS_MAX = 2;
const ITENS_DIALOGO_MAX = 6;
const DTS_DIALOGO_MAX = 8;
const CONTAGEM_MAX = 999;

function contagemLimpa(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(0, Math.floor(v)), CONTAGEM_MAX) : 0;
}

function limparDialogos(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, DIALOGOS_MAX).map((d) => {
    const o = d && typeof d === 'object' ? d : {};
    const itens = Array.isArray(o.itens)
      ? o.itens.slice(0, ITENS_DIALOGO_MAX).map((it) => {
        const i = it && typeof it === 'object' ? it : {};
        return { dts: textoCurto(i.dts), alvo: textoCurto(i.alvo), aria: textoCurto(i.aria), tab: i.tab === true };
      })
      : [];
    const dts = Array.isArray(o.dts)
      ? [...new Set(o.dts.slice(0, 64).map(textoCurto).filter(Boolean))].slice(0, DTS_DIALOGO_MAX)
      : [];
    return {
      botoes: contagemLimpa(o.botoes),
      abas: contagemLimpa(o.abas),
      itens,
      dts,
      titulo: o.titulo === true,
      campoTexto: o.campoTexto === true,
      antes: typeof o.antes === 'boolean' ? o.antes : null,
    };
  });
}

// Cabeçalho do centro: achado estrito, até 4 níveis, nomes curtos e contagens com teto. Booleanos só se forem true.
const CADEIA_MAX = 4;

function limparCabecalho(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw;
  const cadeia = Array.isArray(o.cadeia)
    ? o.cadeia.slice(0, CADEIA_MAX).map((n) => {
      const x = n && typeof n === 'object' ? n : {};
      return {
        no: textoCurto(x.no),
        botoes: contagemLimpa(x.botoes),
        titulo: x.titulo === true,
        resumo: x.resumo === true,
        dialogo: x.dialogo === true,
      };
    })
    : [];
  return { achado: o.achado === true, cadeia };
}

function limparResultado(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id;
  if (!Number.isInteger(id) || id < 1 || id > 1e9) return null;
  if (raw.estado === 'clicado') return { id, estado: 'clicado', motivo: '' };
  if (raw.estado !== 'falhou') return null;
  const motivo = MOTIVOS_PAGINA.includes(raw.motivo) ? raw.motivo : 'outro';
  const fase = FASES_PAGINA.includes(raw.fase) ? raw.fase : '';
  const trava = TRAVAS_PAGINA.includes(raw.trava) ? raw.trava : '';
  return {
    id,
    estado: 'falhou',
    motivo,
    trava,
    vistos: limparVistos(raw.vistos),
    fase,
    clicou: raw.clicou === true,
    pistas: limparPistas(raw.pistas),
    pistasAntes: Array.isArray(raw.pistasAntes) ? limparPistas(raw.pistasAntes) : null,
    dialogoAntes: raw.dialogoAntes === true,
    dialogos: limparDialogos(raw.dialogos),
    cabecalho: limparCabecalho(raw.cabecalho),
    classes: limparPistas(raw.classes).slice(0, 8),
  };
}

module.exports = {
  TIPOS,
  PRAZO_CONFIRMACAO_MS,
  ESPERA_FALHA_MS,
  PAUSA_FALHAS_MS,
  MAX_FALHAS,
  INTERVALO_RESGATE_MS,
  JANELA_GANHO_MS,
  PAGINA_VELHA_MS,
  MOTIVOS_PAGINA,
  TRAVAS_PAGINA,
  loginValido,
  parsePontos,
  mesmoLogin,
  canalElegivel,
  escolherCanal,
  canalDaUrl,
  restanteMs,
  travaSeguranca,
  escolherResgate,
  estadoPendente,
  registrarFalha,
  registrarSucesso,
  avaliarGanho,
  limparFatos,
  limparResultado,
};
