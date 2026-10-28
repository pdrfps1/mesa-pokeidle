const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mesa', {
  loadCfg: () => ipcRenderer.invoke('cfg:load'),
  saveCfg: (data, ticket) => ipcRenderer.invoke('cfg:save', data, ticket),
  flushCfg: (data, ticket) => ipcRenderer.sendSync('cfg:flush', data, ticket),
  metrics: () => ipcRenderer.invoke('metrics:get'),
  paths: () => ipcRenderer.invoke('app:paths'),
  tune: (index) => ipcRenderer.send('bay:tune', index),
  resetBay: (index) => ipcRenderer.invoke('bay:reset', index),
  huntReference: () => ipcRenderer.invoke('hunt:reference'),
});
