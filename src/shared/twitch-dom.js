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
    centro: ['#channel-points-reward-center-body', '[data-test-selector="reward-center"]', '.reward-center-body', '[role="dialog"]'],
    resgatar: ['[data-test-selector="RequestRewardButton"]'],
    campoTexto: ['#channel-points-reward-center-body textarea', '[role="dialog"] textarea'],
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

  function normal(s) {
    return limpa(s).toLowerCase();
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
      },
      anterior: { tempo: video && typeof video.currentTime === 'number' ? video.currentTime : -1 },
    };
  }

  // Quem casa com o texto é um botão. Vários candidatos iguais ou parciais: não clica em nenhum.
  function unicoOuNulo(lista) {
    return lista.length === 1 ? lista[0] : null;
  }

  // Igualdade normalizada primeiro, no texto ou no title (A-4). Só cai na contenção com um candidato único.
  function acharRecompensa(doc, titulo) {
    const alvo = normal(titulo);
    if (!alvo) return null;
    const centro = primeiro(doc, SELETORES.centro);
    const raiz = centro || doc;
    const botoes = Array.from(raiz.querySelectorAll('button,[role="button"]'));
    const titulosExatos = Array.from(raiz.querySelectorAll('[title]'))
      .filter((el) => normal(el.getAttribute('title')) === alvo)
      .map(botaoDe);
    const iguais = new Set([...botoes.filter((el) => normal(textoDe(el)) === alvo), ...titulosExatos]);
    if (iguais.size) return iguais.size === 1 ? Array.from(iguais)[0] : null;
    const parciais = botoes.filter((el) => normal(textoDe(el)).includes(alvo));
    return unicoOuNulo(parciais);
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
  function acharBotaoResgatar(doc, custo, titulo) {
    const centro = primeiro(doc, SELETORES.centro);
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

  async function fecharCentro(doc, deps) {
    if (!primeiro(doc, SELETORES.centro)) return;
    const botao = primeiro(doc, SELETORES.botaoPontos);
    if (!botao) return;
    clicar(botao);
    await deps.pausa(300);
  }

  // Fluxo do resgate: abre o centro, acha a recompensa pelo título, clica e confirma no botão de custo.
  async function resgatar(doc, pedido, deps) {
    const resumo = primeiro(doc, SELETORES.botaoPontos);
    if (!resumo) return { estado: 'falhou', motivo: 'sem-resumo' };
    if (!primeiro(doc, SELETORES.centro)) clicar(resumo);
    const item = await deps.esperar(() => acharRecompensa(doc, pedido.titulo), 6000);
    if (!item) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'sem-recompensa' };
    }
    if (desabilitado(item)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'indisponivel' };
    }
    clicar(item);
    await deps.pausa(600);
    if (primeiro(doc, SELETORES.campoTexto)) {
      await fecharCentro(doc, deps);
      return { estado: 'falhou', motivo: 'pede-texto' };
    }
    const botao = await deps.esperar(() => acharBotaoResgatar(doc, pedido.custo, pedido.titulo), 5000);
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
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MESA_TWITCH_DOM;
