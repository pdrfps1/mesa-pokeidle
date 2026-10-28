const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function emit(payload) {
  process.stdout.write(JSON.stringify(payload));
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function stagedHash(cwd) {
  const diff = git(cwd, ['diff', '--cached', '--binary', '--no-color']);
  return crypto.createHash('sha256').update(diff).digest('hex');
}

function stampFile(cwd) {
  const relative = git(cwd, ['rev-parse', '--git-path', 'revisor-commit-ok']).trim();
  return path.resolve(cwd, relative);
}

function carimbar() {
  const cwd = process.cwd();
  const hash = stagedHash(cwd);
  fs.mkdirSync(path.dirname(stampFile(cwd)), { recursive: true });
  fs.writeFileSync(stampFile(cwd), `${hash}\n`, 'utf8');
  process.stdout.write(`${hash}\n`);
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function isCommit(command) {
  return /\bgit(?:\.exe)?\b[\s\S]*\bcommit\b/i.test(command);
}

async function main() {
  if (process.argv.includes('--carimbar')) {
    carimbar();
    return;
  }

  let input = {};
  try {
    input = JSON.parse((await readStdin()) || '{}');
  } catch {
    input = {};
  }

  const command = String(input.command || '');
  if (!isCommit(command)) {
    emit({ permission: 'allow' });
    return;
  }

  const cwd = input.cwd || process.cwd();
  let hash = '';
  try {
    hash = stagedHash(cwd);
  } catch (error) {
    emit({
      permission: 'deny',
      user_message: 'O commit ficou parado: não deu para ler o diff staged.',
      agent_message: `Commit bloqueado em ${cwd}. ${error.message} Chame o subagent revisor-codigo antes de tentar de novo.`,
    });
    return;
  }

  let stamp = '';
  try {
    stamp = fs.readFileSync(stampFile(cwd), 'utf8').trim();
  } catch {
    stamp = '';
  }

  if (stamp === hash) {
    emit({ permission: 'allow' });
    return;
  }

  const script = __filename;
  emit({
    permission: 'deny',
    user_message: 'O revisor de código precisa revisar este commit antes.',
    agent_message: [
      'Commit bloqueado. O diff staged ainda não passou pelo revisor-codigo.',
      '1. Chame o subagent revisor-codigo com model composer-2.5 e o git diff --cached deste repositório.',
      '2. Se a primeira linha disser que não há achado obrigatório, no mesmo diretório do repositório rode:',
      `node "${script}" --carimbar`,
      '3. Repita o git commit. Se houver achado obrigatório, não carimbe e não commite.',
    ].join('\n'),
  });
}

main().catch((error) => {
  emit({
    permission: 'deny',
    user_message: 'O commit ficou parado porque a revisão obrigatória falhou.',
    agent_message: `Hook de revisão falhou: ${error.message}`,
  });
  process.exitCode = 0;
});
