const POKEIDLE_ORIGIN = 'https://pokeidle.io';
const POKEIDLE_APP_URL = 'https://pokeidle.io/app';

const SAME_SITE = { Strict: 'strict', Lax: 'lax', None: 'no_restriction' };

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function isPokeidleHost(host) {
  return host === 'pokeidle.io' || host.endsWith('.pokeidle.io');
}

function isPokeidleCookie(cookie) {
  if (!cookie || typeof cookie.domain !== 'string') return false;
  const bare = cookie.domain.replace(/^\./, '').toLowerCase();
  return isPokeidleHost(bare);
}

function isLoggedInStorage(storage) {
  return !!(storage && typeof storage === 'object' && storage.sessao);
}

function sameSiteForElectron(value) {
  if (typeof value !== 'string') return 'unspecified';
  return SAME_SITE[value] ?? 'unspecified';
}

function cookieSetUrl(cookie) {
  const bare = cookie.domain.replace(/^\./, '');
  return `https://${bare}${cookie.path || '/'}`;
}

module.exports = {
  POKEIDLE_ORIGIN,
  POKEIDLE_APP_URL,
  hostOf,
  isPokeidleHost,
  isPokeidleCookie,
  isLoggedInStorage,
  sameSiteForElectron,
  cookieSetUrl,
};
