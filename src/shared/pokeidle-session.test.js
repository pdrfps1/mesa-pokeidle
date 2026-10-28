'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const session = require('./pokeidle-session');

describe('pokeidle-session', () => {
  it('detecta sessão no localStorage', () => {
    assert.equal(session.isLoggedInStorage({}), false);
    assert.equal(session.isLoggedInStorage({ sessao: '' }), false);
    assert.equal(session.isLoggedInStorage({ sessao: 'abc' }), true);
  });

  it('filtra cookies do pokeidle.io', () => {
    assert.equal(session.isPokeidleCookie({ domain: '.pokeidle.io' }), true);
    assert.equal(session.isPokeidleCookie({ domain: 'app.pokeidle.io' }), true);
    assert.equal(session.isPokeidleCookie({ domain: '.google.com' }), false);
    assert.equal(session.isPokeidleCookie(null), false);
  });

  it('monta URL https para gravar cookie', () => {
    assert.equal(session.cookieSetUrl({ domain: '.pokeidle.io', path: '/app' }), 'https://pokeidle.io/app');
  });
});
