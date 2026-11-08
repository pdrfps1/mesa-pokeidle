// @ts-check
// Cliente da PokeAPI: normaliza a busca, valida a resposta e guarda em memória e no storage.
// Nunca rejeita: devolve { ok, ... } com um motivo. Sem dependências além de poke-stats.
// No renderer vira o global MesaPokeApi (poke-stats.js carrega antes); no Node, module.exports.
var MesaPokeApi = (function pokeApiModule() {
  /** @typedef {'entrada-invalida'|'nao-encontrado'|'erro-servidor'|'tempo'|'offline'|'resposta-invalida'} Motivo */
  /**
   * @typedef {{id: number, name: string, types: string[], stats: Record<string, number>}} DadoPokemon
   */
  /** @typedef {{ok: true, data: DadoPokemon, fonte: 'memoria'|'disco'|'rede'} | {ok: false, motivo: Motivo}} ResultadoBusca */

  // @ts-ignore: no renderer o global vem de poke-stats.js; no Node, do require.
  const statsLib = (typeof module !== 'undefined' && module.exports) ? require('./poke-stats') : MesaPokeStats;
  const STAT_KEYS = statsLib.STAT_KEYS;

  const API_BASE = 'https://pokeapi.co/api/v2/pokemon/';
  const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
  const STORAGE_KEY = 'mesa.pokeapi.v1';
  const ID_MAX = 100000;
  const NOME_RE = /^[a-z0-9-]{1,40}$/;

  /** @param {unknown} value */
  function isPlain(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Normaliza o texto digitado em chave de busca: número (zeros à esquerda somem) ou nome.
   * @param {unknown} text
   * @returns {{ok: true, key: string} | {ok: false, motivo: 'entrada-invalida'}}
   */
  function normalizeQuery(text) {
    const invalida = { ok: /** @type {const} */ (false), motivo: /** @type {const} */ ('entrada-invalida') };
    if (typeof text !== 'string') return invalida;
    const limpo = text.trim().toLowerCase().replace(/\s+/g, '-');
    if (/^\d+$/.test(limpo)) {
      const numero = Number(limpo);
      if (numero >= 1 && numero <= ID_MAX) return { ok: true, key: String(numero) };
      return invalida;
    }
    if (NOME_RE.test(limpo)) return { ok: true, key: limpo };
    return invalida;
  }

  /**
   * Converte o JSON da PokeAPI no formato guardado. Devolve null se faltar id, tipo ou um dos seis stats.
   * @param {unknown} json
   * @returns {DadoPokemon | null}
   */
  function parsePokemon(json) {
    if (!isPlain(json)) return null;
    const dado = /** @type {Record<string, any>} */ (json);
    const id = dado.id;
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1 || id > ID_MAX) return null;

    if (!Array.isArray(dado.types)) return null;
    const tipos = dado.types
      .filter((/** @type {any} */ t) => isPlain(t) && typeof t.slot === 'number' && isPlain(t.type) && typeof t.type.name === 'string')
      .sort((/** @type {any} */ a, /** @type {any} */ b) => a.slot - b.slot)
      .map((/** @type {any} */ t) => String(t.type.name));
    if (tipos.length === 0) return null;

    if (!Array.isArray(dado.stats)) return null;
    /** @type {Record<string, number>} */
    const stats = {};
    for (const key of STAT_KEYS) {
      const achado = dado.stats.find((/** @type {any} */ s) => isPlain(s) && isPlain(s.stat) && s.stat.name === key);
      const valor = achado ? achado.base_stat : undefined;
      if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0 || valor > 1000) return null;
      stats[key] = valor;
    }

    return { id, name: typeof dado.name === 'string' ? dado.name : String(id), types: tipos, stats };
  }

  /**
   * URLs do sprite, da mais preferida para a menos. Só monta a partir do id numérico validado.
   * @param {number} id
   * @param {{shiny?: boolean, reducedMotion?: boolean}} [options]
   * @returns {string[]}
   */
  function spriteCandidates(id, options) {
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1 || id > ID_MAX) return [];
    const shiny = !!(options && options.shiny);
    const reduzido = !!(options && options.reducedMotion);
    const caminhos = shiny
      ? [`showdown/shiny/${id}.gif`, `shiny/${id}.png`, `other/official-artwork/shiny/${id}.png`]
      : [`showdown/${id}.gif`, `${id}.png`, `other/official-artwork/${id}.png`];
    const escolhidos = reduzido ? caminhos.filter((c) => !c.endsWith('.gif')) : caminhos;
    return escolhidos.map((c) => SPRITE_BASE + c);
  }

  /** @param {DadoPokemon} data @returns {string[]} */
  function chavesDe(data) {
    const chaves = [String(data.id)];
    const nome = normalizeQuery(data.name);
    if (nome.ok) chaves.push(nome.key);
    return chaves;
  }

  /**
   * @param {unknown} data
   * @returns {data is DadoPokemon}
   */
  function dadoValido(data) {
    if (!isPlain(data)) return false;
    const d = /** @type {Record<string, any>} */ (data);
    return typeof d.id === 'number' && Number.isInteger(d.id)
      && typeof d.name === 'string'
      && Array.isArray(d.types) && d.types.every((/** @type {unknown} */ t) => typeof t === 'string')
      && isPlain(d.stats) && STAT_KEYS.every((k) => typeof d.stats[k] === 'number');
  }

  /**
   * @param {{fetchImpl?: (url: string, init?: any) => Promise<any>, storage?: any, timeoutMs?: number, maxEntries?: number}} [options]
   */
  function createPokeClient(options) {
    const opts = options || {};
    const fetchImpl = opts.fetchImpl;
    const storage = opts.storage;
    const timeoutMs = typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0 ? opts.timeoutMs : 8000;
    const maxEntries = typeof opts.maxEntries === 'number' && opts.maxEntries >= 1 ? Math.floor(opts.maxEntries) : 200;

    /** @type {Map<string, DadoPokemon>} */
    const memory = new Map();
    /** @type {Set<string>} chaves 404: só em memória */
    const misses = new Set();
    /** @type {Map<string, Promise<ResultadoBusca>>} */
    const inflight = new Map();

    /** @param {string[]} keys @param {DadoPokemon} data */
    function rememberMemory(keys, data) {
      for (const k of keys) {
        memory.delete(k);
        memory.set(k, data);
      }
      while (memory.size > maxEntries * 2) {
        const primeira = memory.keys().next().value;
        if (primeira === undefined) break;
        memory.delete(primeira);
      }
    }

    /** @returns {{ids: string[], data: DadoPokemon}[]} */
    function readDisk() {
      try {
        if (!storage) return [];
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const lista = JSON.parse(raw);
        if (!Array.isArray(lista)) return [];
        return lista.filter((r) => isPlain(r) && Array.isArray(r.ids) && dadoValido(r.data));
      } catch (_) {
        return [];
      }
    }

    /** @param {{ids: string[], data: DadoPokemon}[]} records */
    function writeDisk(records) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-maxEntries)));
      } catch (_) {
        // Storage cheio ou bloqueado: o cache continua só em memória.
      }
    }

    /** @param {string} key @returns {DadoPokemon | null} */
    function findDisk(key) {
      const records = readDisk();
      for (let i = records.length - 1; i >= 0; i -= 1) {
        if (records[i].ids.includes(key)) return records[i].data;
      }
      return null;
    }

    /** @param {DadoPokemon} data */
    function saveDisk(data) {
      const ids = chavesDe(data);
      const records = readDisk().filter((r) => !r.ids.some((id) => ids.includes(id)));
      records.push({ ids, data });
      writeDisk(records);
    }

    /** @param {string} key @returns {Promise<ResultadoBusca>} */
    async function buscarRede(key) {
      /** @type {ReturnType<typeof setTimeout> | null} */
      let timer = null;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const prazo = new Promise((resolve) => {
        timer = setTimeout(() => {
          if (controller) controller.abort();
          resolve({ ok: false, motivo: 'tempo' });
        }, timeoutMs);
      });
      const trabalho = (async () => {
        /** @type {any} */
        let res;
        try {
          res = await fetchImpl(API_BASE + encodeURIComponent(key), controller ? { signal: controller.signal } : undefined);
        } catch (_) {
          return { ok: false, motivo: 'offline' };
        }
        if (!res) return { ok: false, motivo: 'erro-servidor' };
        if (res.status === 404) {
          misses.add(key);
          return { ok: false, motivo: 'nao-encontrado' };
        }
        if (!res.ok) return { ok: false, motivo: 'erro-servidor' };
        /** @type {unknown} */
        let json;
        try {
          json = await res.json();
        } catch (_) {
          return { ok: false, motivo: 'resposta-invalida' };
        }
        const data = parsePokemon(json);
        if (!data) return { ok: false, motivo: 'resposta-invalida' };
        rememberMemory(chavesDe(data), data);
        saveDisk(data);
        return { ok: true, data, fonte: 'rede' };
      })();
      try {
        return await Promise.race([trabalho, prazo]);
      } finally {
        if (timer !== null) clearTimeout(timer);
      }
    }

    /**
     * Busca um Pokémon. Nunca rejeita.
     * @param {unknown} query
     * @returns {Promise<ResultadoBusca>}
     */
    async function get(query) {
      try {
        const norm = normalizeQuery(query);
        if (!norm.ok) return { ok: false, motivo: 'entrada-invalida' };
        const key = norm.key;
        if (misses.has(key)) return { ok: false, motivo: 'nao-encontrado' };
        const emMemoria = memory.get(key);
        if (emMemoria) return { ok: true, data: emMemoria, fonte: 'memoria' };
        const pendente = inflight.get(key);
        if (pendente) return await pendente;
        const emDisco = findDisk(key);
        if (emDisco) {
          rememberMemory(chavesDe(emDisco), emDisco);
          return { ok: true, data: emDisco, fonte: 'disco' };
        }
        const busca = buscarRede(key).finally(() => inflight.delete(key));
        inflight.set(key, busca);
        return await busca;
      } catch (_) {
        return { ok: false, motivo: 'erro-servidor' };
      }
    }

    /**
     * Síncrono e só cache: memória ou storage. Nunca faz rede e nunca lança.
     * @param {unknown} query
     * @returns {{ok: true, data: DadoPokemon, fonte: 'memoria'|'disco'} | {ok: false, motivo: 'entrada-invalida'|'fora-do-cache'}}
     */
    function peek(query) {
      try {
        const norm = normalizeQuery(query);
        if (!norm.ok) return { ok: false, motivo: 'entrada-invalida' };
        const emMemoria = memory.get(norm.key);
        if (emMemoria) return { ok: true, data: emMemoria, fonte: 'memoria' };
        const emDisco = findDisk(norm.key);
        if (emDisco) {
          rememberMemory(chavesDe(emDisco), emDisco);
          return { ok: true, data: emDisco, fonte: 'disco' };
        }
        return { ok: false, motivo: 'fora-do-cache' };
      } catch (_) {
        return { ok: false, motivo: 'fora-do-cache' };
      }
    }

    return { get, peek };
  }

  return { normalizeQuery, parsePokemon, spriteCandidates, createPokeClient };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = MesaPokeApi;
