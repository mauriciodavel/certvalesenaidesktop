const { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, shell } = require('electron');
const { existsSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'certifica', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

let mainWindow;
const tokenPath = () => path.join(app.getPath('userData'), 'access-token.bin');

function registerSecureTokenStore() {
  ipcMain.handle('auth:get-token', async () => {
    try {
      if (!existsSync(tokenPath())) return null;
      const decrypted = await safeStorage.decryptStringAsync(readFileSync(tokenPath()));
      if (decrypted.shouldReEncrypt) writeFileSync(tokenPath(), await safeStorage.encryptStringAsync(decrypted.result), { mode: 0o600 });
      return decrypted.result;
    }
    catch { rmSync(tokenPath(), { force: true }); return null; }
  });
  ipcMain.handle('auth:set-token', async (_event, token) => {
    if (typeof token !== 'string' || token.length < 20 || token.length > 10_000) throw new Error('Token inválido.');
    if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('A proteção de credenciais do Windows não está disponível.');
    writeFileSync(tokenPath(), await safeStorage.encryptStringAsync(token), { mode: 0o600 });
    return true;
  });
  ipcMain.handle('auth:clear-token', () => { rmSync(tokenPath(), { force: true }); return true; });
}

async function registerAppProtocol() {
  const root = path.resolve(app.getAppPath(), 'dist');
  await protocol.handle('certifica', request => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const resolved = path.resolve(root, relative);
    const safePath = resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : path.join(root, 'index.html');
    const target = existsSync(safePath) ? safePath : path.join(root, 'index.html');
    return net.fetch(pathToFileURL(target).toString());
  });
}

async function start() {
  // Remove automaticamente a configuração legada que continha credenciais do TiDB.
  rmSync(path.join(app.getPath('userData'), 'config.env'), { force: true });
  registerSecureTokenStore();
  await registerAppProtocol();
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 360, minHeight: 600, show: false,
    autoHideMenuBar: true, backgroundColor: '#f3f6fb',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('certifica://app/')) event.preventDefault(); });
  await mainWindow.loadURL('certifica://app/index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('Falha ao iniciar', error instanceof Error ? error.message : String(error)); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
