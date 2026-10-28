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
});
