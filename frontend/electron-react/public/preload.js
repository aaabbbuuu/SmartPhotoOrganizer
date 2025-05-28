const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  getAppPath: (pathName) => ipcRenderer.invoke('get-app-path', pathName)
  // Can add more functions here as needed
});