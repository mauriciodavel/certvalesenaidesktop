const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('authStore', {
  getToken: () => ipcRenderer.invoke('auth:get-token'),
  setToken: token => ipcRenderer.invoke('auth:set-token', token),
  clearToken: () => ipcRenderer.invoke('auth:clear-token'),
});
