'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const api = require('./poke-api');

const PIKA_JSON = {
  id: 25,
  name: 'pikachu',
  types: [{ slot: 1, type: { name: 'electric' } }],
  stats: [
    { base_stat: 35, stat: { name: 'hp' } },
    { base_stat: 55, stat: { name: 'attack' } },
    { base_stat: 40, stat: { name: 'defense' } },
    { base_stat: 50, stat: { name: 'special-attack' } },
    { base_stat: 50, stat: { name: 'special-defense' } },
    { base_stat: 90, stat: { name: 'speed' } },
  ],
};

const PIKA_DATA = {
  id: 25,
  name: 'pikachu',
  types: ['electric'],
  stats: { hp: 35, attack: 55, defense: 40, 'special-attack': 50, 'special-defense': 50, speed: 90 },
};

function respostaOk(json) {
  return { ok: true, status: 200, json: async () => json };
}

/** Fetch falso que conta chamadas. */
function fetchFalso(resposta) {
  const chamadas = [];
  const fetchImpl = async (url) => {
    chamadas.push(url);
    return typeof resposta === 'function' ? resposta(url) : resposta;
  };
  return { fetchImpl, chamadas };
}

/** Storage falso em memória. */
function storageFalso(inicial) {
  const dados = new Map();
  if (inicial !== undefined) dados.set('mesa.pokeapi.v1', inicial);
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    dados,
  };
}

describe('normalizeQuery', () => {
  it('aceita número e nome, normalizando espaço e maiúsculas', () => {
    assert.deepEqual(api.normalizeQuery('25'), { ok: true, key: '25' });
    assert.deepEqual(api.normalizeQuery('025'), { ok: true, key: '25' });
    assert.deepEqual(api.normalizeQuery('  Pikachu '), { ok: true, key: 'pikachu' });
    assert.deepEqual(api.normalizeQuery('Mr Mime'), { ok: true, key: 'mr-mime' });
  });

  it('recusa vazio, caracteres inválidos e zero', () => {
    for (const entrada of ['', 'mr mime!', '0', 100001, null]) {
      assert.deepEqual(api.normalizeQuery(entrada), { ok: false, motivo: 'entrada-invalida' }, String(entrada));
    }
  });
});

describe('parsePokemon', () => {
  it('extrai id, nome, tipos ordenados e os seis stats', () => {
    assert.deepEqual(api.parsePokemon(PIKA_JSON), PIKA_DATA);
  });

  it('devolve null sem id, sem tipo ou sem speed', () => {
    assert.equal(api.parsePokemon({ ...PIKA_JSON, id: undefined }), null);
    assert.equal(api.parsePokemon({ ...PIKA_JSON, types: [] }), null);
    assert.equal(api.parsePokemon({ ...PIKA_JSON, stats: PIKA_JSON.stats.slice(0, 5) }), null);
    assert.equal(api.parsePokemon(null), null);
  });
});

describe('spriteCandidates', () => {
  const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';

  it('normal', () => {
    assert.deepEqual(api.spriteCandidates(25, { shiny: false }), [
      `${BASE}showdown/25.gif`,
      `${BASE}25.png`,
      `${BASE}other/official-artwork/25.png`,
    ]);
  });

  it('shiny', () => {
    assert.deepEqual(api.spriteCandidates(25, { shiny: true }), [
      `${BASE}showdown/shiny/25.gif`,
      `${BASE}shiny/25.png`,
      `${BASE}other/official-artwork/shiny/25.png`,
    ]);
  });

  it('movimento reduzido tira o gif', () => {
    const lista = api.spriteCandidates(25, { shiny: false, reducedMotion: true });
    assert.equal(lista.some((u) => u.endsWith('.gif')), false);
    assert.equal(lista.length, 2);
  });
});

describe('createPokeClient', () => {
  it('200 válido vem da rede; a segunda busca vem da memória sem novo fetch', async () => {
    const { fetchImpl, chamadas } = fetchFalso(respostaOk(PIKA_JSON));
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso() });
    const primeira = await client.get('25');
    assert.equal(primeira.ok, true);
    assert.equal(primeira.fonte, 'rede');
    assert.deepEqual(primeira.data, PIKA_DATA);
    const segunda = await client.get('25');
    assert.equal(segunda.fonte, 'memoria');
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0], 'https://pokeapi.co/api/v2/pokemon/25');
  });

  it('busca por nome e depois por número faz um único fetch (cache por id e nome)', async () => {
    const { fetchImpl, chamadas } = fetchFalso(respostaOk(PIKA_JSON));
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso() });
    assert.equal((await client.get('Pikachu ')).ok, true);
    assert.equal((await client.get('25')).ok, true);
    assert.equal(chamadas.length, 1);
  });

  it('dado no storage vem do disco sem fetch', async () => {
    const record = JSON.stringify([{ ids: ['25', 'pikachu'], data: PIKA_DATA }]);
    const { fetchImpl, chamadas } = fetchFalso(respostaOk(PIKA_JSON));
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso(record) });
    const r = await client.get('pikachu');
    assert.equal(r.ok, true);
    assert.equal(r.fonte, 'disco');
    assert.equal(chamadas.length, 0);
  });

  it('404 vira nao-encontrado', async () => {
    const { fetchImpl } = fetchFalso({ ok: false, status: 404, json: async () => ({}) });
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso() });
    assert.deepEqual(await client.get('9999'), { ok: false, motivo: 'nao-encontrado' });
  });

  it('500 vira erro-servidor', async () => {
    const { fetchImpl } = fetchFalso({ ok: false, status: 500, json: async () => ({}) });
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso() });
    assert.deepEqual(await client.get('25'), { ok: false, motivo: 'erro-servidor' });
  });

  it('fetch que rejeita com TypeError vira offline', async () => {
    const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso() });
    assert.deepEqual(await client.get('25'), { ok: false, motivo: 'offline' });
  });

  it('fetch que nunca resolve vira tempo', async () => {
    const fetchImpl = () => new Promise(() => {});
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso(), timeoutMs: 20 });
    assert.deepEqual(await client.get('25'), { ok: false, motivo: 'tempo' });
  });

  it('JSON quebrado ou sem speed vira resposta-invalida', async () => {
    const quebrado = { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } };
    const client1 = api.createPokeClient({ fetchImpl: fetchFalso(quebrado).fetchImpl, storage: storageFalso() });
    assert.deepEqual(await client1.get('25'), { ok: false, motivo: 'resposta-invalida' });

    const semSpeed = { ...PIKA_JSON, stats: PIKA_JSON.stats.slice(0, 5) };
    const client2 = api.createPokeClient({ fetchImpl: fetchFalso(respostaOk(semSpeed)).fetchImpl, storage: storageFalso() });
    assert.deepEqual(await client2.get('25'), { ok: false, motivo: 'resposta-invalida' });
  });

  it('storage que lança não quebra a busca', async () => {
    const storage = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('cheio'); },
    };
    const { fetchImpl } = fetchFalso(respostaOk(PIKA_JSON));
    const client = api.createPokeClient({ fetchImpl, storage });
    const r = await client.get('25');
    assert.equal(r.ok, true);
    assert.equal(r.fonte, 'rede');
    assert.equal((await client.get('25')).fonte, 'memoria');
  });

  it('duas chamadas simultâneas geram um único fetch', async () => {
    const { fetchImpl, chamadas } = fetchFalso(respostaOk(PIKA_JSON));
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso() });
    const [a, b] = await Promise.all([client.get('25'), client.get('25')]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(chamadas.length, 1);
  });

  it('entrada inválida não faz requisição', async () => {
    const { fetchImpl, chamadas } = fetchFalso(respostaOk(PIKA_JSON));
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso() });
    for (const entrada of ['', 'mr mime!', '0']) {
      assert.deepEqual(await client.get(entrada), { ok: false, motivo: 'entrada-invalida' });
    }
    assert.equal(chamadas.length, 0);
  });

  it('peek: memória e disco sem fetch; fora do cache; entrada inválida; nunca lança', async () => {
    const { fetchImpl, chamadas } = fetchFalso(respostaOk(PIKA_JSON));
    const client = api.createPokeClient({ fetchImpl, storage: storageFalso() });
    assert.deepEqual(client.peek('25'), { ok: false, motivo: 'fora-do-cache' });
    assert.equal(chamadas.length, 0);
    assert.deepEqual(client.peek('mr mime!'), { ok: false, motivo: 'entrada-invalida' });
    await client.get('25');
    assert.equal(client.peek('Pikachu').fonte, 'memoria');
    assert.equal(client.peek('25').fonte, 'memoria');
    assert.equal(chamadas.length, 1);

    const record = JSON.stringify([{ ids: ['25', 'pikachu'], data: PIKA_DATA }]);
    const doDisco = api.createPokeClient({ fetchImpl, storage: storageFalso(record) });
    assert.equal(doDisco.peek('pikachu').fonte, 'disco');
    assert.equal(chamadas.length, 1);

    const quebrado = api.createPokeClient({
      fetchImpl,
      storage: { getItem: () => { throw new Error('bloqueado'); }, setItem: () => {} },
    });
    assert.deepEqual(quebrado.peek('25'), { ok: false, motivo: 'fora-do-cache' });
    assert.equal(chamadas.length, 1);
  });

  it('persiste só id, name, types e stats no storage, com limite de entradas', async () => {
    const storage = storageFalso();
    const { fetchImpl } = fetchFalso(respostaOk(PIKA_JSON));
    const client = api.createPokeClient({ fetchImpl, storage, maxEntries: 1 });
    await client.get('25');
    const salvo = JSON.parse(storage.dados.get('mesa.pokeapi.v1'));
    assert.equal(salvo.length, 1);
    assert.deepEqual(salvo[0].data, PIKA_DATA);
  });
});
