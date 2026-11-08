// Motor puro do layout de módulos do board: grade de 12 colunas, linha de 10 px, gap de 8 px.
// Não lê nem grava arquivo. Quem chama guarda o resultado em cfg.board (ligação futura).
// Nunca muda a entrada. Operação que muda o estado devolve cópia profunda (nenhum objeto compartilhado com a entrada).
// Operação recusada num estado válido devolve a própria referência. Estado inválido de entrada passa por normalize,
// então a saída é sempre um estado válido, com a operação aplicada ou recusada.
var MesaBoardLayout = (function boardLayoutModule() {
  'use strict';

  const GRID = Object.freeze({ cols: 12, rowPx: 10, gapPx: 8 });
  // Teto de linhas. A soma das alturas de 32 módulos (até 80 cada) fica abaixo disso.
  const ROWS_MAX = 10000;
  const MAX_PROFILES = 8;
  const MAX_MODULES = 32;
  const NAME_MAX = 40;
  const ACCENTS = ['ciano', 'roxo', 'magenta', 'dourado', 'lima'];
  const PROFILE_ID = /^[a-z0-9-]{1,32}$/;
  const MODULE_KEYS = ['id', 'type', 'x', 'y', 'w', 'h', 'visible', 'collapsed', 'locked', 'design'];
  const STATE_KEYS = ['schemaVersion', 'activeProfile', 'profiles'];
  const PROFILE_KEYS = ['name', 'modules'];
  const DESIGN_KEYS = ['accent', 'glow'];

  // Limites por tipo, em unidades de grade (w em colunas, h em linhas de 10 px).
  // multi = quantos módulos do tipo cabem. Com multi 1 o id é o próprio tipo; senão é `tipo-n`.
  const TYPES = {
    bay: { minW: 3, maxW: 12, minH: 12, maxH: 80, defW: 6, defH: 34, live: true, multi: 4 },
    // Tipos sem dado vivo. Limites iniciais, a rever quando a tela existir.
    captures: { minW: 4, maxW: 12, minH: 12, maxH: 80, defW: 6, defH: 24, live: false, multi: 1 },
    procs: { minW: 4, maxW: 12, minH: 12, maxH: 80, defW: 6, defH: 24, live: false, multi: 1 },
    twitch: { minW: 4, maxW: 12, minH: 12, maxH: 80, defW: 6, defH: 24, live: false, multi: 1 },
    'twitch-bay': { minW: 3, maxW: 12, minH: 8, maxH: 60, defW: 3, defH: 20, live: false, multi: 4 },
    kpi: { minW: 3, maxW: 12, minH: 6, maxH: 40, defW: 3, defH: 12, live: false, multi: 24 },
    // Calculadora de status da Espera. Singleton, nasce oculta, como a Twitch.
    pokecalc: { minW: 4, maxW: 12, minH: 12, maxH: 80, defW: 6, defH: 24, live: false, multi: 1 },
  };
  for (const type of Object.keys(TYPES)) Object.freeze(TYPES[type]);
  Object.freeze(TYPES);
  const TYPE_NAMES = Object.keys(TYPES);

  function isPlain(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function typeInfo(type) {
    return typeof type === 'string' && hasOwn(TYPES, type) ? TYPES[type] : null;
  }

  // Estado de partida de uma operação: o próprio estado se já é válido (mesma referência), senão normalize.
  // Assim toda operação devolve um estado válido, mesmo quando recebe lixo.
  function baseOf(state) {
    return validate(state).ok ? state : normalize(state);
  }

  // Número a partir de number ou de string não vazia. Qualquer outra coisa (null, undefined, boolean, '') vira NaN.
  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return NaN;
  }

  // Cópia profunda do estado: nada compartilhado com a entrada.
  function cloneModule(m) {
    return { ...m, design: { ...m.design } };
  }

  function cloneState(state) {
    const profiles = {};
    for (const id of Object.keys(state.profiles)) {
      const p = state.profiles[id];
      profiles[id] = { name: p.name, modules: p.modules.map(cloneModule) };
    }
    return { schemaVersion: 1, activeProfile: state.activeProfile, profiles };
  }

  // Número finito, arredondado e limitado. Qualquer outra coisa devolve o valor de reserva.
  function intIn(value, min, max, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  // Id válido: o próprio tipo (multi 1) ou `tipo-n`, com n canônico abaixo de multi. Devolve o tipo ou null.
  function idOwner(id) {
    if (typeof id !== 'string') return null;
    for (const type of TYPE_NAMES) {
      const multi = TYPES[type].multi;
      if (multi === 1) {
        if (id === type) return type;
        continue;
      }
      if (!id.startsWith(`${type}-`)) continue;
      const tail = id.slice(type.length + 1);
      if (/^(0|[1-9]\d*)$/.test(tail) && Number(tail) < multi) return type;
    }
    return null;
  }

  function idsOf(type) {
    const info = TYPES[type];
    const ids = [];
    for (let n = 0; n < info.multi; n += 1) ids.push(info.multi === 1 ? type : `${type}-${n}`);
    return ids;
  }

  function moduleOf(type, id, x, y) {
    const info = TYPES[type];
    return {
      id,
      type,
      x,
      y,
      w: info.defW,
      h: info.defH,
      visible: true,
      collapsed: false,
      locked: false,
      design: { accent: null, glow: false },
    };
  }

  function defaultModules() {
    return [
      moduleOf('bay', 'bay-0', 0, 0),
      moduleOf('bay', 'bay-1', 6, 0),
      moduleOf('bay', 'bay-2', 0, 34),
      moduleOf('bay', 'bay-3', 6, 34),
    ];
  }

  // Perfil `padrao`: as 4 baías em 2x2, 6 colunas de largura e 34 linhas (340 px) de altura.
  function defaults() {
    return {
      schemaVersion: 1,
      activeProfile: 'padrao',
      profiles: { padrao: { name: 'Padrão', modules: defaultModules() } },
    };
  }

  function validProfileId(id) {
    return typeof id === 'string' && PROFILE_ID.test(id);
  }

  function cleanName(name, fallback) {
    const text = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
    return text || fallback;
  }

  // Devolve o módulo limpo, ou null se o id ou o tipo não servem. Corrige limites e a borda da grade.
  function sanitizeModule(raw) {
    if (!isPlain(raw)) return null;
    const type = idOwner(raw.id);
    if (!type || raw.type !== type) return null;
    const info = TYPES[type];
    const w = intIn(raw.w, info.minW, info.maxW, info.defW);
    const h = intIn(raw.h, info.minH, info.maxH, info.defH);
    const x = intIn(raw.x, 0, GRID.cols - w, 0);
    const y = intIn(raw.y, 0, ROWS_MAX, 0);
    const design = isPlain(raw.design) ? raw.design : {};
    return {
      id: raw.id,
      type,
      x,
      y,
      w,
      h,
      visible: raw.visible !== false,
      collapsed: raw.collapsed === true,
      locked: raw.locked === true,
      design: {
        accent: ACCENTS.includes(design.accent) ? design.accent : null,
        glow: design.glow === true,
      },
    };
  }

  // Ordem canônica: (y, x). Array.prototype.sort é estável, então empates seguem a entrada.
  function byPos(a, b) {
    return a.y - b.y || a.x - b.x;
  }

  // Dois retângulos em unidades de grade se sobrepõem. Usa x, y, w, h.
  function collides(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  // Empurra m para baixo até não colidir com ninguém de `placed`. Cada volta sobe o y até a base de um colidente,
  // e os valores de base são distintos, então há no máximo placed.length + 1 voltas.
  function pushDown(m, placed) {
    for (let guard = 0; guard <= placed.length; guard += 1) {
      const hits = placed.filter((p) => collides(p, m));
      if (hits.length === 0) return m;
      m.y = Math.min(ROWS_MAX, Math.max(...hits.map((p) => p.y + p.h)));
    }
    return m;
  }

  // Sobe m enquanto a posição de cima estiver livre.
  function gravity(m, placed) {
    // Teto de passos: y já vem limitado em ROWS_MAX, então o laço termina mesmo com entrada estranha.
    for (let steps = 0; m.y > 0 && steps <= ROWS_MAX; steps += 1) {
      const above = { ...m, y: m.y - 1 };
      if (placed.some((p) => collides(p, above))) return m;
      m.y -= 1;
    }
    return m;
  }

  // Compacta os visíveis para cima, em ordem de (y, x). Locked e o âncora ficam onde estão.
  // Devolve cópias na mesma ordem da entrada; módulos ocultos passam sem mudança.
  function settle(list, anchorId) {
    const out = list.map((m) => ({ ...m, design: { ...m.design } }));
    const visible = out.filter((m) => m.visible === true);
    const isFixed = (m) => m.locked === true || m.id === anchorId;
    const placed = visible.filter(isFixed).sort(byPos);
    const free = visible.filter((m) => !isFixed(m)).sort(byPos);
    for (const m of free) {
      pushDown(m, placed);
      gravity(m, placed);
      placed.push(m);
    }
    return out;
  }

  // Primeira posição (y depois x) onde cabe w x h sem colidir com `others`. Nunca falha: no pior caso, vai para o fim.
  function firstFit(others, w, h) {
    const bottom = others.reduce((max, m) => Math.max(max, m.y + m.h), 0);
    for (let y = 0; y <= bottom; y += 1) {
      for (let x = 0; x + w <= GRID.cols; x += 1) {
        const probe = { x, y, w, h };
        if (!others.some((m) => collides(m, probe))) return { x, y };
      }
    }
    return { x: 0, y: bottom };
  }

  // Limpa a lista de módulos de um perfil: descarta lixo e ids repetidos, corta no limite,
  // recria baías ausentes como ocultas e empurra sobreposições para baixo. Não compacta: o espaço do usuário fica.
  function normalizeModules(rawList) {
    const list = [];
    const seen = new Set();
    for (const raw of rawList) {
      const m = sanitizeModule(raw);
      if (!m || seen.has(m.id)) continue;
      seen.add(m.id);
      list.push(m);
    }
    const missing = idsOf('bay').filter((id) => !seen.has(id));
    // Corta do fim sem tirar as baías. Como há no máximo 4 baías, sempre sobra espaço para as que faltam.
    while (list.length + missing.length > MAX_MODULES) {
      let i = list.length - 1;
      while (i >= 0 && list[i].type === 'bay') i -= 1;
      if (i < 0) break;
      list.splice(i, 1);
    }
    for (const id of missing) list.push({ ...moduleOf('bay', id, 0, 0), visible: false });

    // Travados vêm primeiro e ficam fixos. Se dois travados se sobrepõem (entrada inválida), o primeiro na
    // ordem de entrada fica e o segundo é empurrado: única situação em que normalize move um travado.
    // Destravados são empurrados para baixo, em ordem de (y, x).
    const visible = list.filter((m) => m.visible);
    const placed = [];
    for (const m of visible.filter((x) => x.locked)) {
      pushDown(m, placed);
      placed.push(m);
    }
    for (const m of visible.filter((x) => !x.locked).sort(byPos)) {
      pushDown(m, placed);
      placed.push(m);
    }
    const hidden = list.filter((m) => !m.visible);
    return [...placed, ...hidden].sort(byPos);
  }

  // Estado limpo. Lixo, ou um estado sem perfil válido, vira defaults().
  function normalize(raw) {
    if (!isPlain(raw) || !isPlain(raw.profiles)) return defaults();
    const profiles = {};
    let count = 0;
    for (const id of Object.keys(raw.profiles)) {
      if (count >= MAX_PROFILES) break;
      if (!validProfileId(id)) continue;
      const item = raw.profiles[id];
      if (!isPlain(item)) continue;
      const modules = Array.isArray(item.modules) ? normalizeModules(item.modules) : defaultModules();
      profiles[id] = { name: cleanName(item.name, id), modules };
      count += 1;
    }
    const keys = Object.keys(profiles);
    if (keys.length === 0) return defaults();
    const activeProfile = typeof raw.activeProfile === 'string' && hasOwn(profiles, raw.activeProfile)
      ? raw.activeProfile
      : keys[0];
    return { schemaVersion: 1, activeProfile, profiles };
  }

  function modulesOf(state) {
    return state.profiles[state.activeProfile].modules;
  }

  function findModule(state, id) {
    return modulesOf(state).find((m) => m.id === id) || null;
  }

  // Estado novo com os módulos dados no perfil ativo, em ordem canônica. Os outros perfis são mantidos.
  function withModules(base, modules) {
    const next = cloneState(base);
    next.profiles[base.activeProfile].modules = modules.map(cloneModule).sort(byPos);
    return next;
  }

  // Põe `target` no lugar do módulo de mesmo id e compacta o resto. Recusa (devolve null) se bater num locked.
  function placeTarget(base, target) {
    const list = modulesOf(base).map((m) => (m.id === target.id ? target : m));
    const blocked = list.some((m) => m.id !== target.id && m.visible && m.locked && collides(m, target));
    if (blocked) return null;
    return withModules(base, settle(list, target.id));
  }

  // Valida o estado inteiro. Devolve { ok, errors: [{ path, msg }] }. Não corrige nada.
  function validate(raw) {
    const errors = [];
    const fail = (path, msg) => errors.push({ path, msg });
    if (!isPlain(raw)) return { ok: false, errors: [{ path: '', msg: 'o estado deve ser um objeto' }] };
    for (const key of Object.keys(raw)) {
      if (!STATE_KEYS.includes(key)) fail(key, 'chave desconhecida');
    }
    if (raw.schemaVersion !== 1) fail('schemaVersion', 'deve ser 1');
    if (!isPlain(raw.profiles)) {
      fail('profiles', 'deve ser um objeto');
      return { ok: false, errors };
    }
    const ids = Object.keys(raw.profiles);
    if (ids.length < 1 || ids.length > MAX_PROFILES) fail('profiles', `deve ter de 1 a ${MAX_PROFILES} perfis`);
    if (typeof raw.activeProfile !== 'string' || !ids.includes(raw.activeProfile)) {
      fail('activeProfile', 'deve apontar para um perfil existente');
    }
    for (const pid of ids) {
      const at = `profiles.${pid}`;
      const profile = raw.profiles[pid];
      if (!validProfileId(pid)) fail(at, 'id de perfil inválido');
      if (!isPlain(profile)) {
        fail(at, 'deve ser um objeto');
        continue;
      }
      for (const key of Object.keys(profile)) {
        if (!PROFILE_KEYS.includes(key)) fail(`${at}.${key}`, 'chave desconhecida');
      }
      if (typeof profile.name !== 'string' || profile.name.trim() === '' || profile.name.length > NAME_MAX) {
        fail(`${at}.name`, `texto de 1 a ${NAME_MAX} caracteres`);
      }
      if (!Array.isArray(profile.modules)) {
        fail(`${at}.modules`, 'deve ser uma lista');
        continue;
      }
      if (profile.modules.length > MAX_MODULES) fail(`${at}.modules`, `no máximo ${MAX_MODULES} módulos`);
      const seen = new Set();
      const shown = [];
      profile.modules.forEach((m, i) => {
        const mp = `${at}.modules[${i}]`;
        if (!isPlain(m)) {
          fail(mp, 'deve ser um objeto');
          return;
        }
        for (const key of Object.keys(m)) {
          if (!MODULE_KEYS.includes(key)) fail(`${mp}.${key}`, 'chave desconhecida');
        }
        for (const key of MODULE_KEYS) {
          if (!hasOwn(m, key)) fail(`${mp}.${key}`, 'campo obrigatório');
        }
        const type = idOwner(m.id);
        if (!type) {
          fail(`${mp}.id`, 'id desconhecido');
          return;
        }
        if (seen.has(m.id)) fail(`${mp}.id`, 'id repetido no perfil');
        seen.add(m.id);
        if (m.type !== type) fail(`${mp}.type`, 'tipo não bate com o id');
        const info = TYPES[type];
        const inRange = (key, min, max) => {
          if (!Number.isInteger(m[key]) || m[key] < min || m[key] > max) fail(`${mp}.${key}`, `inteiro de ${min} a ${max}`);
        };
        inRange('w', info.minW, info.maxW);
        inRange('h', info.minH, info.maxH);
        inRange('x', 0, GRID.cols - 1);
        inRange('y', 0, ROWS_MAX);
        if (Number.isInteger(m.x) && Number.isInteger(m.w) && m.x + m.w > GRID.cols) {
          fail(`${mp}.x`, 'x + w passa da grade de 12 colunas');
        }
        for (const key of ['visible', 'collapsed', 'locked']) {
          if (typeof m[key] !== 'boolean') fail(`${mp}.${key}`, 'deve ser true ou false');
        }
        if (!isPlain(m.design)) {
          fail(`${mp}.design`, 'deve ser um objeto');
        } else {
          for (const key of Object.keys(m.design)) {
            if (!DESIGN_KEYS.includes(key)) fail(`${mp}.design.${key}`, 'chave desconhecida');
          }
          if (!(m.design.accent === null || ACCENTS.includes(m.design.accent))) fail(`${mp}.design.accent`, 'acento desconhecido');
          if (typeof m.design.glow !== 'boolean') fail(`${mp}.design.glow`, 'deve ser true ou false');
        }
        if (m.visible === true && [m.x, m.y, m.w, m.h].every(Number.isInteger)) shown.push(m);
      });
      for (let i = 0; i < shown.length; i += 1) {
        for (let j = i + 1; j < shown.length; j += 1) {
          if (collides(shown[i], shown[j])) fail(`${at}.modules`, `${shown[i].id} sobrepõe ${shown[j].id}`);
        }
      }
      for (const id of idsOf('bay')) {
        if (!seen.has(id)) fail(`${at}.modules`, `falta a baía ${id}`);
      }
    }
    return { ok: errors.length === 0, errors };
  }

  // Move um módulo para (x, y), empurra quem colide e compacta o resto. Não move locked nem oculto.
  function move(state, id, pos) {
    const base = baseOf(state);
    const current = findModule(base, id);
    if (!current || !current.visible || current.locked) return base;
    if (!isPlain(pos) || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return base;
    const target = {
      ...current,
      x: intIn(pos.x, 0, GRID.cols - current.w, 0),
      y: intIn(pos.y, 0, ROWS_MAX, 0),
    };
    return placeTarget(base, target) || base;
  }

  // Muda w e/ou h, limitados ao tipo. A borda da grade vale: x recua se x + w passar de 12. Não muda locked nem oculto.
  function resize(state, id, size) {
    const base = baseOf(state);
    const current = findModule(base, id);
    if (!current || !current.visible || current.locked || !isPlain(size)) return base;
    if (!Number.isFinite(size.w) && !Number.isFinite(size.h)) return base;
    const info = TYPES[current.type];
    const w = intIn(size.w, info.minW, info.maxW, current.w);
    const h = intIn(size.h, info.minH, info.maxH, current.h);
    const target = { ...current, w, h, x: Math.min(current.x, GRID.cols - w) };
    return placeTarget(base, target) || base;
  }

  // Adiciona o primeiro módulo do tipo que não esteja visível. Se o id existir oculto, reexibe-o.
  // Na primeira vaga livre. Recusa acima de 32 módulos e quando o tipo já está no limite.
  function add(state, type, opts) {
    const base = baseOf(state);
    const info = typeInfo(type);
    if (!info) return base;
    const mods = modulesOf(base);
    let slot = null;
    for (const id of idsOf(type)) {
      const found = mods.find((m) => m.id === id) || null;
      // Oculto e travado não é candidato: add não revela nem move módulo locked.
      if (found && !found.visible && found.locked) continue;
      if (!found || !found.visible) {
        slot = { id, found };
        break;
      }
    }
    if (!slot) return base;
    if (!slot.found && mods.length >= MAX_MODULES) return base;
    const size = isPlain(opts) ? opts : {};
    const w = intIn(size.w, info.minW, info.maxW, slot.found ? slot.found.w : info.defW);
    const h = intIn(size.h, info.minH, info.maxH, slot.found ? slot.found.h : info.defH);
    const others = mods.filter((m) => m.visible && m.id !== slot.id);
    const spot = firstFit(others, w, h);
    const next = slot.found
      ? { ...slot.found, visible: true, x: spot.x, y: spot.y, w, h }
      : { ...moduleOf(type, slot.id, spot.x, spot.y), w, h };
    const list = slot.found ? mods.map((m) => (m.id === slot.id ? next : m)) : mods.concat([next]);
    return withModules(base, list);
  }

  // Tipo vivo (baía) só vira oculto e fica no lugar. Os outros saem da lista e a grade é compactada.
  function remove(state, id) {
    const base = baseOf(state);
    const mods = modulesOf(base);
    const current = mods.find((m) => m.id === id);
    // Locked não sai da grade: nem oculto nem removido. Vale para baía também.
    if (!current || current.locked) return base;
    if (typeInfo(current.type).live) {
      if (!current.visible) return base;
      return withModules(base, mods.map((m) => (m.id === id ? { ...m, visible: false } : m)));
    }
    return withModules(base, settle(mods.filter((m) => m.id !== id), null));
  }

  // Modo de exibição pelo tamanho. micro: estreito ou baixo. expandido: largo e alto. Senão padrão.
  function sizeMode(module) {
    if (!isPlain(module)) return 'padrao';
    if (module.w <= 3 || module.h <= 10) return 'micro';
    if (module.w >= 8 && module.h >= 40) return 'expandido';
    return 'padrao';
  }

  // Converte um retângulo em px para unidades de grade. metrics.width é a largura do contêiner em px.
  // A altura de cada linha é rowPx; o gap só vale na horizontal. Devolve null se a largura não serve.
  function snap(rectPx, metrics) {
    if (!isPlain(rectPx) || !isPlain(metrics)) return null;
    const gap = GRID.gapPx;
    const width = toNumber(metrics.width);
    const col = (width - gap * (GRID.cols - 1)) / GRID.cols;
    if (!Number.isFinite(col) || col <= 0) return null;
    // Number() antes de qualquer conta: string como '496' não concatena.
    const px = [rectPx.x, rectPx.y, rectPx.width, rectPx.height].map(toNumber);
    if (!px.every(Number.isFinite)) return null;
    const [left, top, rw, rh] = px;
    const stride = col + gap;
    const x = intIn(left / stride, 0, GRID.cols - 1, 0);
    const w = intIn((rw + gap) / stride, 1, GRID.cols - x, 1);
    const y = intIn(top / GRID.rowPx, 0, ROWS_MAX, 0);
    const h = intIn(rh / GRID.rowPx, 1, ROWS_MAX, 1);
    return { x, y, w, h };
  }

  // Compacta uma lista de módulos (locked não se move). Devolve cópias na mesma ordem da entrada.
  function compact(modules) {
    if (!Array.isArray(modules)) return [];
    // Cada item passa por sanitizeModule: tipo, limites e y ficam dentro da grade. Item inválido sai da lista.
    return settle(modules.filter(isPlain).map(sanitizeModule).filter((m) => m !== null), null);
  }

  // Projeção para outra largura de grade (ex.: 6 colunas ou 1). Não grava nada.
  // Ordena por (y, x) e empilha o que não cabe. Cada item sai como { id, x, y, w, h }.
  function project(modules, cols) {
    if (!Array.isArray(modules) || !Number.isInteger(cols) || cols < 1 || cols > GRID.cols) return [];
    // Módulo com x, y, w ou h que não sejam números finitos fica fora da projeção.
    const visible = modules
      .filter((m) => isPlain(m) && m.visible === true && [m.x, m.y, m.w, m.h].every(Number.isFinite))
      .sort(byPos);
    const placed = [];
    for (const m of visible) {
      const w = Math.min(cols, Math.max(1, Math.round((m.w * cols) / GRID.cols)));
      const x = Math.min(cols - w, Math.floor((m.x * cols) / GRID.cols));
      const item = { id: m.id, x, y: m.y, w, h: m.h };
      pushDown(item, placed);
      placed.push(item);
    }
    return placed.map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h }));
  }

  // Salva o perfil ativo como `id` (cria ou sobrescreve) e passa a usá-lo. Recusa id inválido ou o 9º perfil.
  function saveProfile(state, id, name) {
    const base = baseOf(state);
    if (!validProfileId(id)) return base;
    if (!hasOwn(base.profiles, id) && Object.keys(base.profiles).length >= MAX_PROFILES) return base;
    const next = cloneState(base);
    next.profiles[id] = { name: cleanName(name, id), modules: modulesOf(base).map(cloneModule) };
    next.activeProfile = id;
    return next;
  }

  function switchProfile(state, id) {
    const base = baseOf(state);
    if (!hasOwn(base.profiles, id) || id === base.activeProfile) return base;
    const next = cloneState(base);
    next.activeProfile = id;
    return next;
  }

  // Reseta o perfil para o padrão, mas preserva os travados (locked): eles saem iguais, visíveis ou ocultos.
  // Os padrão destravados voltam às posições padrão e são empurrados para baixo se colidirem com um travado.
  // Destravados fora do padrão (ex.: kpi) somem. Nome e outros perfis ficam como estão.
  function resetProfile(state, id) {
    const base = baseOf(state);
    if (!hasOwn(base.profiles, id)) return base;
    const travados = base.profiles[id].modules.filter((m) => m.locked).map(cloneModule);
    const idsTravados = new Set(travados.map((m) => m.id));
    const placed = travados.filter((m) => m.visible).sort(byPos);
    const fresh = defaultModules().filter((m) => !idsTravados.has(m.id));
    for (const m of fresh) {
      pushDown(m, placed);
      placed.push(m);
    }
    const next = cloneState(base);
    next.profiles[id].modules = [...travados, ...fresh].sort(byPos);
    return next;
  }

  // Apaga um perfil. Não apaga o último. Se o ativo sumir, o primeiro restante vira ativo.
  function deleteProfile(state, id) {
    const base = baseOf(state);
    if (!hasOwn(base.profiles, id)) return base;
    if (Object.keys(base.profiles).length <= 1) return base;
    const next = cloneState(base);
    delete next.profiles[id];
    if (base.activeProfile === id) next.activeProfile = Object.keys(next.profiles)[0];
    return next;
  }

  // Converte cfg antigo (baías em cfg.bays e widgets em cfg.standby). Nunca lança.
  function legacySpan(value) {
    return Number.isInteger(value) && value >= TYPES.bay.minW && value <= TYPES.bay.maxW ? value : TYPES.bay.defW;
  }

  function legacyRows(px) {
    if (typeof px !== 'number' || !Number.isFinite(px) || px <= 0) return TYPES.bay.defH;
    return intIn(px / GRID.rowPx, TYPES.bay.minH, TYPES.bay.maxH, TYPES.bay.defH);
  }

  function fromLegacy(cfg) {
    if (!isPlain(cfg)) return defaults();
    const bays = Array.isArray(cfg.bays) ? cfg.bays : [];
    const modules = [];
    for (let i = 0; i < TYPES.bay.multi; i += 1) {
      const raw = isPlain(bays[i]) ? bays[i] : {};
      const box = isPlain(raw.box) ? raw.box : {};
      const w = legacySpan(box.span);
      const h = legacyRows(box.h);
      const spot = firstFit(modules.filter((m) => m.visible), w, h);
      modules.push({ ...moduleOf('bay', `bay-${i}`, spot.x, spot.y), w, h, visible: raw.open !== false });
    }
    // Espera: a ordem salva vem primeiro; os que faltarem entram em seguida. Baías já vieram de cfg.bays.
    const sb = isPlain(cfg.standby) ? cfg.standby : {};
    const widgets = isPlain(sb.widgets) ? sb.widgets : {};
    const order = (Array.isArray(sb.order) ? sb.order : []).concat(['captures', 'procs', 'twitch', ...idsOf('twitch-bay'), 'pokecalc']);
    const seen = new Set();
    for (const id of order) {
      if (typeof id !== 'string' || seen.has(id)) continue;
      seen.add(id);
      const type = idOwner(id);
      if (!type || type === 'bay' || type === 'kpi') continue;
      if (modules.length >= MAX_MODULES) break;
      const item = hasOwn(widgets, id) && isPlain(widgets[id]) ? widgets[id] : {};
      const info = TYPES[type];
      // Estado sem o campo hidden: os da Twitch nascem ocultos, como na Espera.
      const hidden = 'hidden' in item ? item.hidden === true : type === 'twitch' || type === 'twitch-bay' || type === 'pokecalc';
      const w = Number(item.span) >= 2 ? GRID.cols : info.defW;
      const h = info.defH;
      const spot = firstFit(modules.filter((m) => m.visible), w, h);
      modules.push({
        ...moduleOf(type, id, spot.x, spot.y),
        w,
        h,
        visible: !hidden,
        collapsed: item.collapsed === true,
      });
    }
    return normalize({ schemaVersion: 1, activeProfile: 'padrao', profiles: { padrao: { name: 'Padrão', modules } } });
  }

  return {
    GRID,
    TYPES,
    ACCENTS,
    MODULE_KEYS,
    MAX_PROFILES,
    MAX_MODULES,
    defaults,
    validate,
    normalize,
    collides,
    compact,
    snap,
    move,
    resize,
    add,
    remove,
    sizeMode,
    project,
    saveProfile,
    switchProfile,
    resetProfile,
    deleteProfile,
    fromLegacy,
  };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = MesaBoardLayout;
