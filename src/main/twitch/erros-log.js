'use strict';

// Log de erros do resgate da Twitch: uma linha JSON por evento, em userData/logs. Nunca lança.
const fs = require('fs');
const path = require('path');

const P = require('./points');

const LIMITE_PADRAO_BYTES = 512 * 1024;
const CAMPOS = ['baia', 'tipo', 'motivo', 'fase', 'trava', 'clicou', 'pausado', 'detalhe', 'canal', 'stream'];

function caminhoPadrao(userDataDir) {
  return path.join(userDataDir, 'logs', 'twitch-resgate.log');
}

function caminhoRodizio(caminho) {
  return path.join(path.dirname(caminho), path.basename(caminho, '.log') + '.1.log');
}

// Número de ms vira ISO; NaN, Infinity ou fora da faixa de Date viram null (campo omitido), sem lançar.
function paraIsoSeFinito(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function montarLinha(entrada, agora) {
  const linha = { em: new Date(agora()).toISOString() };
  const origem = entrada && typeof entrada === 'object' ? entrada : {};
  for (const k of CAMPOS) {
    if (k === 'pausado') continue;
    const v = origem[k];
    if (v === undefined || v === null || v === '') continue;
    // Canal só entra como login validado; vaga só como inteiro de 0 a 3. Texto da página nunca passa.
    if (k === 'canal') {
      if (P.loginValido(v)) linha.canal = v.trim().toLowerCase();
      continue;
    }
    if (k === 'stream') {
      if (Number.isInteger(v) && v >= 0 && v <= 3) linha.stream = v;
      continue;
    }
    linha[k] = v;
  }
  const pausado = paraIsoSeFinito(origem.pausado);
  if (pausado !== null) linha.pausado = pausado;
  return linha;
}

function rodarSeGrande(caminho, limiteBytes) {
  let tamanho = 0;
  try {
    tamanho = fs.statSync(caminho).size;
  } catch {
    return;
  }
  if (tamanho <= limiteBytes) return;
  const destino = caminhoRodizio(caminho);
  fs.rmSync(destino, { force: true });
  fs.renameSync(caminho, destino);
}

function registrarErro(entrada, opcoes) {
  const o = opcoes || {};
  const caminho = o.caminho;
  const agora = typeof o.agora === 'function' ? o.agora : () => Date.now();
  const limiteBytes = Number.isFinite(o.limiteBytes) ? o.limiteBytes : LIMITE_PADRAO_BYTES;
  try {
    const linha = JSON.stringify(montarLinha(entrada, agora));
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    rodarSeGrande(caminho, limiteBytes);
    fs.appendFileSync(caminho, linha + '\n', 'utf8');
  } catch (err) {
    try {
      console.warn('[twitch] falha ao gravar log de resgate:', err && err.name ? err.name : 'erro');
    } catch {
      /* console indisponível: nada a fazer */
    }
  }
}

function lerUltimosErros(caminho, n) {
  try {
    const total = Number.isInteger(n) && n > 0 ? n : 0;
    if (!total) return [];
    const linhas = fs.readFileSync(caminho, 'utf8').split('\n');
    const validas = [];
    for (const lin of linhas) {
      if (!lin.trim()) continue;
      try {
        validas.push(JSON.parse(lin));
      } catch {
        /* linha inválida: ignora */
      }
    }
    return validas.slice(-total);
  } catch {
    return [];
  }
}

module.exports = {
  caminhoPadrao,
  registrarErro,
  lerUltimosErros,
  montarLinha,
  LIMITE_PADRAO_BYTES,
};
