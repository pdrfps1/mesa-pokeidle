var MESA_TWITCH_DOM = (function () {
  // Atributos primeiro (data-a-target, data-test-selector), depois classe, por último aria-label em en e pt.
  // Redeem sem seletor dedicado: achado pelo texto (acharRedeemPorTexto), a cada poll da confirmação, só com centro de cabeçalho,
  // detalhe com folha nova do título e sem lista visível. Um único clique. Diagnóstico só com booleanos e contagens.
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

  // Item achado pelo título só vale se for botão real (button ou role=button).
  function eBotaoReal(el) {
    const tag = String(el.tagName || el.tag || '').toLowerCase();
    return tag === 'button' || atributo(el, 'role') === 'button';
  }

  // Custo no texto do item, depois de tirar o título: "Bônus +15% XP 300" sem o título sobra " 300".
  function itemTemCusto(el, alvo, custo) {
    const semTitulo = normal(textoDe(el)).split(alvo).join(' ');
    return numerosDe(semTitulo).includes(Number(custo));
  }

  // Igualdade normalizada primeiro, no texto ou no title (A-4). Sem igualdade, contenção com candidatos aninhados
  // reduzidos ao mais interno. Mais de um candidato disjunto: ambigua, e nada é clicado.
  // Com custo, o item só conta se for botão real dentro do centro com o custo no texto (sem o título).
  // O primeiro candidato recusado volta em rejeitado. Sem custo, a regra é a de antes.
  function buscarRecompensa(doc, titulo, centroDado, custo) {
    const alvo = normal(titulo);
    if (!alvo) return { achado: null, ambigua: false, rejeitado: null };
    // Centro passado como null (sumiu): não procura em nada. Sem terceiro argumento, cai no centro
    // específico e, na falta dele, no documento inteiro. Produção sempre passa o centro; o fallback é só da API exportada.
    if (centroDado === null) return { achado: null, ambigua: false, rejeitado: null };
    const raiz = centroDado || primeiro(doc, SELETORES.centro) || doc;
    // Com custo, o botão de confirmação (SELETORES.resgatar) não entra como item. Sem custo, a busca é a de antes.
    const confirmacaoEl = custo === undefined ? [] : Array.from(raiz.querySelectorAll(SELETORES.resgatar[0]));
    const botoes = custo === undefined
      ? Array.from(raiz.querySelectorAll('button,[role="button"]'))
      : botoesSemConfirmacao(raiz);
    const titulosExatos = Array.from(raiz.querySelectorAll('[title]'))
      .filter((el) => normal(el.getAttribute('title')) === alvo)
      .map(botaoDe)
      .filter((el) => dentroDe(el, raiz) && !confirmacaoEl.includes(el));
    let rejeitado = null;
    const aceitos = (lista) => lista.filter((el) => {
      if (custo === undefined) return true;
      const ok = eBotaoReal(el) && itemTemCusto(el, alvo, custo);
      if (!ok && !rejeitado) rejeitado = el;
      return ok;
    });
    const iguais = maisInternos(aceitos([...new Set([...botoes.filter((el) => normal(textoDe(el)) === alvo), ...titulosExatos])]));
    if (iguais.length) return { achado: iguais.length === 1 ? iguais[0] : null, ambigua: iguais.length > 1, rejeitado };
    const parciais = maisInternos(aceitos(botoes.filter((el) => normal(textoDe(el)).includes(alvo))));
    if (parciais.length === 1) return { achado: parciais[0], ambigua: false, rejeitado };
    return { achado: null, ambigua: parciais.length > 1, rejeitado };
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

  // Classificador das folhas do escopo, sem o botão de confirmação: folhas, as com título, as de custo e o resto.
  function classificarFolhas(escopo, dedicado, alvo, custo) {
    const texto = (el) => normal(textoDe(el));
    const eTitulo = (el) => texto(el) === alvo
      || (texto(el).startsWith(alvo) && mesmoCusto(texto(el).slice(alvo.length), custo));
    const folhas = folhasDe(escopo, dedicado);
    const titulos = folhas.filter(eTitulo);
    const outras = folhas.filter((el) => !eTitulo(el) && !NAVEGACAO.test(texto(el)));
    const custos = outras.filter((el) => SO_NUMERO.test(texto(el)));
    const resto = outras.filter((el) => !SO_NUMERO.test(texto(el)));
    return { folhas, titulos, custos, resto, texto };
  }

  // Motivo de o escopo não conferir, ou '' se confere. Os motivos são TRAVAS_PAGINA (sem o '').
  // O escopo mostra uma recompensa só: o título pedido uma vez, inteiro, no máximo um custo, o pedido, e no máximo uma descrição.
  function motivoEscopo(escopo, dedicado, alvo, custo) {
    const c = classificarFolhas(escopo, dedicado, alvo, custo);
    if (temTextoSolto(escopo, dedicado, c.folhas)) return 'texto-solto';
    if (c.titulos.length !== 1) return 'titulos';
    const total = c.custos.length + (c.texto(c.titulos[0]) === alvo ? 0 : 1);
    if (total > 1) return 'custo';
    if (c.resto.length > 1) return 'resto';
    if (c.resto.length && !eDescricao(c.texto(c.resto[0]))) return 'descricao';
    if (c.custos.some((el) => !mesmoCusto(c.texto(el), custo) || custoDeOutroBloco(el, alvo))) return 'custo';
    return total === 1 || numerosDe(textoDe(dedicado)).includes(Number(custo)) ? '' : 'custo';
  }

  function escopoConfere(escopo, dedicado, alvo, custo) {
    return motivoEscopo(escopo, dedicado, alvo, custo) === '';
  }

  // Decisão do botão de confirmação dentro do centro, sem ler o seletor: lista fechada de travas (TRAVAS_PAGINA).
  // Se ele está num cartão, o cartão decide. Se não, o centro inteiro tem de mostrar uma recompensa só (O-3). Na dúvida, nada é clicado.
  function travaDoBotao(centro, dedicado, alvo, custo) {
    if (!dedicado || !centro || !alvo || dedicado === centro) return { botao: null, trava: 'sem-dedicado' };
    if (!dentroDe(dedicado, centro)) return { botao: null, trava: 'fora-do-centro' };
    const cartao = cartaoDoBotao(centro, dedicado);
    if (cartao) {
      return escopoConfere(cartao, dedicado, alvo, custo) ? { botao: dedicado, trava: '' } : { botao: null, trava: 'cartao' };
    }
    if (temOutroCartao(centro, dedicado)) return { botao: null, trava: 'outro-cartao' };
    const motivo = motivoEscopo(centro, dedicado, alvo, custo);
    return motivo ? { botao: null, trava: motivo } : { botao: dedicado, trava: '' };
  }

  // Mesma decisão de acharBotaoResgatar, com a trava de quem não deixou clicar (lista fechada, TRAVAS_PAGINA).
  // Só o seletor dedicado, dentro do centro.
  function acharBotaoResgatarComTrava(doc, custo, titulo, centroDado) {
    const centro = centroDado || primeiro(doc, SELETORES.centro);
    const dedicado = primeiro(doc, SELETORES.resgatar);
    return travaDoBotao(centro, dedicado, normal(titulo), custo);
  }

  function acharBotaoResgatar(doc, custo, titulo, centroDado) {
    return acharBotaoResgatarComTrava(doc, custo, titulo, centroDado).botao;
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

  // Botões do centro sem o botão de confirmação (SELETORES.resgatar).
  function botoesSemConfirmacao(centro) {
    const confirmacao = Array.from(centro.querySelectorAll(SELETORES.resgatar[0]));
    return Array.from(centro.querySelectorAll('button,[role="button"]')).filter((b) => !confirmacao.includes(b));
  }

  // Cards do custo: botões só com o número, igual ao custo pedido (SO_NUMERO no texto inteiro, um número só).
  // Assim "Redeem 300" num detalhe não vira card. Sem candidato aninhado. Ordem do DOM.
  // Botão de saldo sai da lista só se tiver aria-label preenchido: dado do log real, o card do custo não tem aria
  // e o botão de saldo tem. Só presença do atributo, sem ler o texto. Sem aria no saldo, vale a regra antiga.
  function cardsPorCusto(centro, custo, saldo = null) {
    if (!centro) return [];
    const alvo = Number(custo);
    const achados = botoesSemConfirmacao(centro).filter((b) => {
      const t = normal(textoDe(b));
      if (!SO_NUMERO.test(t)) return false;
      const nums = numerosDe(t);
      return nums.length === 1 && nums[0] === alvo && !(eBotaoSaldo(b, saldo) && atributoPreenchido(b, 'aria-label'));
    });
    return maisInternos(achados);
  }

  // Folhas (sem filho, com texto) do centro com o título pedido. Devolve os elementos.
  function folhasTitulo(centro, alvo) {
    if (!centro || !alvo) return [];
    return seguro(() => Array.from(centro.querySelectorAll('*'))
      .filter((f) => !Array.from(f.children || []).length && normal(textoDe(f)) === alvo), []);
  }

  // Retrato tirado antes do clique: folhas com o título, botões do centro e o card clicado. Só conjuntos e referência.
  function retratoAntes(centro, titulo, card) {
    const alvo = normal(titulo);
    return {
      titulos: new Set(folhasTitulo(centro, alvo)),
      botoes: new Set(centro ? seguro(() => Array.from(centro.querySelectorAll('button,[role="button"]')), []) : []),
      card,
    };
  }

  // Folha do título dentro de botão ou role=button do centro não é detalhe (re-render da lista).
  function dentroDeBotaoDoCentro(el, centro) {
    for (let x = el; x && x !== centro; x = x.parentElement) if (eBotaoReal(x)) return true;
    return false;
  }

  // Visível: getClientRects com algo. Elemento sem o método conta como visível (lado seguro).
  function visivelDe(el) {
    return seguro(() => el.getClientRects().length > 0, true);
  }

  // Dedicado no centro: qualquer elemento do centro com o data-test-selector do botão de confirmação.
  const DEDICADO_DTS = (SELETORES.resgatar[0].match(/data-test-selector="([^"]+)"/) || [])[1] || '';
  function temDedicadoNoCentro(centro) {
    if (!DEDICADO_DTS) return false;
    return seguro(() => Array.from(centro.querySelectorAll('*')).some((e) => atributo(e, 'data-test-selector') === DEDICADO_DTS), false);
  }

  // Filtro de recompensas visível: a lista está em uso. Filtro ausente ou com rects vazios = detalhe.
  function filtroVisivel(centro) {
    return seguro(() => Array.from(centro.querySelectorAll('button,[role="button"]'))
      .some((b) => String(atributo(b, 'data-a-target') || '').indexOf('reward-filter-') === 0 && visivelDe(b)), false);
  }

  // Guardas antes de cada clique (card ou item por título): dedicado no centro, ou folha do título visível fora de botão
  // sem filtro visível. Título oculto (sem rects) não bloqueia. Cartão (li, article) não libera: só o filtro libera.
  function guardaCard(centro, titulo) {
    if (temDedicadoNoCentro(centro)) return 'dedicado';
    const alvo = normal(titulo);
    const visivel = folhasTitulo(centro, alvo).some((f) => visivelDe(f) && !dentroDeBotaoDoCentro(f, centro));
    return visivel && !filtroVisivel(centro) ? 'titulo-visivel' : '';
  }

  // Detalhe abriu: folha do título que não estava no retrato e fica fora do card clicado, dos cards da lista e de
  // qualquer botão ou role=button do centro. Sumiço de cards, de filtros ou botões novos não conta aqui.
  // Título quebrado em filhos, com texto extra na folha ou dentro de botão no detalhe dá falso negativo seguro:
  // fecha sem Redeem, e aparece como pos.novos > 0 com pos.titulo = não.
  function detalheAbriu(centro, titulo, retrato, cards) {
    const alvo = normal(titulo);
    if (!centro || !alvo || !retrato) return false;
    const dentroDeCard = (f) => (retrato.card && dentroDe(f, retrato.card)) || (cards || []).some((c) => dentroDe(f, c));
    return folhasTitulo(centro, alvo).some((f) => !retrato.titulos.has(f) && !dentroDeCard(f) && !dentroDeBotaoDoCentro(f, centro));
  }

  const CUSTOS_VISTOS_MAX = 8;

  // Custos vistos no centro: botões que só trazem um número, sem repetição, até 8. Nunca título nem texto de card.
  function custosVistos(centro) {
    if (!centro) return [];
    const out = [];
    for (const b of botoesSemConfirmacao(centro)) {
      const t = normal(textoDe(b));
      if (!SO_NUMERO.test(t)) continue;
      const nums = numerosDe(t);
      if (nums.length !== 1) continue;
      const s = String(nums[0]);
      if (!out.includes(s)) out.push(s);
      if (out.length >= CUSTOS_VISTOS_MAX) break;
    }
    return out;
  }

  const BOTOES_CENTRO_MAX = 24;
  const CONTAGEM_CENTRO_MAX = 999;

  // Um botão em atributos curtos e booleanos: dts, alvo, aria, custo (o texto só vira booleano) e desab. Nenhum texto sai daqui.
  function botaoDiag(b, custo) {
    const alvo = Number(custo);
    return {
      dts: curto(atributo(b, 'data-test-selector')),
      alvo: curto(atributo(b, 'data-a-target')),
      aria: curto(atributo(b, 'aria-label')),
      custo: seguro(() => numerosDe(textoDe(b)).includes(alvo), false),
      desab: seguro(() => !!b.disabled || atributo(b, 'aria-disabled') === 'true', false),
    };
  }

  // Botões do centro para o diagnóstico do sem-botao: até 24, na ordem do DOM, só atributos curtos e booleanos.
  function botoesDoCentro(doc, custo) {
    try {
      const raiz = centroAberto(doc);
      if (!raiz) return [];
      return Array.from(raiz.querySelectorAll('button,[role="button"]')).slice(0, BOTOES_CENTRO_MAX).map((b) => ({
        ...botaoDiag(b, custo),
        tab: seguro(() => {
          for (let x = b; x; x = x.parentElement) {
            if (atributo(x, 'role') === 'tab') return true;
            if (x === raiz) break;
          }
          return false;
        }, false),
      }));
    } catch { return []; }
  }

  // Total de botões do centro, teto 999. Sem centro, 0.
  function contarBotoesCentro(doc) {
    return seguro(() => {
      const raiz = centroAberto(doc);
      return raiz ? Math.min(CONTAGEM_CENTRO_MAX, raiz.querySelectorAll('button,[role="button"]').length) : 0;
    }, 0);
  }

  // Diagnóstico do percurso (só nomes curtos, atributos, booleanos e contagens; nunca texto da página).
  function tagDe(el) {
    return seguro(() => curto(String(el.tagName || el.tag || '').toLowerCase()), '');
  }

  function emBotaoDe(el) {
    return seguro(() => !!el.closest('button,[role="button"]'), false);
  }

  function cliqueDiag(el) {
    return { tag: tagDe(el), role: curto(atributo(el, 'role')), emBotao: emBotaoDe(el) };
  }

  // Item achado pelo título e recusado: tag, role, se está em botão, se tem o custo e se está visível.
  function rejeitadoDiag(el, alvo, custo) {
    return {
      tag: tagDe(el),
      role: curto(atributo(el, 'role')),
      emBotao: emBotaoDe(el),
      custo: seguro(() => itemTemCusto(el, alvo, custo), false),
      visivel: visivelDe(el),
    };
  }

  // Lista do centro antes do clique: botões sem o de confirmação e quantos têm o custo no texto.
  function listaDiag(centro, custo) {
    return seguro(() => {
      if (!centro) return null;
      const botoes = botoesSemConfirmacao(centro);
      const alvo = Number(custo);
      const comCusto = botoes.filter((b) => numerosDe(normal(textoDe(b))).includes(alvo)).length;
      return { cards: Math.min(CONTAGEM_CENTRO_MAX, botoes.length), comCusto: Math.min(CONTAGEM_CENTRO_MAX, comCusto) };
    }, null);
  }

  // Antes do clique: diagnóstico do card, retrato, clique e lista. Vale para o caminho por título e o por custo.
  function prepararClique(el, caminho, centro, pedido, cards) {
    return {
      caminho,
      card: el,
      cardDiag: seguro(() => botaoDiag(el, pedido.custo), null),
      cardsLista: cards,
      retrato: seguro(() => retratoAntes(centro, pedido.titulo, el), null),
      clique: cliqueDiag(el),
      lista: listaDiag(centro, pedido.custo),
    };
  }

  // Clica e só então grava o diagnóstico pré-clique no ctx. Sem clique feito, nada entra.
  function clicarCard(ctx, el, pre) {
    const clicou = clicar(el);
    if (clicou) Object.assign(ctx, pre);
    return clicou;
  }

  // Nível da cadeia de um nó, até 3 ancestrais (nunca o próprio).
  function ancestrais(el, alvo) {
    const out = [];
    for (let x = el.parentElement; x && out.length < 3; x = x.parentElement) out.push(nivelDiag(x, alvo));
    return out;
  }

  // Botões do centro com o custo no texto, sem o card clicado. Novos primeiro, na ordem do DOM.
  function candidatosEl(centro, card, retrato, custo) {
    const alvo = Number(custo);
    const lista = Array.from(centro.querySelectorAll('button,[role="button"]'))
      .filter((b) => b !== card && numerosDe(normal(textoDe(b))).includes(alvo));
    return [...lista.filter((b) => !retrato.botoes.has(b)), ...lista.filter((b) => retrato.botoes.has(b))];
  }

  function candidatoDiag(centro, b, retrato, alvo, custo) {
    return {
      dts: curto(atributo(b, 'data-test-selector')),
      alvo: curto(atributo(b, 'data-a-target')),
      aria: curto(atributo(b, 'aria-label')),
      no: nivelDiag(b, alvo).no,
      anc: ancestrais(b, alvo),
      novo: !retrato.botoes.has(b),
      desab: desabilitado(b),
      trava: travaDoBotao(centro, b, alvo, custo).trava || 'ok',
    };
  }

  // Menor ancestral comum de duas folhas/botões.
  function ancestralComum(a, b) {
    const da = [];
    for (let x = a; x; x = x.parentElement) da.push(x);
    for (let y = b; y; y = y.parentElement) if (da.includes(y)) return y;
    return null;
  }

  // Escopo: menor ancestral comum da folha nova do título e do candidato (dentro do centro), com a trava simulada nele.
  function escopoDiag(centro, folha, cand, alvo, custo) {
    const comum = ancestralComum(folha, cand);
    const raiz = comum && dentroDe(comum, centro) ? comum : centro;
    const nivel = nivelDiag(raiz, alvo);
    return { no: nivel.no, botoes: nivel.botoes, trava: motivoEscopo(raiz, cand, alvo, custo) || 'ok' };
  }

  // Folhas do centro: total, com o título, de custo, resto e se alguma folha numérica é o saldo lido.
  function folhasDiag(centro, alvo, saldo) {
    const folhas = Array.from(centro.querySelectorAll('*')).filter((f) => !Array.from(f.children || []).length && textoDe(f));
    let titulos = 0;
    let custos = 0;
    let resto = 0;
    let saldoAchado = false;
    for (const f of folhas) {
      const t = normal(textoDe(f));
      if (t === alvo) {
        titulos += 1;
      } else if (SO_NUMERO.test(t)) {
        custos += 1;
        if (numerosDe(t).some((n) => saldo.includes(n))) saldoAchado = true;
      } else {
        resto += 1;
      }
    }
    return {
      total: Math.min(CONTAGEM_CENTRO_MAX, folhas.length),
      titulos: Math.min(CONTAGEM_CENTRO_MAX, titulos),
      custos: Math.min(CONTAGEM_CENTRO_MAX, custos),
      resto: Math.min(CONTAGEM_CENTRO_MAX, resto),
      saldo: saldoAchado,
    };
  }

  // Botões com o título ou a contagem fora do centro (diagnóstico do item fora do centro).
  function foraDoCentroDiag(doc, centro, alvo) {
    return seguro(() => Array.from(doc.querySelectorAll('button,[role="button"],[title]'))
      .filter((el) => !dentroDe(el, centro) && (normal(textoDe(el)).includes(alvo) || normal(atributo(el, 'title')).includes(alvo)))
      .length, 0);
  }

  // Diagnóstico do que mudou depois do clique: posição, folhas, escopo, candidatos e fora do centro. Só com centro aberto.
  function montarPosicao(ctx, doc, pedido, centro) {
    if (!centro || !ctx.retrato) return;
    const alvo = normal(pedido.titulo);
    const retrato = ctx.retrato;
    const cards = ctx.cardsLista || [];
    const detalhe = seguro(() => detalheAbriu(centro, pedido.titulo, retrato, cards), false);
    ctx.pos = seguro(() => {
      const botoes = Array.from(centro.querySelectorAll('button,[role="button"]'));
      return {
        centro: true,
        titulo: detalhe,
        cardPresente: !!ctx.card && dentroDe(ctx.card, centro),
        filtros: botoes.some((b) => (atributo(b, 'data-a-target') || '').indexOf('reward-filter-') === 0),
        novos: Math.min(CONTAGEM_CENTRO_MAX, botoes.filter((b) => !retrato.botoes.has(b)).length),
      };
    }, null);
    ctx.folhas = seguro(() => folhasDiag(centro, alvo, ctx.saldo || []), null);
    const novas = folhasTitulo(centro, alvo).filter((f) => !retrato.titulos.has(f));
    const cands = seguro(() => candidatosEl(centro, ctx.card, retrato, pedido.custo), []);
    ctx.candidatos = cands.slice(0, 3)
      .map((b) => seguro(() => candidatoDiag(centro, b, retrato, alvo, pedido.custo), null))
      .filter(Boolean);
    ctx.escopo = novas.length && cands.length
      ? seguro(() => escopoDiag(centro, novas[0], cands[0], alvo, pedido.custo), null)
      : null;
    ctx.foraDoCentro = foraDoCentroDiag(doc, centro, alvo);
  }

  // Percurso do resgate: só em falha com clique ou com item recusado ou custo na lista a reportar. Senão, a chave não existe.
  function percursoDe(ctx) {
    const comCusto = !!(ctx.lista && ctx.lista.comCusto > 0);
    if (!ctx.clique && !ctx.rejeitado && !comCusto && !ctx.bloqueio && !ctx.redeem) return null;
    const out = {
      caminho: ctx.caminho || '',
      bloqueio: ctx.bloqueio || '',
      clique: ctx.clique || null,
      rejeitado: ctx.rejeitado || null,
      lista: ctx.lista || null,
      pos: ctx.pos || null,
      folhas: ctx.folhas || null,
      escopo: ctx.escopo || null,
      candidatos: ctx.candidatos || [],
      foraDoCentro: ctx.foraDoCentro || 0,
    };
    if (ctx.redeem) out.redeem = ctx.redeem;
    return out;
  }

  // Trecho pós-clique do resgate, usado pelo item achado e pelo card conferido: campo de texto, Redeem com custo, clique, fechar.
  // Só aqui sai o clique no Redeem.
  // Redeem por texto (caminho sem seletor dedicado). Ordem fixa: a primeira condição que falha dá a trava.
  // Só booleanos, contagens e tamanhos saem daqui. O texto é comparado, nunca exportado.
  const REDEEM_TEXTO_RE = /^(?:redeem|resgatar) ?(\d{1,3}(?:[., ]\d{3})+|\d+)$/;
  const REDEEM_BOTAO_VAZIO = {
    palavraRedeem: false, palavraResgatar: false, numeroInicio: false, numeroFim: false, numerosQtd: 0,
    palavras: 0, letras: 0, tamanho: 0, folhas: 0, desab: false, temDts: false, temAlvo: false, temAria: false,
  };
  const REDEEM_DESC_VAZIO = { n: 0, tamanho: 0, palavras: 0, digito: false, pontaDigito: false, falaCusto: false };

  function atributoPreenchido(el, nome) {
    return !!String(atributo(el, nome) || '').trim();
  }

  function palavrasDe(t) {
    return t.split(' ').filter(Boolean).length;
  }

  // Métricas do botão de custo: booleanos e contagens.
  function redeemBotaoDiag(b) {
    return seguro(() => {
      const t = normal(textoDe(b));
      return {
        palavraRedeem: /^redeem\b/.test(t),
        palavraResgatar: /^resgatar\b/.test(t),
        numeroInicio: /^\d/.test(t),
        numeroFim: /\d$/.test(t),
        numerosQtd: Math.min(CONTAGEM_CENTRO_MAX, numerosDe(t).length),
        palavras: Math.min(CONTAGEM_CENTRO_MAX, palavrasDe(t)),
        letras: Math.min(CONTAGEM_CENTRO_MAX, (t.match(/\p{L}/gu) || []).length),
        tamanho: Math.min(CONTAGEM_CENTRO_MAX, t.length),
        folhas: Math.min(CONTAGEM_CENTRO_MAX, Array.from(b.querySelectorAll('*')).filter((x) => !Array.from(x.children || []).length).length),
        desab: desabilitado(b),
        temDts: atributoPreenchido(b, 'data-test-selector'),
        temAlvo: atributoPreenchido(b, 'data-a-target'),
        temAria: atributoPreenchido(b, 'aria-label'),
      };
    }, REDEEM_BOTAO_VAZIO);
  }

  // Descrição do detalhe: folhas que não são título, custo nem botão. Só contagens, tamanho e booleanos.
  function redeemDescDiag(centro, alvo) {
    return seguro(() => {
      const folhas = Array.from(centro.querySelectorAll('*'))
        .filter((f) => !Array.from(f.children || []).length && normal(textoDe(f)));
      const resto = folhas.filter((f) => {
        const t = normal(textoDe(f));
        return t !== alvo && !SO_NUMERO.test(t) && !dentroDeBotaoDoCentro(f, centro);
      });
      if (!resto.length) return { ...REDEEM_DESC_VAZIO };
      const t = normal(textoDe(resto[0]));
      return {
        n: Math.min(CONTAGEM_CENTRO_MAX, resto.length),
        tamanho: Math.min(CONTAGEM_CENTRO_MAX, t.length),
        palavras: Math.min(CONTAGEM_CENTRO_MAX, palavrasDe(t)),
        digito: /\d/.test(t),
        pontaDigito: /^\d|\d$/.test(t),
        falaCusto: FALA_DE_CUSTO.test(t),
      };
    }, { ...REDEEM_DESC_VAZIO });
  }

  // Saldo lido do resumo (mesma fonte de lerFatos). Número simples vira { numero, abreviado: '' }; texto abreviado
  // (ex.: 1.2K) vira { numero: null, abreviado }; ilegível = null, e nada é excluído.
  function saldoDoResumo(doc) {
    return seguro(() => {
      const texto = primeiroTexto(doc, SELETORES.saldo) || textoDe(primeiro(doc, SELETORES.botaoPontos));
      if (!saldoLidoDe(texto)) return null;
      const m = /^(\d{1,3}(?:[.,\s]\d{3})+|\d+)$/.exec(String(texto).trim());
      if (m) return { numero: Number(m[1].replace(/\D/g, '')), abreviado: '' };
      return { numero: null, abreviado: normal(texto) };
    }, null);
  }

  // Filtro de recompensas visível para a lista do Redeem. Erro ao avaliar conta como visível (fail-closed).
  function listaFiltroEstrito(centro) {
    return Array.from(centro.querySelectorAll('button,[role="button"]'))
      .some((b) => String(atributo(b, 'data-a-target') || '').indexOf('reward-filter-') === 0 && visivelDe(b));
  }

  // Botão cujo texto é só o número do saldo lido. Só este botão é excluído da lista.
  function eSaldoExato(b, saldo) {
    const t = normal(textoDe(b));
    return /^[\d.,\s]+$/.test(t) && numerosDe(t).length === 1 && numerosDe(t)[0] === saldo;
  }

  // Botão do saldo: com saldo abreviado, o texto normal tem que ser igual ao do resumo; senão, o número exato.
  // Saldo null (ilegível) não exclui nenhum botão.
  function eBotaoSaldo(b, saldo) {
    if (!saldo) return false;
    if (saldo.abreviado) return normal(textoDe(b)) === saldo.abreviado;
    return eSaldoExato(b, saldo.numero);
  }

  // Redeem por texto. Condições, na ordem: centro de cabeçalho, detalhe com folha nova, nenhuma lista visível,
  // um único botão com o custo, novo no detalhe, visível, texto Redeem/Resgatar + custo, sem atributo de dados.
  // Fail-closed: exceção ao avaliar a lista conta como lista presente; exceção no alvo conta como oculto.
  function acharRedeemPorTexto(doc, centro, pedido, retrato, cards) {
    const custo = Number(pedido.custo);
    const alvo = normal(pedido.titulo);
    const detalhe = seguro(() => !!retrato && detalheAbriu(centro, pedido.titulo, retrato, cards), false);
    const cardVisivel = seguro(() => (!!retrato && !!retrato.card && visivelDe(retrato.card))
      || (cards || []).some((c) => dentroDe(c, centro) && visivelDe(c)), true);
    const botoes = seguro(() => botoesSemConfirmacao(centro), null);
    const saldo = saldoDoResumo(doc);
    // Aqui a exclusão do saldo é mais larga que em cardsPorCusto, de propósito. Ela só tira candidatos da contagem;
    // o candidato ainda precisa casar REDEEM_TEXTO_RE, que um texto só numérico nunca casa. Com o critério de aria,
    // saldo sem aria igual ao custo daria redeem-varios (teste "saldo 300 no botão do saldo, igual ao custo").
    // Um card visível continua detectado por cardVisivel e listaFiltroEstrito.
    const comCusto = seguro(() => (botoes || []).filter((b) => numerosDe(normal(textoDe(b))).includes(custo) && !eBotaoSaldo(b, saldo)), null);
    const botaoLista = seguro(() => (botoes || []).some((b) => !(comCusto || []).includes(b)
      && visivelDe(b)
      && /\d/.test(normal(textoDe(b)))
      && !eBotaoSaldo(b, saldo)), true);
    const lista = !botoes || !comCusto || seguro(() => listaFiltroEstrito(centro), true) || cardVisivel || botaoLista;
    const centroOk = seguro(() => centroPorCabecalho(doc) === centro, false);
    const lista0 = comCusto || [];
    let trava = '';
    let botao = null;
    let bDiag = REDEEM_BOTAO_VAZIO;
    let novo = false;
    let visivel = false;
    let texto = false;
    let atrib = false;
    if (!centroOk) trava = 'redeem-centro';
    else if (!detalhe) trava = 'redeem-detalhe';
    else if (lista) trava = 'redeem-lista';
    else if (lista0.length === 0) trava = 'redeem-nenhum';
    else if (lista0.length > 1) trava = 'redeem-varios';
    else {
      const b = lista0[0];
      bDiag = redeemBotaoDiag(b);
      novo = !(retrato && retrato.botoes.has(b));
      visivel = seguro(() => b.getClientRects().length > 0, false);
      const m = REDEEM_TEXTO_RE.exec(normal(textoDe(b)));
      texto = !!m && Number(m[1].replace(/\D/g, '')) === custo;
      atrib = atributoPreenchido(b, 'data-test-selector') || atributoPreenchido(b, 'data-a-target');
      if (!novo) trava = 'redeem-velho';
      else if (!visivel) trava = 'redeem-oculto';
      else if (!texto) trava = 'redeem-texto';
      else if (atrib) trava = 'redeem-atributo';
      else botao = b;
    }
    return {
      botao,
      trava,
      diag: {
        trava,
        centro: centroOk,
        detalhe,
        lista,
        unico: lista0.length === 1,
        novo,
        visivel,
        texto,
        atributo: atrib,
        comCusto: Math.min(CONTAGEM_CENTRO_MAX, lista0.length),
        botao: bDiag,
        desc: redeemDescDiag(centro, alvo),
      },
    };
  }

  // Estado depois do clique no Redeem por texto: centro, botão, desab, detalhe, novos e folhas. Só contagens e booleanos.
  function posCliqueDiag(ctx, centro, pedido, botao) {
    return seguro(() => {
      if (!centro) return { centro: false, botao: false, desab: false, titulo: false, novos: 0, folhas: null };
      const retrato = ctx.retrato;
      const botoes = Array.from(centro.querySelectorAll('button,[role="button"]'));
      return {
        centro: true,
        botao: !!botao && dentroDe(botao, centro),
        desab: !!botao && desabilitado(botao),
        titulo: seguro(() => detalheAbriu(centro, pedido.titulo, retrato, ctx.cardsLista || []), false),
        novos: Math.min(CONTAGEM_CENTRO_MAX, botoes.filter((b) => !(retrato && retrato.botoes.has(b))).length),
        folhas: folhasDiag(centro, normal(pedido.titulo), ctx.saldo || []),
      };
    }, null);
  }

  // Trecho pós-clique do resgate, usado pelo item achado e pelo card conferido: campo de texto, Redeem com custo, clique, fechar.
  // Só aqui sai o clique no Redeem. Sem seletor dedicado, o Redeem é achado pelo texto a cada poll (acharRedeemPorTexto),
  // e o campo de texto é verificado a cada poll desse caminho. O clique é um só.
  async function confirmarResgate(doc, pedido, deps, achaCentro, semCentro, ctx) {
    const aberto = achaCentro();
    if (!aberto) return semCentro('confirmar');
    if (primeiro(aberto, SELETORES.campoTexto)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'pede-texto' };
    }
    let ultimo = { botao: null, trava: 'sem-dedicado' };
    const achado = await deps.esperar(() => {
      const centro = achaCentro();
      ultimo = acharBotaoResgatarComTrava(doc, pedido.custo, pedido.titulo, centro);
      if (ultimo.botao) return { botao: ultimo.botao, texto: false };
      if (ultimo.trava !== 'sem-dedicado' || !centro || primeiro(doc, SELETORES.resgatar)) return null;
      if (primeiro(centro, SELETORES.campoTexto)) return { pede: true };
      const t = acharRedeemPorTexto(doc, centro, pedido, ctx.retrato, ctx.cardsLista);
      ctx.redeem = t.diag;
      ultimo = { botao: t.botao, trava: t.trava };
      return t.botao ? { botao: t.botao, texto: true } : null;
    }, 5000);
    if (achado && achado.pede) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'pede-texto' };
    }
    const botao = achado ? achado.botao : null;
    if (!botao) {
      const dialogos = dialogosDiag(doc, pedido.titulo, null);
      const botoesCentro = botoesDoCentro(doc, pedido.custo);
      const totalBotoesCentro = contarBotoesCentro(doc);
      // Diagnóstico tirado com o centro ainda aberto, antes de fechar.
      montarPosicao(ctx, doc, pedido, achaCentro());
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'sem-botao', fase: 'confirmar', trava: ultimo.trava, dialogos, botoesCentro, totalBotoesCentro };
    }
    if (desabilitado(botao)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'indisponivel' };
    }
    // Reavaliação síncrona logo antes do clique: só clica se a mesma decisão valer agora.
    const via = achado.texto ? 'texto' : 'dedicado';
    const centroAgora = achaCentro();
    if (!centroAgora) return semCentro('confirmar');
    const decisao = achado.texto
      ? acharRedeemPorTexto(doc, centroAgora, pedido, ctx.retrato, ctx.cardsLista)
      : acharBotaoResgatarComTrava(doc, pedido.custo, pedido.titulo, centroAgora);
    if (decisao.botao !== botao) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'sem-botao', fase: 'confirmar', trava: decisao.trava, dialogos: [] };
    }
    // Aviso antes do clique: o pendente passa a "clicado" e não reenvia o resgate. Se o aviso lançar, não clica.
    try {
      if (typeof deps.aoClicar === 'function') deps.aoClicar(via);
    } catch {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'outro' };
    }
    clicar(botao);
    await deps.pausa(1500);
    if (achado.texto) {
      ctx.posClique = posCliqueDiag(ctx, achaCentro(), pedido, botao);
      await fecharCentro(doc, deps);
      return { estado: 'clicado', motivo: '', via: 'texto', redeem: ctx.redeem, posClique: ctx.posClique };
    }
    await fecharCentro(doc, deps);
    return { estado: 'clicado', motivo: '' };
  }

  const MAX_TENTATIVAS_CARD = 3;

  // Fallback por custo: abre cada card do custo, confere o título no detalhe (folha nova) e só então segue para o Redeem.
  // Card que não confere: fecha, reabre a lista e vai ao próximo. Nenhum clique além disso.
  // ctx guarda o diagnóstico do card clicado (antes do clique).
  async function resgatarPorCusto(doc, pedido, deps, achaCentro, semCentro, ctx, saldo) {
    const { titulo, custo } = pedido;
    const diag = () => ({
      estado: 'falhou',
      motivo: 'sem-recompensa',
      vistos: custosVistos(achaCentro()),
      dialogos: dialogosDiag(doc, titulo, null),
    });
    const todos = cardsPorCusto(achaCentro(), custo, saldo);
    if (!todos.length) {
      ctx.lista = listaDiag(achaCentro(), custo);
      const r = diag();
      await fecharCentro(doc, deps);
      return r;
    }
    if (todos.every(desabilitado)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'indisponivel' };
    }
    let indice = 0;
    for (let tentativas = 0; tentativas < MAX_TENTATIVAS_CARD; tentativas += 1) {
      const atuais = cardsPorCusto(achaCentro(), custo, saldo);
      const habilitados = atuais.filter((c) => !desabilitado(c));
      if (indice >= habilitados.length) break;
      if (!achaCentro()) return semCentro('confirmar');
      // Diagnóstico tirado com a lista aberta, antes do clique no card: depois de fechar o centro, custosVistos sairia vazio.
      const diagLista = diag();
      const card = habilitados[indice];
      const bloqueio = guardaCard(achaCentro(), titulo);
      if (bloqueio) {
        ctx.bloqueio = bloqueio;
        ctx.lista = listaDiag(achaCentro(), custo);
        const r = diag();
        await fecharCentro(doc, deps);
        return r;
      }
      const pre = prepararClique(card, 'custo', achaCentro(), pedido, atuais);
      if (!clicarCard(ctx, card, pre)) {
        ctx.lista = pre.lista;
        const r = diag();
        await fecharCentro(doc, deps);
        return r;
      }
      await deps.esperar(() => detalheAbriu(achaCentro(), titulo, ctx.retrato, atuais), 3000);
      if (!achaCentro()) return semCentro('confirmar');
      if (detalheAbriu(achaCentro(), titulo, ctx.retrato, atuais)) return confirmarResgate(doc, pedido, deps, achaCentro, semCentro, ctx);
      // Detalhe não abriu: diagnóstico tirado com o centro ainda aberto, antes de fechar.
      montarPosicao(ctx, doc, pedido, achaCentro());
      await fecharCentro(doc, deps);
      const fechou = !!(await deps.esperar(() => !achaCentro(), 2000));
      // Sem fechamento, aborta: nenhum clique extra no resumo nem em card.
      if (!fechou) return diag();
      // Sem próximo candidato, não reabre: o centro já está fechado.
      if (!(indice + 1 < habilitados.length && tentativas < MAX_TENTATIVAS_CARD - 1)) return diagLista;
      clicar(primeiro(doc, SELETORES.botaoPontos));
      if (!(await deps.esperar(achaCentro, 6000))) return semCentro('abrir');
      indice += 1;
    }
    const r = diag();
    await fecharCentro(doc, deps);
    return r;
  }

  // Fluxo do resgate: abre o centro, acha a recompensa pelo título (com o custo no texto), clica e confirma no botão de custo.
  async function resgatarFluxo(doc, pedido, deps, ctx) {
    const resumo = primeiro(doc, SELETORES.botaoPontos);
    if (!resumo) return { estado: 'falhou', motivo: 'sem-resumo' };
    const achaCentro = () => centroAberto(doc);
    // Saldo lido do resumo antes de qualquer clique: só para o diagnóstico (folhas.saldo).
    ctx.saldo = seguro(() => numerosDe(textoDe(resumo)), []);
    // Saldo lido do resumo uma vez, antes de abrir o centro. Passa adiante para as buscas por custo.
    const saldo = saldoDoResumo(doc);
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
    let busca = { achado: null, ambigua: false, rejeitado: null };
    // Para quando acha pelo título ou quando já há card do custo pedido (o título só aparece depois de abrir o card).
    await deps.esperar(() => {
      busca = buscarRecompensa(doc, pedido.titulo, achaCentro(), pedido.custo);
      return busca.achado || (!busca.ambigua && cardsPorCusto(achaCentro(), pedido.custo, saldo).length > 0);
    }, 6000);
    if (!achaCentro()) return semCentro('buscar');
    ctx.rejeitado = busca.rejeitado ? rejeitadoDiag(busca.rejeitado, normal(pedido.titulo), pedido.custo) : null;
    const item = busca.achado;
    if (!item && busca.ambigua) {
      const vistos = titulosVistos(achaCentro());
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'recompensa-ambigua', vistos };
    }
    if (!item) return resgatarPorCusto(doc, pedido, deps, achaCentro, semCentro, ctx, saldo);
    if (desabilitado(item)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'indisponivel' };
    }
    const bloqueioItem = guardaCard(achaCentro(), pedido.titulo);
    if (bloqueioItem) {
      ctx.bloqueio = bloqueioItem;
      ctx.lista = listaDiag(achaCentro(), pedido.custo);
      const r = { estado: 'falhou', motivo: 'sem-recompensa', vistos: custosVistos(achaCentro()), dialogos: dialogosDiag(doc, pedido.titulo, null) };
      await fecharCentro(doc, deps);
      return r;
    }
    const pre = prepararClique(item, 'titulo', achaCentro(), pedido, []);
    if (!clicarCard(ctx, item, pre)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'outro' };
    }
    clicou = true;
    await deps.pausa(600);
    montarPosicao(ctx, doc, pedido, achaCentro());
    return confirmarResgate(doc, pedido, deps, achaCentro, semCentro, ctx);
  }

  // Resgate com o card clicado no retorno: cardClicado = { dts, alvo, aria, custo, desab } (antes do clique) ou null se nenhum card foi clicado.
  // percurso só entra em falha, quando houve clique, item recusado ou custo na lista a reportar.
  async function resgatar(doc, pedido, deps) {
    const ctx = {
      card: null,
      cardDiag: null,
      cardsLista: [],
      retrato: null,
      caminho: '',
      clique: null,
      lista: null,
      rejeitado: null,
      pos: null,
      folhas: null,
      escopo: null,
      candidatos: [],
      foraDoCentro: 0,
      saldo: [],
      bloqueio: '',
      redeem: null,
      posClique: null,
    };
    const r = await resgatarFluxo(doc, pedido, deps, ctx);
    const out = Object.assign({}, r, { cardClicado: ctx.cardDiag });
    if (r.estado === 'falhou') {
      const percurso = percursoDe(ctx);
      if (percurso) out.percurso = percurso;
    }
    return out;
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
    botoesDoCentro,
    contarBotoesCentro,
    cabecalhoDiag,
    classesPista,
    acharRedeemPorTexto,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MESA_TWITCH_DOM;
