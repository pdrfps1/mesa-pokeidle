function chromeUserAgent(version) {
  const chrome = version || (typeof process !== 'undefined' && process.versions && process.versions.chrome) || '';
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`;
}

module.exports = { chromeUserAgent };
