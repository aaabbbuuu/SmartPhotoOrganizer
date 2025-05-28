const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Best practice
      contextIsolation: true, // Best practice
      preload: path.join(__dirname, 'preload.js'), // Point to preload script
    },
  });

  win.loadURL(
    isDev
      ? 'http://localhost:3000' // Dev server URL
      : `file://${path.join(__dirname, '../build/index.html')}` // Production build
  );

  if (isDev) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handler for opening directory dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (canceled || filePaths.length === 0) {
    return null;
  } else {
    return filePaths[0];
  }
});

// IPC handler for getting userData path (useful for future persistent storage)
ipcMain.handle('get-app-path', async (event, pathName) => {
    return app.getPath(pathName); // e.g., 'userData', 'temp'
});