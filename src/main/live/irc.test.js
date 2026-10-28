'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  handleIrcLine,
  createIrcSession,
  JoinScheduler,
  WINDOW_MS,
} = require('./irc');

describe('handleIrcLine', () => {
  it('PING responde PONG', () => {
    const session = createIrcSession('user', 'token');
    const result = handleIrcLine(session, 'PING :tmi.twitch.tv');
    assert.equal(result.commands[0].type, 'pong');
    assert.equal(result.commands[0].payload, 'tmi.twitch.tv');
  });

  it('JOIN confirma canal', () => {
    const session = createIrcSession('user', 'token');
    handleIrcLine(session, ':user!user@user.tmi.twitch.tv JOIN #Alpha');
    assert.ok(session.confirmed.has('alpha'));
  });

  it('NOTICE authentication failed', () => {
    const session = createIrcSession('user', 'token');
    const result = handleIrcLine(session, ':tmi.twitch.tv NOTICE * :Login authentication failed');
    assert.equal(result.authFailed, true);
  });

  it('NOTICE improperly formatted auth', () => {
    const session = createIrcSession('user', 'token');
    const result = handleIrcLine(session, ':tmi.twitch.tv NOTICE * :Improperly formatted auth');
    assert.equal(result.authFailed, true);
  });

  it('PRIVMSG não gera comando', () => {
    const session = createIrcSession('user', 'token');
    const result = handleIrcLine(session, ':user!user@user.tmi.twitch.tv PRIVMSG #chan :hello');
    assert.equal(result.commands.length, 0);
  });
});

describe('JoinScheduler', () => {
  it('limita 20 joins por janela', () => {
    let now = 1000;
    const scheduler = new JoinScheduler(() => now);
    const channels = new Set(Array.from({ length: 21 }, (_, i) => `c${i}`));
    const first = scheduler.enqueue(channels);
    assert.equal(first.length, 20);
    const second = scheduler.drainReady();
    assert.equal(second.length, 0);
    now += WINDOW_MS;
    const third = scheduler.drainReady();
    assert.equal(third.length, 1);
  });
});
