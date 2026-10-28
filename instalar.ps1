# Instala o que a Mesa precisa e abre o aplicativo.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
  $nodeDir = Join-Path ${env:ProgramFiles} 'nodejs'
  if (Test-Path $nodeDir) { $env:Path = "$nodeDir;$env:Path" }
}

function Find-Node {
  Refresh-Path
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $fallback = Join-Path ${env:ProgramFiles} 'nodejs\node.exe'
  if (Test-Path $fallback) { return $fallback }
  return $null
}

Write-Host 'Mesa: preparando este computador...'

if (-not (Find-Node)) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw 'O Node.js não está instalado e o winget não foi encontrado. Instale o Node.js LTS em https://nodejs.org e rode este instalador de novo.'
  }
  Write-Host 'Instalando o Node.js LTS. O Windows pode pedir permissão de administrador.'
  & winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    throw 'A instalação do Node.js pelo winget falhou. Rode instalar.cmd como administrador ou instale o Node.js LTS em https://nodejs.org e tente de novo.'
  }
  if (-not (Find-Node)) {
    throw 'O Node.js foi instalado, mas esta janela ainda não o enxerga. Feche e rode o instalador de novo.'
  }
}

Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
Write-Host "Node.js: $(& node --version)"
Write-Host 'Instalando as dependências da Mesa...'
& npm.cmd install --include=dev
if ($LASTEXITCODE -ne 0) { throw 'npm install falhou.' }

Write-Host 'Abrindo a Mesa...'
& npm.cmd start
if ($LASTEXITCODE -ne 0) { throw 'A Mesa não abriu.' }
