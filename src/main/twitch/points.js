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
const TRAVAS_PAGINA = ['sem-dedicado', 'fora-do-centro', 'cartao', 'outro-cartao', 'texto-solto', 'titulos', 'resto', 'descricao', 'custo',
  'redeem-centro', 'redeem-detalhe', 'redeem-lista', 'redeem-nenhum', 'redeem-varios', 'redeem-velho', 'redeem-oculto', 'redeem-texto', 'redeem-atributo'];
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

// Prazo do bônus já passou no relógio do servidor. Prazo ausente, inválido ou relógio inválido não conta como passado.
function bonusAcabou(ate, agoraServidor) {
  return Number.isInteger(ate) && ate >= 0 && Number.isFinite(agoraServidor) && ate <= agoraServidor;
}

// Só resgata com o vínculo confirmado pelo jogo e com a mesma conta na janela da Twitch.
function travaSeguranca({ vinculado, loginJogo, loginTwitch }) {
  if (vinculado !== true) return { ok: false, motivo: 'nao-vinculado' };
  if (!loginValido(loginJogo)) return { ok: false, motivo: 'sem-login-jogo' };
  if (!loginValido(loginTwitch)) return { ok: false, motivo: 'sem-login' };
  if (!mesmoLogin(loginJogo, loginTwitch)) return { ok: false, motivo: 'conta-diferente' };
  return { ok: true };
}

function escolherResgate({ tipos, bonus, agoraServidor, saldo, recompensas, falhas, agora, travados, leituraOk }) {
  if (!Array.isArray(tipos) || !tipos.length) return { espera: 'sem-tipos' };
  // Sem leitura válida do bônus e do relógio, nada é resgatado: o zero de antes não conta como prazo passado.
  if (leituraOk !== true) return { espera: 'sem-leitura' };
  const bon = bonus && typeof bonus === 'object' ? bonus : {};
  const precisa = tipos.filter((t) => bonusAcabou(bon[t], agoraServidor));
  if (!precisa.length) return { espera: 'em-dia' };
  // Tipo com clique sem confirmação não resgata de novo (trava contra gasto duplo).
  const travadosLista = Array.isArray(travados) ? travados : [];
  const semTrava = precisa.filter((t) => !travadosLista.includes(t));
  if (!semTrava.length) return { espera: 'sem-confirmacao' };
  const livres = semTrava.filter((t) => !(falhas && falhas[t] && falhas[t].ate > agora));
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

// Botões do centro no sem-botao: até 24, atributos curtos e booleanos estritos. Total com teto.
const BOTOES_CENTRO_MAX_LIMPO = 24;

function limparBotoesCentro(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, BOTOES_CENTRO_MAX_LIMPO).map((b) => {
    const o = b && typeof b === 'object' ? b : {};
    return {
      dts: textoCurto(o.dts),
      alvo: textoCurto(o.alvo),
      aria: textoCurto(o.aria),
      tab: o.tab === true,
      custo: o.custo === true,
      desab: o.desab === true,
    };
  });
}

// Card clicado no resgate por custo: dts, alvo, aria curtos e custo/desab booleanos estritos. Ausente ou inválido vira null.
function limparCardClicado(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    dts: textoCurto(raw.dts),
    alvo: textoCurto(raw.alvo),
    aria: textoCurto(raw.aria),
    custo: raw.custo === true,
    desab: raw.desab === true,
  };
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

// Percurso do resgate (diagnóstico): lista branca. Strings por textoCurto, booleanos estritos, contagens por contagemLimpa.
// Caminho em lista fechada, trava em TRAVAS_PAGINA ou 'ok'. Ausente ou inválido vira null. Nunca texto da página.
const CAMINHOS_PAGINA = ['titulo', 'custo', ''];
const BLOQUEIOS_PAGINA = ['dedicado', 'titulo-visivel', ''];
const CANDIDATOS_PERCURSO_MAX = 3;
const ANCESTRAIS_PERCURSO_MAX = 3;
const TRAVAS_OU_OK = [...TRAVAS_PAGINA, 'ok'];

function travaOuNull(v) {
  return TRAVAS_OU_OK.includes(v) ? v : null;
}

// Objeto de verdade: array não conta.
function objetoOuNull(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function nivelPercurso(raw) {
  const o = objetoOuNull(raw);
  if (!o) return null;
  return {
    no: textoCurto(o.no),
    botoes: contagemLimpa(o.botoes),
    titulo: o.titulo === true,
    resumo: o.resumo === true,
    dialogo: o.dialogo === true,
  };
}

function limparCandidato(raw) {
  const o = objetoOuNull(raw);
  if (!o) return null;
  return {
    dts: textoCurto(o.dts),
    alvo: textoCurto(o.alvo),
    aria: textoCurto(o.aria),
    no: textoCurto(o.no),
    anc: Array.isArray(o.anc) ? o.anc.slice(0, ANCESTRAIS_PERCURSO_MAX).map(nivelPercurso).filter(Boolean) : [],
    novo: o.novo === true,
    desab: o.desab === true,
    trava: travaOuNull(o.trava),
  };
}

function limparPercurso(raw) {
  const o = objetoOuNull(raw);
  if (!o) return null;
  const clique = objetoOuNull(o.clique);
  const rejeitado = objetoOuNull(o.rejeitado);
  const lista = objetoOuNull(o.lista);
  const pos = objetoOuNull(o.pos);
  const folhas = objetoOuNull(o.folhas);
  const escopo = objetoOuNull(o.escopo);
  const out = {
    caminho: CAMINHOS_PAGINA.includes(o.caminho) ? o.caminho : '',
    bloqueio: BLOQUEIOS_PAGINA.includes(o.bloqueio) ? o.bloqueio : '',
    clique: clique
      ? { tag: textoCurto(clique.tag), role: textoCurto(clique.role), emBotao: clique.emBotao === true }
      : null,
    rejeitado: rejeitado
      ? {
        tag: textoCurto(rejeitado.tag),
        role: textoCurto(rejeitado.role),
        emBotao: rejeitado.emBotao === true,
        custo: rejeitado.custo === true,
        visivel: rejeitado.visivel === true,
      }
      : null,
    lista: lista ? { cards: contagemLimpa(lista.cards), comCusto: contagemLimpa(lista.comCusto) } : null,
    pos: pos
      ? {
        centro: pos.centro === true,
        titulo: pos.titulo === true,
        cardPresente: pos.cardPresente === true,
        filtros: pos.filtros === true,
        novos: contagemLimpa(pos.novos),
      }
      : null,
    folhas: folhas
      ? {
        total: contagemLimpa(folhas.total),
        titulos: contagemLimpa(folhas.titulos),
        custos: contagemLimpa(folhas.custos),
        resto: contagemLimpa(folhas.resto),
        saldo: folhas.saldo === true,
      }
      : null,
    escopo: escopo ? { no: textoCurto(escopo.no), botoes: contagemLimpa(escopo.botoes), trava: travaOuNull(escopo.trava) } : null,
    candidatos: Array.isArray(o.candidatos) ? o.candidatos.slice(0, CANDIDATOS_PERCURSO_MAX).map(limparCandidato).filter(Boolean) : [],
    foraDoCentro: contagemLimpa(o.foraDoCentro),
  };
  if (objetoOuNull(o.redeem)) out.redeem = limparRedeem(o.redeem);
  return out;
}

// Redeem por texto (diagnóstico): booleanos estritos, contagens por contagemLimpa, trava por travaOuNull.
const REDEEM_BOOL = ['centro', 'detalhe', 'lista', 'unico', 'novo', 'visivel', 'texto', 'atributo'];
const REDEEM_BOTAO_BOOL = ['palavraRedeem', 'palavraResgatar', 'numeroInicio', 'numeroFim', 'desab', 'temDts', 'temAlvo', 'temAria'];
const REDEEM_BOTAO_NUM = ['numerosQtd', 'palavras', 'letras', 'tamanho', 'folhas'];
const REDEEM_DESC_BOOL = ['digito', 'pontaDigito', 'falaCusto'];
const REDEEM_DESC_NUM = ['n', 'tamanho', 'palavras'];
const VIAS_PAGINA = ['texto', 'dedicado'];

function limparRedeem(raw) {
  const o = objetoOuNull(raw);
  if (!o) return null;
  const bt = objetoOuNull(o.botao) || {};
  const ds = objetoOuNull(o.desc) || {};
  const out = { trava: travaOuNull(o.trava), comCusto: contagemLimpa(o.comCusto), botao: {}, desc: {} };
  for (const k of REDEEM_BOOL) out[k] = o[k] === true;
  for (const k of REDEEM_BOTAO_BOOL) out.botao[k] = bt[k] === true;
  for (const k of REDEEM_BOTAO_NUM) out.botao[k] = contagemLimpa(bt[k]);
  for (const k of REDEEM_DESC_BOOL) out.desc[k] = ds[k] === true;
  for (const k of REDEEM_DESC_NUM) out.desc[k] = contagemLimpa(ds[k]);
  return out;
}

// Estado depois do clique no Redeem por texto: só booleanos e contagens.
function limparPosClique(raw) {
  const o = objetoOuNull(raw);
  if (!o) return null;
  const fo = objetoOuNull(o.folhas);
  return {
    centro: o.centro === true,
    botao: o.botao === true,
    desab: o.desab === true,
    titulo: o.titulo === true,
    novos: contagemLimpa(o.novos),
    folhas: fo
      ? {
        total: contagemLimpa(fo.total),
        titulos: contagemLimpa(fo.titulos),
        custos: contagemLimpa(fo.custos),
        resto: contagemLimpa(fo.resto),
        saldo: fo.saldo === true,
      }
      : null,
  };
}

function limparResultado(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id;
  if (!Number.isInteger(id) || id < 1 || id > 1e9) return null;
  if (raw.estado === 'clicado') {
    const via = VIAS_PAGINA.includes(raw.via) ? raw.via : '';
    if (!via) return { id, estado: 'clicado', motivo: '' };
    return { id, estado: 'clicado', motivo: '', via, redeem: limparRedeem(raw.redeem), posClique: limparPosClique(raw.posClique) };
  }
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
    botoesCentro: limparBotoesCentro(raw.botoesCentro),
    totalBotoesCentro: contagemLimpa(raw.totalBotoesCentro),
    cabecalho: limparCabecalho(raw.cabecalho),
    classes: limparPistas(raw.classes).slice(0, 8),
    cardClicado: limparCardClicado(raw.cardClicado),
    percurso: limparPercurso(raw.percurso),
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
  bonusAcabou,
  estadoPendente,
  registrarFalha,
  registrarSucesso,
  avaliarGanho,
  limparFatos,
  limparResultado,
  limparPercurso,
  limparRedeem,
  limparPosClique,
};
