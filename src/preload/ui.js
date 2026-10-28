const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mesa', {
  loadCfg: () => ipcRenderer.invoke('cfg:load'),
  saveCfg: (data, ticket) => ipcRenderer.invoke('cfg:save', data, ticket),
  flushCfg: (data, ticket) => ipcRenderer.sendSync('cfg:flush', data, ticket),
  metrics: () => ipcRenderer.invoke('metrics:get'),
  perfReport: () => ipcRenderer.invoke('perf:report'),
  perfReset: () => ipcRenderer.invoke('perf:reset'),
  paths: () => ipcRenderer.invoke('app:paths'),
  tune: (index, playing) => ipcRenderer.send('bay:tune', index, playing === true),
  resetBay: (index) => ipcRenderer.invoke('bay:reset', index),
  huntReference: () => ipcRenderer.invoke('hunt:reference'),
  liveGet: () => ipcRenderer.invoke('live:get'),
  liveAuthorize: () => ipcRenderer.invoke('live:authorize'),
  liveOpenTwitch: () => ipcRenderer.invoke('live:open-twitch'),
  liveDisconnect: () => ipcRenderer.invoke('live:disconnect'),
  liveClientId: (clientId) => ipcRenderer.invoke('live:client-id', clientId),
  liveChannel: (login, enabled) => ipcRenderer.invoke('live:channel', login, enabled),
  liveManualAdd: (login) => ipcRenderer.invoke('live:manual-add', login),
  liveManualRemove: (login) => ipcRenderer.invoke('live:manual-remove', login),
  liveKickOpen: (slug) => ipcRenderer.invoke('live:kick-open', slug),
  onLiveStatus: (handler) => {
    if (typeof handler !== 'function') return;
    ipcRenderer.on('live:status', (_event, snapshot) => handler(snapshot));
  },
});
