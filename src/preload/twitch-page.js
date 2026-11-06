// Preload da janela da Twitch. Lê fatos e executa comandos do main. Nada é exposto à página.
const { ipcRenderer } = require('electron');

(function () {
  // Só o frame principal: iframes de *.twitch.tv não mandam fatos nem executam comandos.
  if (window.top !== window) return;
  if (!/(^|\.)twitch\.tv$/.test(location.hostname)) return;
  const D = MESA_TWITCH_DOM;

  // Qualidade mínima do player. Se a chave mudar, o custo de CPU só sobe; nada quebra.
  try {
    localStorage.setItem('video-quality', JSON.stringify({ default: '160p30' }));
  } catch { /* armazenamento bloqueado: segue no padrão da Twitch */ }

  let anterior = { tempo: -1 };
  let ocupado = false;

  function enviarResultado(resultado) {
    ipcRenderer.send('twitch:pagina', { resultado });
  }

  function ciclo() {
    const lido = D.lerFatos(document, location, anterior);
    anterior = lido.anterior;
    ipcRenderer.send('twitch:pagina', { fatos: lido.fatos });
  }

  setInterval(ciclo, 3000);
  ciclo();

  ipcRenderer.on('twitch:comando', (_event, cmd) => {
    if (!cmd || typeof cmd !== 'object') return;
    if (cmd.tipo === 'portao') {
      D.clicar(D.primeiro(document, D.SELETORES.portao));
      return;
    }
    if (cmd.tipo === 'play') {
      D.clicar(D.primeiro(document, D.SELETORES.play));
      return;
    }
    if (cmd.tipo === 'bau') {
      D.clicar(D.acharBau(document));
      return;
    }
    if (cmd.tipo === 'resgatar') {
      if (ocupado) {
        enviarResultado({ id: cmd.id, estado: 'falhou', motivo: 'ocupado' });
        return;
      }
      ocupado = true;
      D.resgatar(document, { titulo: cmd.titulo, custo: cmd.custo }, { esperar: D.esperar, pausa: D.pausa })
        .then((res) => enviarResultado({ id: cmd.id, estado: res.estado, motivo: res.motivo, trava: res.trava, vistos: res.vistos, fase: res.fase, clicou: res.clicou, pistas: res.pistas, pistasAntes: res.pistasAntes, dialogoAntes: res.dialogoAntes, dialogos: res.dialogos, cabecalho: res.cabecalho, classes: res.classes }))
        .catch(() => enviarResultado({ id: cmd.id, estado: 'falhou', motivo: 'outro' }))
        .finally(() => { ocupado = false; });
    }
  });
})();
