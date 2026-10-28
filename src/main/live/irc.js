'use strict';

const MAX_JOINS = 20;
const WINDOW_MS = 10000;

function splitIrcPayload(raw) {
  if (typeof raw !== 'string' || !raw) return [];
  const normalized = raw.replace(/\r\n/g, '\n').split('\n');
  const lines = [];
  for (const line of normalized) {
    if (line.length) lines.push(line);
  }
  return lines;
}

function formatPass(token) {
  return `PASS oauth:${token}`;
}

function formatNick(login) {
  return `NICK ${login}`;
}

function formatJoin(channel) {
  const name = String(channel || '').replace(/^#/, '').toLowerCase();
  return `JOIN #${name}`;
}

function formatPart(channel) {
  const name = String(channel || '').replace(/^#/, '').toLowerCase();
  return `PART #${name}`;
}

function nextReconnectDelay(session) {
  const delay = session.reconnectDelayMs || 5000;
  session.reconnectDelayMs = Math.min((session.reconnectDelayMs || 5000) * 2, 60000);
  return delay;
}

function resetReconnectDelay(session) {
  session.reconnectDelayMs = 5000;
}

class JoinScheduler {
  constructor(nowFn) {
    this.now = typeof nowFn === 'function' ? nowFn : () => Date.now();
    this.windowStart = null;
    this.sentInWindow = 0;
    this.pending = [];
  }

  enqueue(channels) {
    const list = Array.from(channels || []);
    for (const channel of list) {
      const name = String(channel).toLowerCase();
      if (!this.pending.includes(name)) this.pending.push(name);
    }
    return this.drainReady();
  }

  remove(channel) {
    const name = String(channel).toLowerCase();
    this.pending = this.pending.filter((item) => item !== name);
  }

  drainReady() {
    const ready = [];
    while (this.pending.length) {
      const now = this.now();
      if (this.windowStart == null || now - this.windowStart >= WINDOW_MS) {
        this.windowStart = now;
        this.sentInWindow = 0;
      }
      if (this.sentInWindow >= MAX_JOINS) break;
      ready.push(this.pending.shift());
      this.sentInWindow += 1;
    }
    return ready;
  }
}

function createIrcSession(nick, token) {
  return {
    nick: String(nick || '').toLowerCase(),
    token: String(token || ''),
    joined: new Set(),
    confirmed: new Set(),
    scheduler: new JoinScheduler(),
    reconnectDelayMs: 5000,
  };
}

function setChannels(session, wanted) {
  const wantedSet = new Set(Array.from(wanted || []).map((c) => String(c).toLowerCase()));
  const parts = [];
  for (const channel of session.joined) {
    if (!wantedSet.has(channel)) {
      parts.push(channel);
      session.joined.delete(channel);
      session.confirmed.delete(channel);
      session.scheduler.remove(channel);
    }
  }
  const need = [];
  for (const channel of wantedSet) {
    if (!session.joined.has(channel)) need.push(channel);
  }
  const toJoin = session.scheduler.enqueue(need);
  return { joins: toJoin, parts };
}

function handleIrcLine(session, line) {
  const commands = [];
  if (typeof line !== 'string' || !line) return { commands };

  if (line.startsWith('PING ')) {
    let payload = line.slice(5).trim();
    if (payload.startsWith(':')) payload = payload.slice(1);
    if (!payload) payload = 'tmi.twitch.tv';
    commands.push({ type: 'pong', payload });
    return { commands };
  }

  if (line.includes(' RECONNECT')) {
    resetReconnectDelay(session);
    commands.push({ type: 'reconnect' });
    return { commands };
  }

  if (line.includes(' NOTICE ')) {
    const lower = line.toLowerCase();
    if (lower.includes('authentication failed') || lower.includes('improperly formatted auth')) {
      return { commands: [{ type: 'authFailed' }], authFailed: true };
    }
    return { commands };
  }

  if (line.startsWith(':')) {
    const rest = line.slice(1);
    const space = rest.indexOf(' ');
    if (space > 0) {
      const trailing = rest.slice(space + 1);
      if (trailing.startsWith('JOIN ')) {
        const channel = trailing.split(/\s+/)[1];
        if (channel) {
          const name = channel.replace(/^#/, '').toLowerCase();
          if (name) session.confirmed.add(name);
        }
      }
    }
  }

  const parts = line.split(/\s+/);
  if (parts.length >= 2) {
    const cmd = parts[1];
    if (cmd === '001') {
      resetReconnectDelay(session);
      commands.push({ type: 'registered' });
    } else if (cmd === '366' && parts.length >= 4) {
      const name = parts[3].replace(/^#/, '').toLowerCase();
      if (name) session.confirmed.add(name);
    } else if (cmd === 'JOIN' && parts.length >= 3) {
      const name = parts[2].replace(/^#/, '').toLowerCase();
      if (name) session.confirmed.add(name);
    }
  }

  return { commands };
}

module.exports = {
  splitIrcPayload,
  handleIrcLine,
  formatPass,
  formatNick,
  formatJoin,
  formatPart,
  JoinScheduler,
  createIrcSession,
  setChannels,
  nextReconnectDelay,
  resetReconnectDelay,
  MAX_JOINS,
  WINDOW_MS,
};
