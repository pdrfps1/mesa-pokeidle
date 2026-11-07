// Calculadora de status na Espera. Fórmulas em shared/poke-stats.js; busca em shared/poke-api.js.
// Só textContent para texto de usuário e da API: nada vira HTML. Usa el() de app.js.
(function pokeCalcModule() {
  const STORAGE_KEY = 'mesa.pokecalc.v1';
  const VAZIO = 'Busque um Pokémon pelo número ou nome.';
  const NOMES = {
    hp: 'HP',
    attack: 'Ataque',
    defense: 'Defesa',
    'special-attack': 'Ataque esp.',
    'special-defense': 'Defesa esp.',
    speed: 'Velocidade',
  };
  const MSG_ERRO = {
    'nao-encontrado': 'Pokémon não encontrado.',
    offline: 'Sem conexão com a PokeAPI. Tente de novo.',
    tempo: 'A PokeAPI demorou para responder. Tente de novo.',
    'erro-servidor': 'A PokeAPI respondeu com erro. Tente de novo.',
    'resposta-invalida': 'A PokeAPI respondeu com erro. Tente de novo.',
    'entrada-invalida': 'Use um número ou um nome (letras, números e hífen).',
  };
  const fmt2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

  function reducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function lerEstado() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const valor = raw ? JSON.parse(raw) : null;
      return valor && typeof valor === 'object' ? valor : {};
    } catch (_) {
      return {};
    }
  }

  function gravarEstado(estado) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch (_) {
      // Storage bloqueado: a calculadora segue sem lembrar as entradas.
    }
  }

  function criarCliente() {
    let storage = null;
    try {
      storage = window.localStorage;
    } catch (_) {
      storage = null;
    }
    const fetchImpl = typeof window.fetch === 'function' ? window.fetch.bind(window) : undefined;
    return MesaPokeApi.createPokeClient({ fetchImpl, storage });
  }

  function capitaliza(texto) {
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
  }

  function campoRange(id, texto, min, max, valor, formatar) {
    const wrap = el('div', 'poke-calc-field');
    const rotulo = el('label', 'poke-calc-label', texto);
    rotulo.setAttribute('for', id);
    const linha = el('div', 'poke-calc-range-row');
    const input = el('input', 'poke-calc-range');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(valor);
    const saida = el('output', 'poke-calc-out num', formatar(valor));
    saida.setAttribute('for', id);
    linha.append(input, saida);
    wrap.append(rotulo, linha);
    return { wrap, input, saida, formatar };
  }

  function campoNumero(id, texto, min, max, passo, valor) {
    const wrap = el('div', 'poke-calc-field');
    const rotulo = el('label', 'poke-calc-label', texto);
    rotulo.setAttribute('for', id);
    const input = el('input', 'poke-calc-num num');
    input.type = 'number';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = String(passo);
    input.inputMode = 'decimal';
    input.value = String(valor);
    wrap.append(rotulo, input);
    return { wrap, input };
  }

  function mountPokeCalc() {
    const saved = lerEstado();
    // Valores iniciais passam pelo mesmo normalizador da UI: dado salvo ruim vira padrão.
    const iniciais = MesaPokeStats.normalizeInputs(saved).values;
    const client = criarCliente();
    /** @type {any} */
    let current = null;
    let searchSeq = 0;
    let spriteSeq = 0;
    // Sprite adiado: o resultado restaurado do cache não baixa imagem até a Espera mostrar o widget.
    let spritePendente = false;
    // Observer do sprite pendente, guardado para ser desconectado quando o sprite for pintado.
    let observador = null;
    // Id numérico do último Pokémon pesquisado com sucesso: é o que a restauração usa.
    let ultimaId = typeof saved.ultima === 'string' && /^\d+$/.test(saved.ultima) ? saved.ultima : null;

    const root = el('section', 'poke-calc');

    // Busca: só roda ao enviar o formulário.
    const form = el('form', 'poke-calc-search');
    form.setAttribute('role', 'search');
    const idBusca = 'pokecalc-busca';
    const rotuloBusca = el('label', 'poke-calc-label', 'Pokémon (número ou nome)');
    rotuloBusca.setAttribute('for', idBusca);
    const busca = el('input', 'poke-calc-input');
    busca.type = 'text';
    busca.id = idBusca;
    busca.autocomplete = 'off';
    busca.spellcheck = false;
    busca.maxLength = 60;
    busca.value = typeof saved.busca === 'string' ? saved.busca.slice(0, 60) : '';
    const btnBuscar = el('button', 'poke-calc-btn', 'Buscar');
    btnBuscar.type = 'submit';
    const linhaBusca = el('div', 'poke-calc-search-row');
    linhaBusca.append(busca, btnBuscar);
    form.append(rotuloBusca, linhaBusca);

    // Único status da calculadora: carregando e erros.
    const status = el('p', 'poke-calc-status', VAZIO);
    status.setAttribute('role', 'status');
    status.setAttribute('aria-atomic', 'true');

    const resultado = el('div', 'poke-calc-result');
    resultado.hidden = true;

    // Cabeçalho: sprite em caixa fixa, nome e tipos.
    const cabeca = el('div', 'poke-calc-head');
    const caixa = el('div', 'poke-calc-sprite');
    const img = el('img', 'poke-calc-img');
    img.alt = '';
    img.decoding = 'async';
    img.hidden = true;
    const semImagem = el('span', 'poke-calc-noimg', 'Sem imagem');
    semImagem.hidden = true;
    caixa.append(img, semImagem);
    const info = el('div', 'poke-calc-info');
    const nomeEl = el('h3', 'poke-calc-name');
    const tiposEl = el('ul', 'poke-calc-types');
    tiposEl.setAttribute('aria-label', 'Tipos');
    info.append(nomeEl, tiposEl);
    cabeca.append(caixa, info);

    // Controles.
    const controles = el('div', 'poke-calc-controls');
    const nivel = campoRange('pokecalc-nivel', 'Nível', 1, 100, iniciais.level, (v) => String(v));
    const qualidade = campoRange('pokecalc-qualidade', 'Qualidade', 85, 120, iniciais.quality, (v) => `${v}%`);
    const iv = campoNumero('pokecalc-iv', 'IV (vale para os 6 stats)', 0, 31, 1, iniciais.iv);
    const recarga = campoNumero('pokecalc-recarga', 'Recarga base da skill (s)', 0.1, 600, 0.1, iniciais.baseCd);

    const tiers = el('fieldset', 'poke-calc-tiers');
    tiers.append(el('legend', 'poke-calc-label', 'Tier'));
    const opcoesTier = el('div', 'poke-calc-tier-row');
    /** @type {HTMLInputElement[]} */
    const radios = [];
    for (const nome of Object.keys(MesaPokeStats.TIERS)) {
      const opcao = el('label', 'poke-calc-tier');
      const radio = el('input');
      radio.type = 'radio';
      radio.name = 'pokecalc-tier';
      radio.value = nome;
      radio.checked = nome === iniciais.tier;
      const multiplicador = el('span', 'poke-calc-mult num', `×${fmt2.format(MesaPokeStats.TIERS[nome] / 100)}`);
      opcao.append(radio, el('span', 'poke-calc-tier-nome', nome), multiplicador);
      opcoesTier.append(opcao);
      radios.push(radio);
    }
    tiers.append(opcoesTier);

    const shinyWrap = el('div', 'poke-calc-field');
    const rotuloShiny = el('label', 'poke-calc-switch');
    const shiny = el('input');
    shiny.type = 'checkbox';
    shiny.setAttribute('role', 'switch');
    shiny.checked = iniciais.shiny;
    const shinyEstado = el('span', 'poke-calc-switch-estado', iniciais.shiny ? 'Ligado' : 'Desligado');
    rotuloShiny.append(shiny, el('span', 'poke-calc-switch-nome', 'Shiny'), shinyEstado);
    shinyWrap.append(rotuloShiny);

    controles.append(nivel.wrap, qualidade.wrap, iv.wrap, recarga.wrap, tiers, shinyWrap);

    // Saídas: tabela de stats, recarga e notas.
    const tabela = el('table', 'poke-calc-table');
    const thead = el('thead');
    const linhaHead = el('tr');
    linhaHead.append(el('th', null, 'Stat'), el('th', 'num', 'Base'), el('th', 'num', 'Final'));
    thead.append(linhaHead);
    const tbody = el('tbody');
    /** @type {Record<string, {base: HTMLElement, fin: HTMLElement}>} */
    const linhasStat = {};
    for (const key of MesaPokeStats.STAT_KEYS) {
      const tr = el('tr');
      const base = el('td', 'num', '–');
      const fin = el('td', 'num poke-calc-final', '–');
      tr.append(el('th', 'poke-calc-stat', NOMES[key]), base, fin);
      tbody.append(tr);
      linhasStat[key] = { base, fin };
    }
    tabela.append(thead, tbody);

    const linhaRecarga = el('p', 'poke-calc-cd', '');
    const linhaPiso = el('p', 'poke-calc-floor', 'no piso de 0,5 s');
    linhaPiso.hidden = true;
    const ajuste = el('p', 'poke-calc-adjust', '');
    ajuste.hidden = true;
    const nota = el('p', 'poke-calc-note', 'Fórmulas conforme especificação do usuário; não conferidas no jogo.');

    resultado.append(cabeca, controles, tabela, linhaRecarga, linhaPiso, ajuste, nota);
    root.append(form, status, resultado);

    function valoresAtuais() {
      const marcado = radios.find((r) => r.checked);
      return {
        level: nivel.input.value,
        quality: qualidade.input.value,
        iv: iv.input.value,
        tier: marcado ? marcado.value : undefined,
        shiny: shiny.checked,
        baseCd: recarga.input.value,
      };
    }

    function salvar() {
      const marcado = radios.find((r) => r.checked);
      gravarEstado({
        busca: busca.value.slice(0, 60),
        ultima: ultimaId,
        level: nivel.input.value,
        quality: qualidade.input.value,
        iv: iv.input.value,
        tier: marcado ? marcado.value : undefined,
        shiny: shiny.checked,
        baseCd: recarga.input.value,
      });
    }

    /** Recalcula de forma síncrona. Nunca lança para a UI. */
    function recalcular() {
      const norm = MesaPokeStats.normalizeInputs(valoresAtuais());
      const v = norm.values;
      nivel.saida.textContent = nivel.formatar(v.level);
      qualidade.saida.textContent = qualidade.formatar(v.quality);
      shinyEstado.textContent = shiny.checked ? 'Ligado' : 'Desligado';

      if (norm.ajustes.length > 0) {
        ajuste.textContent = norm.ajustes.map((a) => MesaPokeStats.formatAjuste(a)).join(' ');
        ajuste.hidden = false;
      } else {
        ajuste.textContent = '';
        ajuste.hidden = true;
      }

      if (!current) return;
      try {
        const finais = MesaPokeStats.finalStats({
          baseStats: current.stats,
          level: v.level,
          quality: v.quality,
          iv: v.iv,
          tier: v.tier,
          shiny: v.shiny,
        });
        for (const key of MesaPokeStats.STAT_KEYS) {
          linhasStat[key].base.textContent = fmtInt.format(current.stats[key]);
          linhasStat[key].fin.textContent = fmtInt.format(finais[key]);
        }
        const reducao = MesaPokeStats.cooldownReduction(finais.speed);
        const cdFinal = MesaPokeStats.finalSkillCooldown(v.baseCd, finais.speed);
        linhaRecarga.textContent = `Recarga: ${fmt2.format(cdFinal)} s (redução ×${fmt2.format(reducao)})`;
        linhaPiso.hidden = !(v.baseCd / reducao < MesaPokeStats.CD_FLOOR);
      } catch (erro) {
        status.textContent = erro instanceof Error ? erro.message : 'Não foi possível calcular.';
      }
    }

    function paintSprite() {
      const token = ++spriteSeq;
      const lista = current
        ? MesaPokeApi.spriteCandidates(current.id, { shiny: shiny.checked, reducedMotion: reducedMotion() })
        : [];
      let proximo = 0;
      const tentar = () => {
        if (token !== spriteSeq) return;
        if (proximo >= lista.length) {
          img.removeAttribute('src');
          img.hidden = true;
          semImagem.hidden = false;
          return;
        }
        semImagem.hidden = true;
        img.hidden = false;
        // Arte oficial não é pixel art: só os sprites de pixel usam image-rendering pixelated.
        img.dataset.sprite = lista[proximo].includes('/other/official-artwork/') ? 'arte' : 'pixel';
        img.src = lista[proximo];
        proximo += 1;
      };
      img.onerror = tentar;
      tentar();
    }

    function pintarPokemon(dado, comSprite = true) {
      current = dado;
      nomeEl.textContent = capitaliza(dado.name);
      tiposEl.replaceChildren(...dado.types.map((t) => el('li', 'poke-calc-chip', capitaliza(t))));
      img.alt = capitaliza(dado.name);
      resultado.hidden = false;
      if (comSprite) {
        // Sprite pintado agora: nada pendente, e o observer não pode repintar depois.
        spritePendente = false;
        if (observador) observador.disconnect();
        paintSprite();
      } else {
        spritePendente = true;
      }
      recalcular();
    }

    function garantirSprite() {
      if (!spritePendente || !current) return;
      spritePendente = false;
      paintSprite();
    }

    function onChange() {
      recalcular();
      salvar();
    }

    async function buscar(event) {
      event.preventDefault();
      const seq = ++searchSeq;
      btnBuscar.disabled = true;
      status.textContent = 'Buscando…';
      salvar();
      /** @type {any} */
      let res;
      try {
        res = await client.get(busca.value);
      } catch (_) {
        res = { ok: false, motivo: 'erro-servidor' };
      }
      if (seq !== searchSeq) return;
      btnBuscar.disabled = false;
      if (res.ok) {
        status.textContent = '';
        ultimaId = String(res.data.id);
        salvar();
        pintarPokemon(res.data);
      } else {
        status.textContent = MSG_ERRO[res.motivo] || MSG_ERRO['erro-servidor'];
        current = null;
        resultado.hidden = true;
      }
    }

    form.addEventListener('submit', buscar);
    busca.addEventListener('input', salvar);
    for (const campo of [nivel.input, qualidade.input, iv.input, recarga.input]) {
      campo.addEventListener('input', onChange);
    }
    for (const radio of radios) radio.addEventListener('change', onChange);
    shiny.addEventListener('change', () => {
      // Mesmo que pintarPokemon com sprite: nada pendente, observer desligado.
      spritePendente = false;
      if (observador) observador.disconnect();
      if (current) paintSprite();
      onChange();
    });

    // Restaura o último resultado só do cache (sem rede). Sprite só baixa quando o widget aparece.
    // Só a chave do último resultado bem-sucedido: sem ela, fica no estado vazio.
    const cache = ultimaId ? client.peek(ultimaId) : null;
    if (cache && cache.ok) {
      pintarPokemon(cache.data, false);
      status.textContent = '';
      if (typeof IntersectionObserver === 'function') {
        observador = new IntersectionObserver((entradas) => {
          if (entradas.some((e) => e.isIntersecting)) {
            if (observador) observador.disconnect();
            garantirSprite();
          }
        });
        observador.observe(root);
      } else {
        garantirSprite();
      }
    }

    recalcular();
    return { root };
  }

  window.mountPokeCalc = mountPokeCalc;
}());
