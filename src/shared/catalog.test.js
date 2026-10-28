'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('./catalog');

describe('mesaLiveKind', () => {
  it('aceita o jogo e o login do Google', () => {
    assert.equal(catalog.liveKind('https://pokeidle.io/app'), 'game');
    assert.equal(catalog.liveKind('https://accounts.google.com/o/oauth2/v2/auth'), 'game');
    assert.equal(catalog.liveKind('https://accounts.google.com/gsi/select'), 'game');
    assert.equal(catalog.liveKind('https://www.google.com/recaptcha/api2/anchor'), 'game');
    assert.equal(catalog.liveKind('https://ssl.gstatic.com/accounts/static/logo.png'), 'game');
    assert.equal(catalog.liveKind('https://oauth2.googleapis.com/token'), 'game');
    assert.equal(catalog.liveKind('https://challenges.cloudflare.com/cdn-cgi/challenge'), 'game');
  });

  it('não trata um site qualquer como jogo', () => {
    assert.equal(catalog.liveKind('https://example.com'), '');
    assert.equal(catalog.liveKind('http://accounts.google.com'), '');
    assert.equal(catalog.liveKind('about:blank'), '');
  });
});

describe('isGoogleLoginUrl', () => {
  it('reconhece hosts de login do Google', () => {
    assert.equal(catalog.isGoogleLoginUrl('https://accounts.google.com/o/oauth2/v2/auth'), true);
    assert.equal(catalog.isGoogleLoginUrl('https://accounts.google.com/gsi/select'), true);
    assert.equal(catalog.isGoogleLoginUrl('https://www.google.com/signin'), true);
  });

  it('ignora endereços inválidos ou inseguros', () => {
    assert.equal(catalog.isGoogleLoginUrl('http://accounts.google.com'), false);
    assert.equal(catalog.isGoogleLoginUrl('https://example.com'), false);
    assert.equal(catalog.isGoogleLoginUrl(''), false);
  });
});
