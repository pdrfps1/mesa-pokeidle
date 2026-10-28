function readUrl(details, url) {
  if (details && typeof details.url === 'string') return details.url;
  return typeof url === 'string' ? url : '';
}

function openOutside(shell, url) {
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { return; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return;
  try { shell.openExternal(parsed.href); } catch { /* o sistema recusou o endereço */ }
}

function installGuest(contents, deps) {
  const { sessionKind, hostKind, shell } = deps;
  const kindOf = () => sessionKind(contents.session);

  contents.on('will-navigate', (event, url) => {
    const target = readUrl(event, url);
    if (hostKind(target) === kindOf()) return;
    event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    const target = readUrl(event, url);
    if (hostKind(target) !== kindOf()) event.preventDefault();
  });
  contents.setWindowOpenHandler((details) => {
    const url = details.url || '';
    if (/^https:\/\//.test(url) && hostKind(url) !== kindOf()) openOutside(shell, url);
    return { action: 'deny' };
  });
}

module.exports = { installGuest };
