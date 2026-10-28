'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../../shared/live-catalog');

const {
  wantedJoinLogins,
  applyBayPatch,
  emptyBayLive,
  sanitizeLivePatch,
  setChannelEnabled,
  addManual,
  removeManual,
  toPublicSnapshot,
} = catalog;

function official(login, bonus, aoVivo) {
  return { login, nome: login, bonus, aoVivo };
}

function live(login) {
  return { login, nome: login, espectadores: 1 };
}

describe('wantedJoinLogins', () => {
  it('bonus true e login em lives entra', () => {
    const bays = [{ twitch: { oficiais: [official('Alpha', true, false)], lives: [live('alpha')] } }];
    const wanted = wantedJoinLogins(bays, [], []);
    assert.deepEqual(Array.from(wanted).sort(), ['alpha']);
  });

  it('bonus true e aoVivo true, sem lives, entra', () => {
    const bays = [{ twitch: { oficiais: [official('Beta', true, true)], lives: [] } }];
    const wanted = wantedJoinLogins(bays, [], []);
    assert.deepEqual(Array.from(wanted), ['beta']);
  });

  it('bonus true sem aoVivo entra mesmo fora de lives', () => {
    const bays = [{ twitch: { oficiais: [official('Delta', true, undefined)], lives: [] } }];
    const wanted = wantedJoinLogins(bays, [], []);
    assert.deepEqual(Array.from(wanted), ['delta']);
  });

  it('bonus true, aoVivo false, fora de lives, não entra', () => {
    const bays = [{ twitch: { oficiais: [official('Gamma', true, false)], lives: [] } }];
    const wanted = wantedJoinLogins(bays, [], []);
    assert.equal(wanted.size, 0);
  });

  it('bonus false e login inválido não entram', () => {
    const bays = [{
      twitch: {
        oficiais: [official('NoBonus', false, true), official('bad-login!', true, true)],
        lives: [],
      },
    }];
    const wanted = wantedJoinLogins(bays, [], []);
    assert.equal(wanted.size, 0);
  });

  it('exclusão e manual', () => {
    const bays = [{
      twitch: {
        oficiais: [official('Alpha', true, true), official('Other', true, true)],
        lives: [],
      },
    }];
    const wanted = wantedJoinLogins(bays, ['alpha'], ['Manual']);
    assert.deepEqual(Array.from(wanted).sort(), ['manual', 'other']);
  });

  it('exclusão antiga não bloqueia canal novo', () => {
    const bays = [{ twitch: { oficiais: [official('New', true, true)], lives: [] } }];
    const wanted = wantedJoinLogins(bays, ['old'], []);
    assert.deepEqual(Array.from(wanted), ['new']);
  });

  it('união de duas baías', () => {
    const bays = [
      { twitch: { oficiais: [official('One', true, true)], lives: [] } },
      { twitch: { oficiais: [official('Two', true, true)], lives: [] } },
    ];
    const wanted = wantedJoinLogins(bays, [], []);
    assert.deepEqual(Array.from(wanted).sort(), ['one', 'two']);
  });
});

describe('applyBayPatch', () => {
  it('patch parcial preserva listas e chaves', () => {
    let bay = emptyBayLive();
    bay = applyBayPatch(bay, { twitch: { lives: [live('a')], oficiais: [official('b', true, true)] } });
    bay = applyBayPatch(bay, { twitch: { oficiais: [official('c', true, false)] } });
    assert.equal(bay.twitch.lives.length, 1);
    assert.equal(bay.twitch.oficiais[0].login, 'c');
    bay = applyBayPatch(bay, { kick: { pct: 5 } });
    assert.equal(bay.twitch.lives.length, 1);
    assert.equal(bay.kick.pct, 5);
    assert.equal(bay.kick.minutos, undefined);
  });

  it('assistindo false zera percentual', () => {
    let bay = applyBayPatch(emptyBayLive(), { twitch: { assistindo: true, pctAtual: 10 } });
    assert.equal(bay.twitch.pctDisplay, 10);
    bay = applyBayPatch(bay, { twitch: { assistindo: false } });
    assert.equal(bay.twitch.pctDisplay, 0);
  });
});

describe('sanitizeLivePatch', () => {
  it('descarta credenciais', () => {
    const patch = sanitizeLivePatch({
      twitch: { login: 'secret', token: 'x', lives: [live('a')] },
      accessToken: 'nope',
    });
    assert.ok(patch.twitch.lives);
    assert.equal(patch.twitch.login, undefined);
    assert.equal(patch.accessToken, undefined);
  });
});

describe('toPublicSnapshot', () => {
  it('não serializa tokens', () => {
    const snap = toPublicSnapshot({
      status: 'no-chat',
      login: 'user',
      clientId: 'client',
      bays: [],
      prefs: { excluded: [], manual: [] },
      accessToken: 'secret',
      token: { accessToken: 'x', refreshToken: 'y', oauth: 'z' },
    });
    const json = JSON.stringify(snap);
    assert.equal(json.includes('accessToken'), false);
    assert.equal(json.includes('refreshToken'), false);
    assert.equal(json.includes('oauth'), false);
  });
});

describe('setChannelEnabled', () => {
  it('desmarcar qualificado grava exclusão sem apagar manual', () => {
    let prefs = { excluded: [], manual: ['alpha'] };
    prefs = setChannelEnabled(prefs, 'Alpha', false, true);
    assert.ok(prefs.excluded.includes('alpha'));
    assert.ok(prefs.manual.includes('alpha'));
  });

  it('manual desmarcado permanece em manual e excluded', () => {
    let prefs = { excluded: [], manual: ['manual'] };
    prefs = setChannelEnabled(prefs, 'manual', false, false);
    assert.ok(prefs.manual.includes('manual'));
    assert.ok(prefs.excluded.includes('manual'));
    const bays = [{ twitch: { oficiais: [], lives: [] } }];
    let wanted = wantedJoinLogins(bays, prefs.excluded, prefs.manual);
    assert.equal(wanted.has('manual'), false);
    prefs = setChannelEnabled(prefs, 'manual', true, false);
    assert.equal(prefs.excluded.includes('manual'), false);
    assert.ok(prefs.manual.includes('manual'));
    wanted = wantedJoinLogins(bays, prefs.excluded, prefs.manual);
    assert.equal(wanted.has('manual'), true);
    prefs = removeManual(prefs, 'manual');
    assert.equal(prefs.manual.includes('manual'), false);
  });
});
