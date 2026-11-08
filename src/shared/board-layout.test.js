'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('./board-layout');

const EXEMPLO = path.join(__dirname, '../../docs/exemplos/board-layout.exemplo.json');
const SCHEMA = path.join(__dirname, '../../docs/board-layout.schema.json');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

function mods(state) {
  return state.profiles[state.activeProfile].modules;
}

function mod(state, id) {
  return mods(state).find((m) => m.id === id);
}

function mk(id, type, x, y, w, h, extra) {
  return { id, type, x, y, w, h, visible: true, collapsed: false, locked: false, design: { accent: null, glow: false }, ...extra };
}

function estado(modules) {
  return { schemaVersion: 1, activeProfile: 'padrao', profiles: { padrao: { name: 'Padrão', modules } } };
}

function semSobreposicao(state) {
  const visiveis = mods(state).filter((m) => m.visible);
  for (let i = 0; i < visiveis.length; i += 1) {
    for (let j = i + 1; j < visiveis.length; j += 1) {
      assert.equal(L.collides(visiveis[i], visiveis[j]), false, `${visiveis[i].id} e ${visiveis[j].id} se sobrepõem`);
    }
  }
}

describe('defaults e validate', () => {
  it('defaults: 4 baías em 2x2, 6 colunas e 34 linhas, e valida', () => {
    const d = L.defaults();
    assert.equal(d.activeProfile, 'padrao');
    assert.deepEqual(mods(d).map((m) => [m.id, m.x, m.y, m.w, m.h]), [
      ['bay-0', 0, 0, 6, 34], ['bay-1', 6, 0, 6, 34], ['bay-2', 0, 34, 6, 34], ['bay-3', 6, 34, 6, 34],
    ]);
    assert.equal(L.validate(d).ok, true);
  });

  it('defaults devolve objeto novo a cada chamada', () => {
    assert.notEqual(L.defaults(), L.defaults());
  });

  it('validate aponta erros de um estado quebrado', () => {
    const r = L.validate({ schemaVersion: 2, activeProfile: 'x', profiles: {} });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.path === 'schemaVersion'));
    assert.ok(r.errors.some((e) => e.path === 'activeProfile'));
  });

  it('validate recusa sobreposição e baía faltando', () => {
    const r = L.validate(estado([mk('bay-0', 'bay', 0, 0, 6, 34), mk('bay-1', 'bay', 0, 0, 6, 34)]));
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /sobrepõe/.test(e.msg)));
    assert.ok(r.errors.some((e) => /falta a baía bay-2/.test(e.msg)));
  });
});

describe('normalize', () => {
  it('lixo, null, undefined, array, texto e número devolvem defaults()', () => {
    for (const raw of [null, undefined, [], 'bay-0', 42, true, { profiles: 3 }, {}]) {
      assert.deepEqual(L.normalize(raw), L.defaults(), String(raw));
    }
  });

  it('corrige valores fora dos limites do tipo e da grade', () => {
    const s = L.normalize(estado([
      mk('bay-0', 'bay', 0, 100, 2, 5),
      mk('bay-1', 'bay', 0, 200, 20, 900),
      mk('bay-2', 'bay', -4, -3, 6, 34),
      mk('bay-3', 'bay', 10, 0, 6, 34),
    ]));
    assert.deepEqual([mod(s, 'bay-0').w, mod(s, 'bay-0').h], [3, 12]);
    assert.deepEqual([mod(s, 'bay-1').w, mod(s, 'bay-1').h], [12, 80]);
    assert.equal(mod(s, 'bay-2').x, 0);
    assert.equal(mod(s, 'bay-2').y, 0);
    assert.equal(mod(s, 'bay-3').x, 6, 'x + w > 12 vira x = 12 - w');
    assert.equal(L.validate(s).ok, true);
  });

  it('resolve sobreposição de entrada empurrando para baixo', () => {
    const s = L.normalize(estado([
      mk('bay-0', 'bay', 0, 0, 6, 34),
      mk('bay-1', 'bay', 0, 0, 6, 34),
      mk('bay-2', 'bay', 6, 0, 6, 34),
      mk('bay-3', 'bay', 6, 34, 6, 34),
    ]));
    assert.equal(mod(s, 'bay-0').y, 0);
    assert.equal(mod(s, 'bay-1').y, 34);
    semSobreposicao(s);
  });

  it('descarta tipo desconhecido e id repetido, mantendo a primeira ocorrência', () => {
    const s = L.normalize(estado([
      mk('lixo-0', 'lixo', 0, 0, 6, 34),
      mk('bay-0', 'bay', 0, 0, 6, 34),
      mk('bay-0', 'bay', 6, 0, 3, 12),
      mk('bay-1', 'bay', 6, 0, 6, 34),
      mk('bay-2', 'bay', 0, 34, 6, 34),
      mk('bay-3', 'bay', 6, 34, 6, 34),
    ]));
    assert.equal(mods(s).some((m) => m.id === 'lixo-0'), false);
    assert.equal(mod(s, 'bay-0').w, 6);
    assert.equal(mods(s).filter((m) => m.id === 'bay-0').length, 1);
  });

  it('recria baías ausentes como ocultas', () => {
    const s = L.normalize(estado([mk('bay-0', 'bay', 0, 0, 6, 34)]));
    assert.equal(mods(s).length, 4);
    assert.equal(mod(s, 'bay-1').visible, false);
    assert.equal(mod(s, 'bay-0').visible, true);
  });

  it('normalize é ponto fixo: normalizar de novo não muda nada', () => {
    const suja = estado([
      mk('bay-0', 'bay', 0, 0, 6, 34), mk('bay-1', 'bay', 2, 0, 6, 34, { visible: false }),
      mk('captures', 'captures', 0, 0, 5, 20), mk('kpi-1', 'kpi', 4, 4, 3, 12),
    ]);
    const uma = L.normalize(suja);
    assert.deepEqual(L.normalize(uma), uma);
  });

  it('corta acima de 32 módulos sem tirar as baías, e limita a 8 perfis', () => {
    const modulos = [];
    for (let n = 0; n < 24; n += 1) modulos.push(mk(`kpi-${n}`, 'kpi', 0, 0, 3, 12));
    modulos.push(mk('captures', 'captures', 0, 0, 6, 24), mk('procs', 'procs', 0, 0, 6, 24));
    modulos.push(mk('bay-0', 'bay', 0, 0, 6, 34), mk('bay-1', 'bay', 0, 0, 6, 34), mk('bay-2', 'bay', 0, 0, 6, 34), mk('bay-3', 'bay', 0, 0, 6, 34));
    const s = L.normalize(estado(modulos));
    assert.ok(mods(s).length <= 32);
    for (const id of ['bay-0', 'bay-1', 'bay-2', 'bay-3']) assert.ok(mods(s).some((m) => m.id === id), id);

    const perfis = {};
    for (let n = 0; n < 10; n += 1) perfis[`p${n}`] = { name: `P${n}`, modules: [] };
    const p = L.normalize({ schemaVersion: 1, activeProfile: 'p0', profiles: perfis });
    assert.equal(Object.keys(p.profiles).length, 8);
  });
});

describe('move, resize e locked', () => {
  it('move sobre um ocupado empurra o outro para baixo', () => {
    const s = L.move(L.defaults(), 'bay-0', { x: 6, y: 0 });
    assert.equal(mod(s, 'bay-0').x, 6);
    assert.equal(mod(s, 'bay-0').y, 0);
    assert.equal(mod(s, 'bay-1').y, 34, 'bay-1 foi empurrada para baixo');
    semSobreposicao(s);
  });

  it('move não muda a entrada', () => {
    const d = deepFreeze(L.defaults());
    const antes = JSON.stringify(d);
    L.move(d, 'bay-0', { x: 6, y: 0 });
    assert.equal(JSON.stringify(d), antes);
  });

  it('locked não se move, e nada se move para cima dele', () => {
    const s = estado([
      mk('bay-0', 'bay', 0, 0, 6, 34, { locked: true }),
      mk('bay-1', 'bay', 6, 0, 6, 34),
      mk('bay-2', 'bay', 0, 34, 6, 34),
      mk('bay-3', 'bay', 6, 34, 6, 34),
    ]);
    assert.equal(L.move(s, 'bay-0', { x: 6, y: 0 }), s, 'locked não sai do lugar');
    assert.equal(L.move(s, 'bay-1', { x: 0, y: 0 }), s, 'não entra sobre um locked');
    const c = L.compact(mods(s));
    assert.equal(c.find((m) => m.id === 'bay-0').y, 0);
  });

  it('resize acima de maxW e maxH é limitado, e abaixo de minW e minH sobe ao mínimo', () => {
    const grande = L.resize(L.defaults(), 'bay-0', { w: 99, h: 999 });
    assert.deepEqual([mod(grande, 'bay-0').w, mod(grande, 'bay-0').h], [12, 80]);
    const pequeno = L.resize(L.defaults(), 'bay-0', { w: 1, h: 1 });
    assert.deepEqual([mod(pequeno, 'bay-0').w, mod(pequeno, 'bay-0').h], [3, 12]);
    semSobreposicao(grande);
  });
});

describe('compactação, projeção e modo de tamanho', () => {
  it('compact é estável por (y, x) e não move locked', () => {
    const lista = [
      mk('captures', 'captures', 6, 30, 6, 10),
      mk('procs', 'procs', 0, 5, 6, 10),
      mk('kpi-0', 'kpi', 0, 20, 12, 10, { locked: true }),
    ];
    const c = L.compact(lista);
    assert.deepEqual(c.map((m) => m.id), ['captures', 'procs', 'kpi-0'], 'ordem da entrada preservada');
    assert.equal(c[1].y, 0, 'procs sobe para o topo');
    assert.equal(c[2].y, 20, 'locked fica onde está');
    assert.equal(c[0].y, 30, 'captures não passa do locked');
    assert.deepEqual(L.compact(c), c, 'compactar de novo não muda');
  });

  it('project para 1 coluna preserva a ordem por (y, x) e não grava', () => {
    const lista = [mk('a', 'kpi', 0, 0, 6, 10), mk('b', 'kpi', 6, 0, 6, 10), mk('c', 'kpi', 0, 20, 6, 10)];
    const antes = JSON.stringify(lista);
    const p = L.project(lista, 1);
    assert.deepEqual(p.map((m) => m.id), ['a', 'b', 'c']);
    assert.ok(p.every((m) => m.x === 0 && m.w === 1));
    assert.ok(p[0].y < p[1].y && p[1].y < p[2].y);
    assert.equal(JSON.stringify(lista), antes);
  });

  it('project para 12 colunas mantém as posições', () => {
    const lista = [mk('a', 'kpi', 3, 2, 6, 10)];
    assert.deepEqual(L.project(lista, 12), [{ id: 'a', x: 3, y: 2, w: 6, h: 10 }]);
  });

  it('sizeMode nos limiares exatos', () => {
    assert.equal(L.sizeMode({ w: 3, h: 40 }), 'micro');
    assert.equal(L.sizeMode({ w: 4, h: 40 }), 'padrao');
    assert.equal(L.sizeMode({ w: 8, h: 10 }), 'micro');
    assert.equal(L.sizeMode({ w: 8, h: 11 }), 'padrao');
    assert.equal(L.sizeMode({ w: 8, h: 40 }), 'expandido');
    assert.equal(L.sizeMode({ w: 8, h: 39 }), 'padrao');
    assert.equal(L.sizeMode({ w: 7, h: 40 }), 'padrao');
  });

  it('snap converte px em unidades de grade', () => {
    // Contêiner de 1000 px: coluna de 76 px, passo de 84 px.
    assert.deepEqual(L.snap({ x: 84, y: 0, width: 496, height: 340 }, { width: 1000 }), { x: 1, y: 0, w: 6, h: 34 });
    assert.equal(L.snap({ x: 0, y: 0, width: 100, height: 100 }, { width: 0 }), null);
  });
});

describe('remove e add', () => {
  it('remove de baía visível só a oculta; de baía já oculta não muda nada', () => {
    const s = L.remove(L.defaults(), 'bay-1');
    assert.equal(mod(s, 'bay-1').visible, false);
    assert.equal(mods(s).length, 4);
    assert.equal(L.remove(s, 'bay-1'), s);
  });

  it('remove de kpi apaga o módulo', () => {
    const s = L.add(L.defaults(), 'kpi');
    assert.ok(mod(s, 'kpi-0'));
    const r = L.remove(s, 'kpi-0');
    assert.equal(mod(r, 'kpi-0'), undefined);
    assert.equal(mods(r).length, 4);
  });

  it('add reexibe uma baía oculta', () => {
    const oculta = L.remove(L.defaults(), 'bay-2');
    const s = L.add(oculta, 'bay');
    assert.equal(mod(s, 'bay-2').visible, true);
    semSobreposicao(s);
  });

  it('add acima de 32 módulos é recusado e devolve o mesmo estado', () => {
    let s = L.defaults();
    for (const tipo of ['captures', 'procs', 'twitch', 'twitch-bay', 'twitch-bay', 'twitch-bay', 'twitch-bay']) s = L.add(s, tipo);
    for (let n = 0; n < 21; n += 1) s = L.add(s, 'kpi');
    assert.equal(mods(s).length, 32);
    assert.equal(L.validate(s).ok, true);
    assert.equal(L.add(s, 'kpi'), s);
  });

  it('add de tipo único já visível é recusado', () => {
    const s = L.add(L.defaults(), 'captures');
    assert.equal(L.add(s, 'captures'), s);
  });

  it('add com tipo desconhecido ou operação inválida não lança', () => {
    const d = L.defaults();
    assert.equal(L.add(d, 'lixo'), d);
    assert.equal(L.remove(d, 'nada'), d);
    assert.equal(L.resize(d, 'bay-0', { w: 'x' }), d);
    assert.equal(L.move(d, 'bay-0', { x: NaN, y: 0 }), d);
  });
});

describe('perfis', () => {
  it('salvar, trocar, resetar e recusar apagar o último', () => {
    let s = L.saveProfile(L.defaults(), 'foco', 'Foco');
    assert.equal(s.activeProfile, 'foco');
    assert.equal(Object.keys(s.profiles).length, 2);
    s = L.switchProfile(s, 'padrao');
    assert.equal(s.activeProfile, 'padrao');
    s = L.resetProfile(s, 'foco');
    assert.equal(s.profiles.foco.name, 'Foco');
    assert.deepEqual(s.profiles.foco.modules, L.defaults().profiles.padrao.modules);
    const unico = L.defaults();
    assert.equal(L.deleteProfile(unico, 'padrao'), unico, 'recusa apagar o último');
  });

  it('apagar o perfil ativo passa o ativo para outro', () => {
    const s = L.deleteProfile(L.saveProfile(L.defaults(), 'foco', 'Foco'), 'foco');
    assert.equal(s.activeProfile, 'padrao');
    assert.equal(Object.keys(s.profiles).length, 1);
  });

  it('salvar recusa o nono perfil', () => {
    let s = L.defaults();
    for (let n = 1; n < 8; n += 1) s = L.saveProfile(s, `p${n}`, `P${n}`);
    assert.equal(Object.keys(s.profiles).length, 8);
    assert.equal(L.saveProfile(s, 'nono', 'Nono'), s);
  });
});

describe('fromLegacy', () => {
  it('h 0 vira defH, h em px vira linhas, span inválido vira 6', () => {
    const s = L.fromLegacy({
      bays: [
        { box: { span: 6, h: 0 } },
        { box: { span: 'x', h: 500 } },
        { box: { span: 20, h: 250 } },
        { box: { span: 9, h: 340 } },
      ],
    });
    assert.equal(mod(s, 'bay-0').h, 34);
    assert.equal(mod(s, 'bay-1').w, 6);
    assert.equal(mod(s, 'bay-1').h, 50);
    assert.equal(mod(s, 'bay-2').w, 6);
    assert.equal(mod(s, 'bay-2').h, 25);
    assert.equal(mod(s, 'bay-3').w, 9);
    assert.equal(L.validate(s).ok, true);
  });

  it('Espera: hidden vira visible, e a Twitch sem hidden nasce oculta', () => {
    const s = L.fromLegacy({
      standby: {
        order: ['twitch', 'captures'],
        widgets: { twitch: { span: 2, hidden: false }, captures: { span: 1, hidden: true, collapsed: true } },
      },
    });
    assert.equal(mod(s, 'twitch').visible, true);
    assert.equal(mod(s, 'twitch').w, 12);
    assert.equal(mod(s, 'captures').visible, false);
    assert.equal(mod(s, 'captures').collapsed, true);
    const semCampo = L.fromLegacy({ standby: { order: ['twitch-bay-0'], widgets: {} } });
    assert.equal(mod(semCampo, 'twitch-bay-0').visible, false);
  });

  it('cfg vazio ou lixo não lança', () => {
    assert.deepEqual(L.fromLegacy(null), L.defaults());
    assert.equal(L.validate(L.fromLegacy({ bays: 'x', standby: [] })).ok, true);
  });
});

describe('imutabilidade e terminação', () => {
  it('operações não mudam estado congelado, mesmo com push e compactação', () => {
    const s = deepFreeze(L.add(L.defaults(), 'captures'));
    const antes = JSON.stringify(s);
    assert.doesNotThrow(() => {
      L.move(s, 'bay-0', { x: 6, y: 0 });
      L.resize(s, 'bay-0', { w: 12, h: 80 });
      L.remove(s, 'captures');
      L.saveProfile(s, 'foco', 'Foco');
      L.compact(mods(s));
    });
    assert.equal(JSON.stringify(s), antes);
  });

  it('empilhamento máximo termina e sai sem sobreposição', () => {
    const modulos = [];
    for (let n = 0; n < 24; n += 1) modulos.push(mk(`kpi-${n}`, 'kpi', 0, 0, 12, 40));
    for (let n = 0; n < 4; n += 1) modulos.push(mk(`bay-${n}`, 'bay', 0, 0, 12, 80));
    const s = L.normalize(estado(modulos));
    assert.equal(L.validate(s).ok, true);
    semSobreposicao(s);
  });
});

describe('arquivo de exemplo e schema', () => {
  it('normalize(exemplo) é igual ao exemplo, e o exemplo valida', () => {
    const exemplo = JSON.parse(fs.readFileSync(EXEMPLO, 'utf8'));
    assert.equal(L.validate(exemplo).ok, true);
    assert.deepStrictEqual(L.normalize(exemplo), exemplo);
  });

  it('o schema parseia e o required do módulo bate com as chaves do motor', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    const required = [...schema.$defs.modulo.required].sort();
    const motor = [...Object.keys(L.defaults().profiles.padrao.modules[0])].sort();
    assert.deepStrictEqual(required, motor);
    assert.deepStrictEqual([...L.MODULE_KEYS].sort(), motor);
  });

  it('os enums do schema batem com os tipos e acentos do motor', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
    assert.deepStrictEqual([...schema.$defs.modulo.properties.type.enum].sort(), Object.keys(L.TYPES).sort());
    const acentos = schema.$defs.design.properties.accent.enum.filter((a) => a !== null);
    assert.deepStrictEqual([...acentos].sort(), [...L.ACCENTS].sort());
  });

  it('guarda estrutural (forma do schema): if/then por tipo amarra o id (captures, procs, twitch, pokecalc) e name exige não-espaço', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
    for (const tipo of ['captures', 'procs', 'twitch', 'pokecalc']) {
      const bloco = schema.$defs.modulo.allOf.find((b) => b.if.properties.type.const === tipo);
      assert.ok(bloco, `if/then de ${tipo}`);
      assert.equal(bloco.then.properties.id.const, tipo);
    }
    assert.equal(schema.$defs.perfil.properties.name.pattern, '\\S');
  });

  it('comportamento (sem lib): o id que o if/then aceita para cada tipo é o que o motor gera', () => {
    const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
    for (const tipo of ['captures', 'procs', 'twitch', 'pokecalc']) {
      const bloco = schema.$defs.modulo.allOf.find((b) => b.if.properties.type.const === tipo);
      const aceito = (id) => id === bloco.then.properties.id.const;
      const gerado = L.add(L.defaults(), tipo).profiles.padrao.modules.find((m) => m.type === tipo).id;
      assert.equal(aceito(gerado), true, `${tipo} gera ${gerado}`);
      assert.equal(aceito('lixo-0'), false);
    }
    const capt = schema.$defs.modulo.allOf.find((b) => b.if.properties.type.const === 'captures');
    assert.equal(capt.then.properties.id.const === 'procs', false, 'captures não aceita id de procs');
  });
});

describe('revisão: locked, limites e contrato de estado inválido', () => {
  it('compact termina e limita y extremo, infinito, NaN e negativo', () => {
    for (const y of [1e20, Infinity, NaN, -5]) {
      const [m] = L.compact([{ id: 'kpi-0', type: 'kpi', x: 0, y, w: 3, h: 12, visible: true, locked: false }]);
      assert.ok(Number.isInteger(m.y) && m.y >= 0 && m.y <= 10000, `y ${y} virou ${m.y}`);
    }
  });

  it('compact com y grande ao lado de outro módulo termina e fica dentro da grade', () => {
    const c = L.compact([mk('kpi-0', 'kpi', 0, 1e20, 3, 12), mk('kpi-1', 'kpi', 0, 5, 3, 12)]);
    assert.ok(c.every((m) => m.y >= 0 && m.y <= 10000));
    assert.equal(c.find((m) => m.id === 'kpi-1').y, 0);
  });

  it('remove de kpi locked devolve o mesmo estado e não apaga', () => {
    const s = L.add(L.defaults(), 'kpi');
    const trancado = estado(mods(s).map((m) => (m.id === 'kpi-0' ? { ...m, locked: true } : m)));
    assert.equal(L.remove(trancado, 'kpi-0'), trancado);
    assert.ok(mod(L.remove(trancado, 'kpi-0'), 'kpi-0'));
  });

  it('remove de baía locked não oculta', () => {
    const d = L.defaults();
    const s = estado(mods(d).map((m) => (m.id === 'bay-1' ? { ...m, locked: true } : m)));
    assert.equal(L.remove(s, 'bay-1'), s);
    assert.equal(mod(s, 'bay-1').visible, true);
  });

  it('resize de módulo locked é recusado e devolve o mesmo estado', () => {
    const s = estado(mods(L.defaults()).map((m) => (m.id === 'bay-0' ? { ...m, locked: true } : m)));
    assert.equal(L.resize(s, 'bay-0', { w: 8, h: 20 }), s);
  });

  it('caracterização: project para 6 colunas reduz w e x pela metade sem sobrepor', () => {
    const p = L.project([mk('a', 'kpi', 0, 0, 12, 10), mk('b', 'kpi', 6, 20, 6, 10)], 6);
    assert.deepEqual(p.find((m) => m.id === 'a'), { id: 'a', x: 0, y: 0, w: 6, h: 10 });
    assert.deepEqual(p.find((m) => m.id === 'b'), { id: 'b', x: 3, y: 20, w: 3, h: 10 });
  });

  it('snap aceita largura em string e recusa campo que não é número', () => {
    assert.deepEqual(L.snap({ x: 0, y: 0, width: '496', height: 340 }, { width: 1000 }), { x: 0, y: 0, w: 6, h: 34 });
    assert.equal(L.snap({ x: 'x', y: 0, width: 100, height: 100 }, { width: 1000 }), null);
  });

  it('caracterização: saveProfile com nome só de espaços usa o id como nome', () => {
    assert.equal(L.saveProfile(L.defaults(), 'foco', '   ').profiles.foco.name, 'foco');
  });

  it('as 8 operações com estado inválido devolvem estado válido', () => {
    const lixos = [undefined, null, 'x', NaN, [], {}, { profiles: 5 }];
    const ops = [
      (s) => L.move(s, 'bay-0', { x: 0, y: 0 }),
      (s) => L.resize(s, 'bay-0', { w: 6, h: 34 }),
      (s) => L.add(s, 'kpi'),
      (s) => L.remove(s, 'bay-0'),
      (s) => L.saveProfile(s, 'foco', 'Foco'),
      (s) => L.switchProfile(s, 'padrao'),
      (s) => L.resetProfile(s, 'padrao'),
      (s) => L.deleteProfile(s, 'padrao'),
    ];
    for (const lixo of lixos) {
      for (const op of ops) assert.equal(L.validate(op(lixo)).ok, true, String(lixo));
    }
  });

  it('pokecalc: fromLegacy cria o singleton, oculto por padrão, e add reexibe', () => {
    const s = L.fromLegacy({ standby: { order: ['pokecalc'], widgets: { pokecalc: { span: 2, hidden: false } } } });
    assert.equal(mod(s, 'pokecalc').type, 'pokecalc');
    assert.equal(mod(s, 'pokecalc').w, 12);
    assert.equal(mod(s, 'pokecalc').visible, true);
    assert.equal(L.validate(s).ok, true);
    const sem = L.fromLegacy({ standby: { order: ['pokecalc'], widgets: {} } });
    assert.equal(mod(sem, 'pokecalc').visible, false);
    assert.equal(mod(L.add(sem, 'pokecalc'), 'pokecalc').visible, true);
    const uma = L.add(sem, 'pokecalc');
    assert.equal(L.add(uma, 'pokecalc'), uma, 'singleton já visível é recusado');
  });

  it('fromLegacy cobre os 12 ids da Espera', () => {
    const ids = ['captures', 'bay-0', 'bay-1', 'bay-2', 'bay-3', 'procs', 'twitch', 'twitch-bay-0', 'twitch-bay-1', 'twitch-bay-2', 'twitch-bay-3', 'pokecalc'];
    const s = L.fromLegacy({ bays: [], standby: { order: ids, widgets: {} } });
    const achados = mods(s).map((m) => m.id);
    for (const id of ids) assert.ok(achados.includes(id), `falta ${id}`);
  });

  it('GRID e TYPES são congelados', () => {
    assert.equal(Object.isFrozen(L.GRID), true);
    assert.equal(Object.isFrozen(L.TYPES), true);
    assert.equal(Object.isFrozen(L.TYPES.bay), true);
    assert.throws(() => { L.TYPES.bay.maxW = 99; }, TypeError);
  });

  it('project ignora módulo com w NaN, sem lançar e sem devolver x ou w nulos', () => {
    const p = L.project([mk('a', 'kpi', 0, 0, NaN, 10), mk('b', 'kpi', 0, 20, 6, 10)], 6);
    assert.deepEqual(p.map((m) => m.id), ['b']);
    assert.ok(p.every((m) => Number.isFinite(m.x) && Number.isFinite(m.w)));
  });

  it('compact descarta item inválido e devolve lista vazia', () => {
    assert.deepEqual(L.compact([{ id: 'lixo', type: 'lixo', x: 0, y: 0, w: 3, h: 12, visible: true, locked: false }]), []);
  });

  it('compact aplica o clamp do tipo: captures com w 2 vira 4, h 200 vira 80', () => {
    const [m] = L.compact([mk('captures', 'captures', 0, 0, 2, 200)]);
    assert.equal(m.w, 4);
    assert.equal(m.h, 80);
  });

  it('snap recusa null, undefined, string vazia e booleanos', () => {
    for (const v of [null, undefined, '', '   ', true, false]) {
      assert.equal(L.snap({ x: v, y: 0, width: 100, height: 100 }, { width: 1000 }), null, String(v));
    }
    assert.equal(L.snap({ x: 0, y: 0, width: 100, height: 100 }, { width: null }), null);
  });
});

function travado(s, id, patch) {
  return { ...s, profiles: { padrao: { name: 'Padrão', modules: mods(s).map((m) => (m.id === id ? { ...m, locked: true, ...patch } : m)) } } };
}

function rng(seed) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x80000000;
  };
}

describe('reset preserva travados; normalize fixa travados; compact e entrada fora da grade', () => {
  it('(a) reset: bay-0 travado em x6 y20 sobrevive igual', () => {
    const s = L.normalize(travado(L.defaults(), 'bay-0', { x: 6, y: 20 }));
    const antes = mod(s, 'bay-0');
    const out = L.resetProfile(s, 'padrao');
    assert.deepEqual(mod(out, 'bay-0'), antes);
    assert.equal(L.validate(out).ok, true);
  });

  it('(b) reset: travado oculto sobrevive oculto, na mesma posição', () => {
    const s = L.normalize(travado(L.defaults(), 'bay-2', { visible: false, x: 0, y: 0 }));
    const out = L.resetProfile(s, 'padrao');
    assert.deepEqual([mod(out, 'bay-2').visible, mod(out, 'bay-2').locked, mod(out, 'bay-2').x, mod(out, 'bay-2').y], [false, true, 0, 0]);
  });

  it('(c) reset: padrão destravado que colide com travado é empurrado; o travado não se mexe', () => {
    const s = L.normalize(travado(L.defaults(), 'bay-0', { x: 6, y: 20 }));
    const out = L.resetProfile(s, 'padrao');
    assert.deepEqual([mod(out, 'bay-0').x, mod(out, 'bay-0').y], [6, 20]);
    assert.equal(mod(out, 'bay-1').locked, false);
    assert.ok(mod(out, 'bay-1').y >= 54, `bay-1 empurrado, y=${mod(out, 'bay-1').y}`);
    semSobreposicao(out);
  });

  it('(d) reset: kpi destravado some e kpi travado fica', () => {
    let s = L.add(L.add(L.defaults(), 'kpi'), 'kpi');
    s = L.normalize(travado(s, 'kpi-1'));
    const out = L.resetProfile(s, 'padrao');
    assert.equal(mod(out, 'kpi-0'), undefined);
    assert.ok(mod(out, 'kpi-1'), 'kpi travado fica');
    assert.equal(mod(out, 'kpi-1').locked, true);
  });

  it('(e) reset sem travados: igual ao defaults() do perfil (regressão)', () => {
    const s = L.saveProfile(L.add(L.defaults(), 'kpi'), 'foco', 'Foco');
    const out = L.resetProfile(s, 'foco');
    assert.deepEqual(mods(out), L.defaults().profiles.padrao.modules);
    const d = L.defaults();
    assert.equal(L.resetProfile(d, 'nada'), d, 'perfil inexistente é recusado');
  });

  it('(f) reset: saída passa em validate e não compartilha objeto com a entrada', () => {
    const s = L.normalize(travado(L.defaults(), 'bay-0', { x: 6, y: 20 }));
    const antes = JSON.stringify(s);
    const out = L.resetProfile(s, 'padrao');
    assert.equal(L.validate(out).ok, true);
    assert.notEqual(out, s);
    mutaTudo(out);
    assert.equal(JSON.stringify(s), antes);
  });

  it('(g) reset, 200 estados aleatórios: travado nunca muda; resultado sempre válido', () => {
    const IDS = ['bay-0', 'bay-1', 'bay-2', 'bay-3', 'captures', 'procs', 'twitch', 'pokecalc', 'twitch-bay-0', 'twitch-bay-1', 'kpi-0', 'kpi-1', 'kpi-2'];
    const r = rng(42);
    for (let i = 0; i < 200; i += 1) {
      const modulos = [];
      for (const id of IDS) {
        if (r() < 0.5) continue;
        const type = id.startsWith('bay-') ? 'bay' : id.startsWith('twitch-bay-') ? 'twitch-bay' : id.startsWith('kpi-') ? 'kpi' : id;
        modulos.push({
          id, type,
          x: Math.floor(r() * 12), y: Math.floor(r() * 60),
          w: 3 + Math.floor(r() * 10), h: 6 + Math.floor(r() * 40),
          visible: r() < 0.8, collapsed: r() < 0.3, locked: r() < 0.3,
          design: { accent: null, glow: false },
        });
      }
      const st = L.normalize(estado(modulos));
      assert.equal(L.validate(st).ok, true, `entrada ${i}`);
      const out = L.resetProfile(st, 'padrao');
      for (const m of mods(st).filter((x) => x.locked)) {
        assert.deepEqual(mod(out, m.id), m, `travado ${m.id} mudou na rodada ${i}`);
      }
      assert.equal(L.validate(out).ok, true, `saída ${i}`);
    }
  });

  it('normalize: bay-1 travado sobre bay-0 fica; bay-0 destravado é empurrado', () => {
    const s = L.normalize(estado(mods(L.defaults()).map((m) => (m.id === 'bay-1' ? { ...m, locked: true, x: 0, y: 0 } : m))));
    assert.deepEqual([mod(s, 'bay-1').x, mod(s, 'bay-1').y, mod(s, 'bay-1').locked], [0, 0, true]);
    assert.equal(mod(s, 'bay-0').y, 34);
    assert.equal(mod(s, 'bay-0').locked, false);
    assert.deepEqual(L.normalize(s), s, 'idempotente');
  });

  it('normalize: dois travados sobrepostos — o primeiro na entrada fica, o segundo é empurrado e continua travado', () => {
    const s = L.normalize(estado(mods(L.defaults()).map((m) => (m.id === 'bay-0' || m.id === 'bay-1' ? { ...m, locked: true, x: 0, y: 0 } : m))));
    assert.deepEqual([mod(s, 'bay-0').y, mod(s, 'bay-0').locked], [0, true]);
    assert.equal(mod(s, 'bay-1').locked, true);
    assert.ok(mod(s, 'bay-1').y > 0, 'segundo travado foi empurrado (exceção documentada)');
    semSobreposicao(s);
    assert.deepEqual(L.normalize(s), s, 'idempotente');
  });

  it('compact: travado com y=20000 vai para 10000; travado válido não muda', () => {
    const [fora, valido] = L.compact([
      mk('kpi-0', 'kpi', 0, 20000, 3, 12, { locked: true }),
      mk('kpi-1', 'kpi', 6, 20, 3, 12, { locked: true }),
    ]);
    assert.equal(fora.y, 10000);
    assert.equal(valido.y, 20);
  });
});

function mutaTudo(o) {
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === 'object') mutaTudo(v);
    else if (typeof v === 'number') o[k] = v + 1000;
    else if (typeof v === 'string') o[k] = `${v}!`;
    else if (typeof v === 'boolean') o[k] = !v;
  }
}

describe('aliasing, locked no add e chaves extras', () => {
  const casos = {
    move: [() => L.defaults(), (s) => L.move(s, 'bay-0', { x: 6, y: 0 })],
    resize: [() => L.defaults(), (s) => L.resize(s, 'bay-0', { w: 8, h: 40 })],
    add: [() => L.defaults(), (s) => L.add(s, 'captures')],
    remove: [() => L.defaults(), (s) => L.remove(s, 'bay-1')],
    saveProfile: [() => L.defaults(), (s) => L.saveProfile(s, 'foco', 'Foco')],
    switchProfile: [() => L.saveProfile(L.defaults(), 'foco', 'Foco'), (s) => L.switchProfile(s, 'padrao')],
    resetProfile: [() => L.saveProfile(L.defaults(), 'foco', 'Foco'), (s) => L.resetProfile(s, 'foco')],
    deleteProfile: [() => L.saveProfile(L.defaults(), 'foco', 'Foco'), (s) => L.deleteProfile(s, 'foco')],
  };

  for (const [nome, [entrada, op]] of Object.entries(casos)) {
    it(`${nome}: mutar a saída não altera a entrada`, () => {
      const inp = entrada();
      const antes = JSON.stringify(inp);
      const out = op(inp);
      assert.notEqual(out, inp, 'operação aplicada devolve objeto novo');
      mutaTudo(out);
      assert.equal(JSON.stringify(inp), antes);
    });
  }

  it('add não revela nem move baía oculta e travada; recusa se ela for o único candidato', () => {
    const d = L.defaults();
    const st = L.normalize(estado(mods(d).map((m) => (m.id === 'bay-0' ? { ...m, visible: false, locked: true, x: 6, y: 0 } : m))));
    assert.equal(L.add(st, 'bay'), st);
    assert.deepEqual([mod(st, 'bay-0').x, mod(st, 'bay-0').y, mod(st, 'bay-0').visible], [6, 0, false]);
    const outro = L.normalize(estado(mods(d).map((m) => {
      if (m.id === 'bay-0') return { ...m, visible: false, locked: true, x: 6, y: 0 };
      if (m.id === 'bay-1') return { ...m, visible: false };
      return m;
    })));
    const r = L.add(outro, 'bay');
    assert.equal(mod(r, 'bay-1').visible, true, 'destravado oculto é revelado');
    assert.deepEqual([mod(r, 'bay-0').x, mod(r, 'bay-0').y, mod(r, 'bay-0').visible], [6, 0, false]);
  });

  it('add nunca altera x/y de módulo travado, para nenhum tipo', () => {
    const d = L.defaults();
    const st = L.normalize(estado(mods(d).map((m) => (m.id === 'bay-0' ? { ...m, visible: false, locked: true, x: 6, y: 0 } : m))));
    for (const tipo of ['bay', 'captures', 'procs', 'twitch', 'twitch-bay', 'kpi', 'pokecalc']) {
      const r = L.add(st, tipo);
      assert.deepEqual([mod(r, 'bay-0').x, mod(r, 'bay-0').y], [6, 0], tipo);
    }
  });

  it('chave extra em módulo, perfil ou estado: validate recusa, normalize limpa, operação não a carrega', () => {
    const d = L.defaults();
    const comModulo = { ...d, profiles: { padrao: { name: 'Padrão', modules: mods(d).map((m, i) => (i === 0 ? { ...m, foo: 1 } : m)) } } };
    const comPerfil = { ...d, profiles: { padrao: { name: 'Padrão', modules: mods(d), extra: 1 } } };
    const comEstado = { ...d, extra: 1 };
    for (const st of [comModulo, comPerfil, comEstado]) {
      assert.equal(L.validate(st).ok, false);
      const limpo = L.normalize(st);
      assert.equal(L.validate(limpo).ok, true);
      assert.equal(/"foo"|"extra"/.test(JSON.stringify(limpo)), false);
    }
    const saida = L.add(comModulo, 'captures');
    assert.equal(/"foo"|"extra"/.test(JSON.stringify(saida)), false);
  });
});
