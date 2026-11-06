'use strict';

// Leitura de login da Twitch por baía, com geração: uma leitura que volta depois de sair da baía é descartada (A-5).
function criarLeitorDeLogin({ ler, aplicar }) {
  const geracoes = new Map();
  const geracaoDe = (i) => geracoes.get(i) || 0;
  return {
    ler(i) {
      const g = geracaoDe(i);
      return ler(i).then((login) => {
        if (geracaoDe(i) === g) aplicar(i, login);
      });
    },
    invalidar(i) {
      geracoes.set(i, geracaoDe(i) + 1);
    },
  };
}

// Sair da baía: invalida antes e de novo no finally, para que uma leitura iniciada durante a limpeza não volte a valer.
async function sairComInvalidacao(leitor, i, sair) {
  leitor.invalidar(i);
  try {
    await sair();
  } finally {
    leitor.invalidar(i);
  }
}

module.exports = { criarLeitorDeLogin, sairComInvalidacao };
