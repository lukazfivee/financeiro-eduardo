const { app, BrowserWindow, shell, session, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = 'https://financeiro-eduardo.construtec-reports.workers.dev';
const APP_VERSION = '0.3.0';
const LOCAL = process.env.FINANCEIRO_LOCAL === '1';
const MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: !LOCAL,
      devTools: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (LOCAL) {
    const publicDir = path.join(app.getAppPath(), 'public');
    protocol.handle('app', async (req) => {
      const u = new URL(req.url);
      if (u.pathname.startsWith('/api/') || u.pathname === '/health') {
        const remote = await fetch(`${APP_URL}${u.pathname}${u.search}`, { method: req.method, headers: Object.fromEntries(req.headers), body: ['POST','PUT'].includes(req.method) ? req.body : undefined });
        return new Response(remote.body, { status: remote.status, headers: remote.headers });
      }
      let filePath = path.join(publicDir, u.pathname === '/' ? 'index.html' : u.pathname);
      if (!fs.existsSync(filePath)) filePath = path.join(publicDir, 'index.html');
      const ext = path.extname(filePath);
      return new Response(fs.createReadStream(filePath), { headers: { 'content-type': MIME[ext] || 'application/octet-stream' } });
    });
    win.loadURL('app://index.html');
  } else {
    win.loadURL(`${APP_URL}/?appVersion=${APP_VERSION}`);
  }
}

if (LOCAL) {
  protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } }]);
}

app.whenReady().then(() => {
  session.defaultSession.clearCache().catch(() => {});
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Windows desktop shell for Financeiro Eduardo.
