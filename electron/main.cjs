const { app, BrowserWindow, dialog, shell } = require('electron');
const { existsSync, copyFileSync, mkdirSync } = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const dotenv = require('dotenv');

let mainWindow;

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function configPath() {
  if (!app.isPackaged) return path.join(app.getAppPath(), 'desktop-config.env');
  const userConfig = path.join(app.getPath('userData'), 'config.env');
  if (!existsSync(userConfig)) {
    const packagedConfig = path.join(process.resourcesPath, 'desktop-config.env');
    if (existsSync(packagedConfig)) {
      mkdirSync(path.dirname(userConfig), { recursive: true });
      copyFileSync(packagedConfig, userConfig);
    }
  }
  return userConfig;
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('O servidor local não respondeu no tempo esperado.');
}

async function start() {
  const settings = configPath();
  if (!existsSync(settings)) {
    dialog.showErrorBox('Configuração ausente', `Não foi encontrado o arquivo de configuração do TiDB:\n${settings}`);
    app.quit();
    return;
  }
  dotenv.config({ path: settings, override: true });
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  process.env.PORT = String(port);
  process.env.APP_ORIGIN = origin;
  process.env.NODE_ENV = 'production';

  await import(pathToFileURL(path.join(app.getAppPath(), 'dist-server', 'index.js')).href);
  await waitForServer(origin);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 360,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f3f6fb',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(origin)) event.preventDefault();
  });
  await mainWindow.loadURL(origin);
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('Falha ao iniciar', error instanceof Error ? error.message : String(error));
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
}
