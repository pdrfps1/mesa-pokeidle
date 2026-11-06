var MESA_TWITCH_DOM = (function () {
  // Atributos primeiro (data-a-target, data-test-selector), depois classe, por último aria-label em en e pt.
  // Nenhum seletor foi conferido com login: o motivo de cada falha aparece no painel.
  // user-menu-toggle também aparece deslogado: logado só vale sem login-button nem signup-button.
  // O resumo de pontos (community-points-summary) existe deslogado, com saldo 0: não prova login.
  const SELETORES = {
    logado: ['[data-a-target="user-menu-toggle"]'],
    deslogado: ['[data-a-target="login-button"]', '[data-a-target="signup-button"]'],
    portao: [
      '[data-a-target="content-classification-gate-overlay-start-watching-button"]',
      '[data-a-target="player-overlay-mature-accept"]',
    ],
    play: ['[data-a-target="player-play-pause-button"]'],
    video: ['video'],
    resumo: ['[data-test-selector="community-points-summary"]'],
    botaoPontos: ['[data-test-selector="community-points-summary"] button'],
    saldo: ['[data-test-selector="copo-balance-string"]', '[data-test-selector="balance-string"]'],
    bau: [
      '[data-test-selector="community-points-summary"] .claimable-bonus__icon',
      'button[aria-label="Claim Bonus"]',
      'button[aria-label="Resgatar bônus"]',
      'button[aria-label="Resgatar Bônus"]',
    ],
    centro: ['#channel-points-reward-center-body', '[data-test-selector="reward-center"]', '.reward-center-body'],
    // Cabeçalho do centro com id específico. Só conta se estiver dentro de um role="dialog" (centroPorCabecalho).
    cabecalhoCentro: ['#channel-points-reward-center-header'],
    resgatar: ['[data-test-selector="RequestRewardButton"]'],
    // Campo de texto procurado dentro do centro achado.
    campoTexto: ['textarea'],
  };

  function primeiro(root, lista) {
    for (const sel of lista) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch { /* seletor que o DOM não aceita: pula para o próximo */ }
    }
    return null;
  }

  function limpa(s) {
    return String(s == null ? '' : s).replace(/[\s ]+/g, ' ').trim();
  }

  function textoDe(el) {
    return limpa(el ? el.textContent : '');
  }

  // NFKC junta acento decomposto (NFD) e zero-width some antes de comparar.
  function normal(s) {
    const semLarguraZero = String(s == null ? '' : s).normalize('NFKC').replace(/[​-‍﻿]/g, '');
    return limpa(semLarguraZero).toLowerCase();
  }

  function digitos(s) {
    return String(s == null ? '' : s).replace(/\D/g, '');
  }

  function desabilitado(el) {
    if (!el) return false;
    return el.disabled === true || el.getAttribute('aria-disabled') === 'true';
  }

  function clicar(el) {
    if (!el || typeof el.click !== 'function') return false;
    el.click();
    return true;
  }

  function botaoDe(el) {
    return el.closest('button,[role="button"]') || el;
  }

  function acharBau(doc) {
    const el = primeiro(doc, SELETORES.bau);
    return el ? botaoDe(el) : null;
  }

  function canalDe(loc) {
    const login = String((loc && loc.pathname) || '').split('/').filter(Boolean)[0] || '';
    const lower = login.toLowerCase();
    return /^[a-z0-9_]{1,25}$/.test(lower) ? lower : '';
  }

  function primeiroTexto(doc, lista) {
    for (const sel of lista) {
      let el = null;
      try { el = doc.querySelector(sel); } catch { el = null; }
      const texto = textoDe(el);
      if (texto) return texto;
    }
    return '';
  }

  // Diagnóstico: só diz se o seletor casou. Seletor que o DOM não aceita conta como não casou.
  function casa(doc, sel) {
    try { return !!doc.querySelector(sel); } catch { return false; }
  }

  // Texto curto de atributo para o diagnóstico: sem controle, dígito vira '#', até 40 caracteres.
  function curto(v) {
    return String(v || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\d/g, '#').trim().slice(0, 40);
  }

  function atributo(el, nome) {
    try {
      return el && typeof el.getAttribute === 'function' ? el.getAttribute(nome) : null;
    } catch { return null; }
  }

  // Botões do resumo, com os três atributos curtos de cada um. Nunca lê textContent.
  function botoesDoResumo(resumo) {
    if (!resumo) return [];
    return Array.from(resumo.querySelectorAll('button')).slice(0, 4).map((b) => ({
      dts: curto(atributo(b, 'data-test-selector')),
      alvo: curto(atributo(b, 'data-a-target')),
      aria: curto(atributo(b, 'aria-label')),
    }));
  }

  // Pistas do centro para o diagnóstico de sem-centro: 'tag#id[dts][role]' sem repetição, até 8.
  const PISTAS_SELETORES = [
    '[role="dialog"]',
    '[data-test-selector*="reward" i]',
    '[data-test-selector*="points" i]',
    '[id*="reward" i]',
    '[class*="reward-center"]',
    '[class*="community-points"]',
  ];

  function pistaDe(el) {
    let s = curto(String(el.tagName || '').toLowerCase());
    const id = curto(el.id);
    if (id) s += '#' + id;
    const dts = curto(atributo(el, 'data-test-selector'));
    if (dts) s += '[' + dts + ']';
    const role = curto(atributo(el, 'role'));
    if (role) s += '[' + role + ']';
    return s;
  }

  function pistasCentro(doc) {
    const out = [];
    for (const sel of PISTAS_SELETORES) {
      let itens = [];
      try { itens = Array.from(doc.querySelectorAll(sel)); } catch { itens = []; }
      for (const el of itens) {
        const p = pistaDe(el);
        if (p && !out.includes(p)) out.push(p);
        if (out.length >= 8) return out;
      }
    }
    return out;
  }

  // Diagnóstico do sem-centro: até 2 [role="dialog"], com botões, abas, itens, dts e booleanos. Nunca textContent.
  // antesSet: diálogos que já existiam antes do clique no resumo. Sem ele, antes fica false.
  function dialogosDiag(doc, titulo, antesSet) {
    let lista = [];
    try { lista = Array.from(doc.querySelectorAll('[role="dialog"]')).slice(0, 2); } catch { lista = []; }
    const alvo = normal(titulo);
    return lista.map((dialogo) => {
      const out = {
        botoes: 0, abas: 0, itens: [], dts: [], titulo: false, campoTexto: false,
        antes: antesSet ? antesSet.has(dialogo) : false,
      };
      let botoes = [];
      let abas = [];
      try { botoes = Array.from(dialogo.querySelectorAll('button,[role="button"]')); } catch { botoes = []; }
      try { abas = Array.from(dialogo.querySelectorAll('[role="tab"]')); } catch { abas = []; }
      out.botoes = botoes.length;
      out.abas = abas.length;
      out.itens = [
        ...botoes.map((b) => ({ el: b, tab: false })),
        ...abas.map((a) => ({ el: a, tab: true })),
      ].map(({ el, tab }) => ({
        dts: curto(atributo(el, 'data-test-selector')),
        alvo: curto(atributo(el, 'data-a-target')),
        aria: curto(atributo(el, 'aria-label')),
        tab,
      })).filter((it) => it.tab || it.dts || it.alvo || it.aria).slice(0, 6);
      try {
        const dts = [];
        for (const d of Array.from(dialogo.querySelectorAll('*'))) {
          const v = curto(atributo(d, 'data-test-selector'));
          if (v && !dts.includes(v)) dts.push(v);
          if (dts.length >= 8) break;
        }
        out.dts = dts;
      } catch { out.dts = []; }
      try { out.titulo = !!alvo && normal(textoDe(dialogo)).includes(alvo); } catch { out.titulo = false; }
      try { out.campoTexto = !!primeiro(dialogo, SELETORES.campoTexto); } catch { out.campoTexto = false; }
      return out;
    });
  }

  // Diagnóstico: seguro devolve o valor de fallback se o DOM lançar.
  function seguro(fn, falha) {
    try { return fn(); } catch { return falha; }
  }

  const CLASSE_VALIDA = /^[A-Za-z0-9_-]+$/;

  // Um nível da cadeia do cabeçalho: nome curto e booleanos/contagens. Nunca textContent.
  function nivelDiag(anc, alvo) {
    return {
      no: seguro(() => {
        const classe = String(atributo(anc, 'class') || '').split(/\s+/).find((c) => CLASSE_VALIDA.test(c)) || '';
        const id = curto(atributo(anc, 'id'));
        const dts = curto(atributo(anc, 'data-test-selector'));
        const role = curto(atributo(anc, 'role'));
        let no = curto(String(anc.tagName || '').toLowerCase());
        if (id) no += '#' + id;
        if (classe) no += '.' + curto(classe);
        if (dts) no += '[' + dts + ']';
        if (role) no += '[' + role + ']';
        return curto(no);
      }, ''),
      botoes: seguro(() => Math.min(999, anc.querySelectorAll('button,[role="button"]').length), 0),
      titulo: seguro(() => !!alvo && normal(textoDe(anc)).includes(alvo), false),
      resumo: seguro(() => !!anc.querySelector('[data-test-selector="community-points-summary"]'), false),
      dialogo: seguro(() => !!anc.closest('[role="dialog"]'), false),
    };
  }

  // Cabeçalho do centro (só diagnóstico, fora de SELETORES): até 4 ancestrais a partir do pai.
  function cabecalhoDiag(doc, titulo) {
    return seguro(() => {
      const h = doc.querySelector('[id*="reward-center-header" i]');
      if (!h) return { achado: false, cadeia: [] };
      const alvo = normal(titulo);
      const cadeia = [];
      for (let anc = h.parentElement; anc && cadeia.length < 4; anc = anc.parentElement) {
        cadeia.push(nivelDiag(anc, alvo));
      }
      return { achado: true, cadeia };
    }, { achado: false, cadeia: [] });
  }

  // Classes dos contêineres de reward-center (rc:) e community-points (cp:), até 4 de cada. Só classes válidas.
  const CLASSES_PISTA = [['rc:', '[class*="reward-center"]'], ['cp:', '[class*="community-points"]']];

  function classesPista(doc) {
    const out = [];
    for (const [prefixo, sel] of CLASSES_PISTA) {
      const itens = seguro(() => Array.from(doc.querySelectorAll(sel)).slice(0, 4), []);
      for (const el of itens) {
        const s = seguro(() => {
          const tokens = String(atributo(el, 'class') || '').split(/\s+/).filter((c) => CLASSE_VALIDA.test(c));
          const base = prefixo + String(el.tagName || '').toLowerCase();
          return curto(tokens.length ? base + '.' + tokens.join('.') : base);
        }, '');
        if (s && !out.includes(s)) out.push(s);
      }
    }
    return out;
  }

  // Mesma regra de parsePontos (main/twitch/points.js). O preload não importa o módulo, então a regra fica repetida aqui.
  const SALDO_RE = /^(\d+(?:[.,]\d+)?|\d{1,3}(?:[., ]\d{3})+)\s*(mil|mi|k|m)?$/i;
  function saldoLidoDe(texto) {
    const s = String(texto || '').replace(/[  ]/g, ' ').trim();
    const m = SALDO_RE.exec(s);
    if (!m) return false;
    if (!m[2]) {
      if (!/^\d+$/.test(m[1]) && !/^\d{1,3}([., ]\d{3})+$/.test(m[1])) return false;
      return Number.isSafeInteger(Number(m[1].replace(/[., ]/g, '')));
    }
    return /^\d+(?:[.,]\d+)?$/.test(m[1]);
  }

  // Lê os fatos da página. "rodando" exige que o tempo do vídeo tenha andado desde a leitura anterior.
  function lerFatos(doc, loc, anterior) {
    const video = primeiro(doc, SELETORES.video);
    const play = primeiro(doc, SELETORES.play);
    const tempoAnt = anterior && typeof anterior.tempo === 'number' ? anterior.tempo : -1;
    const deslogado = !!primeiro(doc, SELETORES.deslogado);
    const logado = !!primeiro(doc, SELETORES.logado) && !deslogado;
    const rodando = !!video && !video.paused && !video.ended && video.readyState >= 2 && video.currentTime > tempoAnt;
    const pausado = (!!play && play.getAttribute('data-a-player-state') === 'paused') || (!!video && video.paused === true);
    let saldoTexto = '';
    if (logado) {
      saldoTexto = primeiroTexto(doc, SELETORES.saldo) || textoDe(primeiro(doc, SELETORES.botaoPontos));
      saldoTexto = saldoTexto.slice(0, 24);
    }
    const resumo = primeiro(doc, SELETORES.resumo);
    // Booleanos, contagens e, no resumo, até 4 atributos curtos por botão. Nenhum texto da página sai daqui.
    const diag = {
      resumo: !!resumo,
      botaoPontos: !!primeiro(doc, SELETORES.botaoPontos),
      botoesNoResumo: resumo ? resumo.querySelectorAll('button').length : 0,
      botoesResumo: botoesDoResumo(resumo),
      saldoSeletor: SELETORES.saldo.findIndex((sel) => casa(doc, sel)),
      saldoTamanho: saldoTexto.length,
      saldoLido: saldoLidoDe(saldoTexto),
      centroSeletor: SELETORES.centro.findIndex((sel) => casa(doc, sel)),
    };
    return {
      fatos: {
        canal: canalDe(loc),
        logado,
        deslogado,
        portao: !!primeiro(doc, SELETORES.portao),
        pausado,
        rodando,
        bau: !!acharBau(doc),
        saldoTexto,
        diag,
      },
      anterior: { tempo: video && typeof video.currentTime === 'number' ? video.currentTime : -1 },
    };
  }

  // Candidatos aninhados: fica o mais interno (o que não contém outro candidato da lista).
  function maisInternos(lista) {
    return lista.filter((c) => !lista.some((outro) => outro !== c && dentroDe(outro, c)));
  }

  // Igualdade normalizada primeiro, no texto ou no title (A-4). Sem igualdade, contenção com candidatos aninhados
  // reduzidos ao mais interno. Mais de um candidato disjunto: ambigua, e nada é clicado.
  function buscarRecompensa(doc, titulo, centroDado) {
    const alvo = normal(titulo);
    if (!alvo) return { achado: null, ambigua: false };
    // Centro passado como null (sumiu): não procura em nada. Sem terceiro argumento, cai no centro
    // específico e, na falta dele, no documento inteiro. Produção sempre passa o centro; o fallback é só da API exportada.
    if (centroDado === null) return { achado: null, ambigua: false };
    const raiz = centroDado || primeiro(doc, SELETORES.centro) || doc;
    const botoes = Array.from(raiz.querySelectorAll('button,[role="button"]'));
    const titulosExatos = Array.from(raiz.querySelectorAll('[title]'))
      .filter((el) => normal(el.getAttribute('title')) === alvo)
      .map(botaoDe)
      .filter((el) => dentroDe(el, raiz));
    const iguais = maisInternos([...new Set([...botoes.filter((el) => normal(textoDe(el)) === alvo), ...titulosExatos])]);
    if (iguais.length) return { achado: iguais.length === 1 ? iguais[0] : null, ambigua: iguais.length > 1 };
    const parciais = maisInternos(botoes.filter((el) => normal(textoDe(el)).includes(alvo)));
    if (parciais.length === 1) return { achado: parciais[0], ambigua: false };
    return { achado: null, ambigua: parciais.length > 1 };
  }

  function acharRecompensa(doc, titulo, centroDado) {
    return buscarRecompensa(doc, titulo, centroDado).achado;
  }

  // Números do texto, com separador de milhar ("1.000" vira 1000).
  function numerosDe(texto) {
    const out = [];
    for (const m of String(texto).matchAll(/\d{1,3}(?:[.,   ]\d{3})+|\d+/g)) {
      out.push(Number(m[0].replace(/\D/g, '')));
    }
    return out;
  }

  // Cara de cartão: botão, role=button, li ou article.
  function cartaLike(e) {
    const tag = String(e.tagName || e.tag || '').toLowerCase();
    return tag === 'button' || tag === 'li' || tag === 'article' || e.getAttribute('role') === 'button';
  }

  function dentroDe(el, raiz) {
    for (let x = el; x; x = x.parentElement) if (x === raiz) return true;
    return false;
  }

  // Cartão mais próximo em volta do botão de confirmação. Invólucro que só traz o botão não conta.
  function cartaoDoBotao(centro, dedicado) {
    const proprio = textoDe(dedicado);
    for (let x = dedicado.parentElement; x && x !== centro; x = x.parentElement) {
      if (cartaLike(x) && textoDe(x) !== proprio) return x;
    }
    return null;
  }

  // Outra recompensa no centro: cartão com número no texto que não contém o botão de confirmação.
  function temOutroCartao(centro, dedicado) {
    return Array.from(centro.querySelectorAll('*'))
      .some((e) => cartaLike(e) && /\d/.test(textoDe(e)) && !dentroDe(dedicado, e));
  }

  // Elementos sem filhos e com texto, fora do botão de confirmação.
  function folhasDe(escopo, dedicado) {
    return Array.from(escopo.querySelectorAll('*'))
      .filter((e) => !Array.from(e.children || []).length && textoDe(e) && !dentroDe(e, dedicado));
  }

  const SO_NUMERO = /^[\d.,\s]+$/;
  const NAVEGACAO = /^(voltar|back|fechar|close|cancelar|cancel)$/;
  const FALA_DE_CUSTO = /pontos?|points?|pts|custa|custo|costs?/;

  // Descrição: frase de quatro palavras ou mais, sem cara de custo.
  function eDescricao(texto) {
    if (texto.split(' ').length < 4 || /^\d|\d$/.test(texto)) return false;
    return !(/\d/.test(texto) && FALA_DE_CUSTO.test(texto));
  }

  function mesmoCusto(texto, custo) {
    const numeros = numerosDe(texto);
    return SO_NUMERO.test(texto) && numeros.length === 1 && numeros[0] === Number(custo);
  }

  // Bloco com letras e sem o título: o número ali é o custo de outra recompensa.
  function custoDeOutroBloco(el, alvo) {
    const bloco = normal(textoDe(el.parentElement));
    return /\p{L}/u.test(bloco) && !bloco.includes(alvo);
  }

  function tamanhoDe(el) {
    return textoDe(el).replace(/\s/g, '').length;
  }

  // Texto do escopo fora das folhas não passa pela conferência: escopo assim não é aceito.
  function temTextoSolto(escopo, dedicado, folhas) {
    const lido = folhas.reduce((total, el) => total + tamanhoDe(el), tamanhoDe(dedicado));
    return tamanhoDe(escopo) > lido;
  }

  // O escopo mostra uma recompensa só: o título pedido uma vez, inteiro, no máximo um custo, o pedido, e no máximo uma descrição.
  function escopoConfere(escopo, dedicado, alvo, custo) {
    const texto = (el) => normal(textoDe(el));
    const eTitulo = (el) => texto(el) === alvo
      || (texto(el).startsWith(alvo) && mesmoCusto(texto(el).slice(alvo.length), custo));
    const folhas = folhasDe(escopo, dedicado);
    if (temTextoSolto(escopo, dedicado, folhas)) return false;
    const titulos = folhas.filter(eTitulo);
    if (titulos.length !== 1) return false;
    const outras = folhas.filter((el) => !eTitulo(el) && !NAVEGACAO.test(texto(el)));
    const custos = outras.filter((el) => SO_NUMERO.test(texto(el)));
    const resto = outras.filter((el) => !SO_NUMERO.test(texto(el)));
    const total = custos.length + (texto(titulos[0]) === alvo ? 0 : 1);
    if (total > 1 || resto.length > 1) return false;
    if (resto.length && !eDescricao(texto(resto[0]))) return false;
    if (custos.some((el) => !mesmoCusto(texto(el), custo) || custoDeOutroBloco(el, alvo))) return false;
    return total === 1 || numerosDe(textoDe(dedicado)).includes(Number(custo));
  }

  // Só o seletor dedicado, dentro do centro. Se ele está num cartão, o cartão decide. Se não, o centro
  // inteiro tem de mostrar uma recompensa só (O-3). Na dúvida, nada é clicado.
  function acharBotaoResgatar(doc, custo, titulo, centroDado) {
    const centro = centroDado || primeiro(doc, SELETORES.centro);
    const dedicado = primeiro(doc, SELETORES.resgatar);
    const alvo = normal(titulo);
    if (!dedicado || !centro || !alvo || dedicado === centro || !dentroDe(dedicado, centro)) return null;
    const cartao = cartaoDoBotao(centro, dedicado);
    if (cartao) return escopoConfere(cartao, dedicado, alvo, custo) ? dedicado : null;
    if (temOutroCartao(centro, dedicado)) return null;
    return escopoConfere(centro, dedicado, alvo, custo) ? dedicado : null;
  }

  function esperar(fn, ms, passo) {
    const intervalo = passo || 250;
    return new Promise((resolve) => {
      const inicio = Date.now();
      const tentar = () => {
        const achado = fn();
        if (achado) {
          resolve(achado);
          return;
        }
        if (Date.now() - inicio >= ms) {
          resolve(null);
          return;
        }
        setTimeout(tentar, intervalo);
      };
      tentar();
    });
  }

  function pausa(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
  }

  // Centro pelo cabeçalho com id específico: sobe a partir do pai do cabeçalho (nunca o próprio), até 50 níveis,
  // e devolve o primeiro ancestral com role="dialog". Sem diálogo ancestral, nada.
  function centroPorCabecalho(doc) {
    return seguro(() => {
      const h = primeiro(doc, SELETORES.cabecalhoCentro);
      if (!h) return null;
      let anc = h.parentElement;
      for (let n = 0; anc && n < 50; n += 1, anc = anc.parentElement) {
        if (atributo(anc, 'role') === 'dialog') return anc;
      }
      return null;
    }, null);
  }

  // Centro: pelos seletores específicos ou pelo diálogo que contém o cabeçalho com id específico.
  // Diálogo genérico continua não sendo centro: só entra o diálogo que contém esse cabeçalho.
  function centroAberto(doc) {
    return primeiro(doc, SELETORES.centro) || centroPorCabecalho(doc);
  }

  // Títulos dos cartões do centro, só texto, até 8 itens de 45 caracteres. Diagnóstico do painel.
  function titulosVistos(centro) {
    if (!centro) return [];
    const textos = Array.from(centro.querySelectorAll('button,[role="button"]'))
      .map((el) => limpa(textoDe(el)).slice(0, 45))
      .filter(Boolean);
    return Array.from(new Set(textos)).slice(0, 8);
  }

  async function fecharCentro(doc, deps) {
    if (!centroAberto(doc)) return;
    const botao = primeiro(doc, SELETORES.botaoPontos);
    if (!botao) return;
    clicar(botao);
    await deps.pausa(300);
  }

  // Fluxo do resgate: abre o centro, acha a recompensa pelo título, clica e confirma no botão de custo.
  async function resgatar(doc, pedido, deps) {
    const resumo = primeiro(doc, SELETORES.botaoPontos);
    if (!resumo) return { estado: 'falhou', motivo: 'sem-resumo' };
    const achaCentro = () => centroAberto(doc);
    // Diagnóstico: havia diálogo antes do clique no resumo?
    let dialogoAntes = false;
    try { dialogoAntes = !!doc.querySelector('[role="dialog"]'); } catch { dialogoAntes = false; }
    // Diagnóstico: pistas e diálogos que já existiam antes do clique no resumo (só DOM, nunca texto).
    let pistasAntes = [];
    try { pistasAntes = pistasCentro(doc); } catch { pistasAntes = []; }
    let dialogosAntes = new Set();
    try { dialogosAntes = new Set(doc.querySelectorAll('[role="dialog"]')); } catch { dialogosAntes = new Set(); }
    let clicou = false;
    if (!achaCentro()) clicou = clicar(resumo);
    // Diagnóstico do sem-centro: fase em que faltou o centro, se o clique no resumo foi feito, pistas, cabeçalho, classes e diálogos do DOM.
    const semCentro = (fase) => ({
      estado: 'falhou',
      motivo: 'sem-centro',
      fase,
      clicou,
      pistas: pistasCentro(doc),
      pistasAntes,
      dialogoAntes,
      dialogos: dialogosDiag(doc, pedido.titulo, dialogosAntes),
      cabecalho: cabecalhoDiag(doc, pedido.titulo),
      classes: classesPista(doc),
    });
    const centro = await deps.esperar(achaCentro, 6000);
    if (!centro) return semCentro('abrir');
    let busca = { achado: null, ambigua: false };
    await deps.esperar(() => {
      busca = buscarRecompensa(doc, pedido.titulo, achaCentro());
      return busca.achado;
    }, 6000);
    if (!achaCentro()) return semCentro('buscar');
    const item = busca.achado;
    if (!item) {
      const vistos = titulosVistos(achaCentro());
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: busca.ambigua ? 'recompensa-ambigua' : 'sem-recompensa', vistos };
    }
    if (desabilitado(item)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'indisponivel' };
    }
    if (clicar(item)) clicou = true;
    await deps.pausa(600);
    const aberto = achaCentro();
    if (!aberto) return semCentro('confirmar');
    if (primeiro(aberto, SELETORES.campoTexto)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'pede-texto' };
    }
    const botao = await deps.esperar(() => acharBotaoResgatar(doc, pedido.custo, pedido.titulo, achaCentro()), 5000);
    if (!botao) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'sem-botao' };
    }
    if (desabilitado(botao)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'indisponivel' };
    }
    clicar(botao);
    await deps.pausa(1500);
    await fecharCentro(doc, deps);
    return { estado: 'clicado', motivo: '' };
  }

  return {
    SELETORES,
    primeiro,
    textoDe,
    normal,
    digitos,
    desabilitado,
    clicar,
    botaoDe,
    acharBau,
    canalDe,
    lerFatos,
    acharRecompensa,
    acharBotaoResgatar,
    esperar,
    pausa,
    resgatar,
    centroAberto,
    dialogosDiag,
    cabecalhoDiag,
    classesPista,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MESA_TWITCH_DOM;
