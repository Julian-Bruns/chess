const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const { execFile, execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');

const stockfishApi = 'https://api.github.com/repos/official-stockfish/Stockfish/releases/latest';
const appReleaseApi = 'https://api.github.com/repos/Julian-Bruns/chess/releases/tags/latest';
const appName = 'Chessfish';
const userAgent = 'chessfish/0.1.0';

let mainWindow = null;
let engineProcess = null;
let engineBuffer = '';
let updatePromise = null;

function createWindow() {
  const window = new BrowserWindow({
    width: 860,
    height: 920,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#10100e',
    title: appName,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow = window;
  window.setMenuBarVisibility(false);
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function createApplicationMenu() {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: appName,
      submenu: [
        { role: 'about', label: `About ${appName}` },
        { type: 'separator' },
        { role: 'hide', label: `Hide ${appName}` },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: `Quit ${appName}` }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ]));
}

app.setName(appName);
app.whenReady().then(() => {
  createApplicationMenu();
  createWindow();
});

app.on('before-quit', () => {
  stopEngine();
});

app.on('window-all-closed', () => {
  stopEngine();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('stockfish:checkForUpdate', async () => {
  return checkForUpdate();
});

ipcMain.handle('app:updateEverything', async () => {
  return updateEverything();
});

ipcMain.handle('stockfish:start', async () => {
  if (engineProcess) {
    return { path: engineProcess.spawnfile };
  }

  await checkForUpdate();
  const enginePath = await locateEngine();
  sendStatus(`starting ${path.basename(enginePath)}`);

  engineProcess = spawn(enginePath, [], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  engineProcess.stdout.setEncoding('utf8');
  engineProcess.stderr.setEncoding('utf8');
  engineProcess.stdout.on('data', emitEngineLines);
  engineProcess.stderr.on('data', (chunk) => sendStatus(String(chunk).trim()));
  engineProcess.on('exit', (code, signal) => {
    sendStatus(`stopped ${code ?? signal ?? ''}`.trim());
    engineProcess = null;
    engineBuffer = '';
  });

  return { path: enginePath };
});

ipcMain.handle('stockfish:write', async (_event, command) => {
  if (!engineProcess || !engineProcess.stdin.writable) {
    throw new Error('Stockfish is not running');
  }

  engineProcess.stdin.write(`${command}\n`);
});

ipcMain.handle('stockfish:stop', async () => {
  stopEngine();
});

function stopEngine() {
  if (!engineProcess) {
    return;
  }

  const child = engineProcess;
  engineProcess = null;
  try {
    child.stdin.write('quit\n');
  } catch {
    // Process may already be gone.
  }

  setTimeout(() => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }, 350);
}

function emitEngineLines(chunk) {
  engineBuffer += chunk;
  const lines = engineBuffer.split(/\r?\n/);
  engineBuffer = lines.pop() ?? '';

  for (const line of lines) {
    if (line.trim()) {
      sendToWindow('stockfish:line', line.trim());
    }
  }
}

function sendStatus(status) {
  if (status) {
    sendToWindow('stockfish:status', status);
  }
}

function sendToWindow(channel, ...args) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(channel, ...args);
}

async function checkForUpdate() {
  if (process.platform !== 'darwin') {
    return { updated: false, message: 'Runtime updates are only enabled in the macOS Electron shell' };
  }

  if (!updatePromise) {
    updatePromise = updateStockfish().finally(() => {
      updatePromise = null;
    });
  }

  return updatePromise;
}

async function updateEverything() {
  const result = {
    status: 'unavailable',
    message: '',
    engineUpdate: null,
    appUpdate: null
  };

  try {
    result.engineUpdate = await checkForUpdate();
  } catch (error) {
    result.engineUpdate = {
      updated: false,
      message: error instanceof Error ? error.message : 'Could not update Stockfish'
    };
  }

  try {
    result.appUpdate = await downloadLatestAppInstaller();
  } catch (error) {
    result.appUpdate = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not update Chessfish'
    };
  }

  const appUpdate = result.appUpdate;
  const engineUpdate = result.engineUpdate;

  if (appUpdate?.status === 'opened') {
    return {
      status: 'opened',
      message: engineUpdate?.updated
        ? 'Stockfish updated. Finish the Chessfish installer to update the app.'
        : appUpdate.message,
      releaseTag: appUpdate.releaseTag,
      path: appUpdate.path,
      engineUpdate,
      appUpdate
    };
  }

  if (engineUpdate?.updated) {
    return {
      status: 'updated',
      message: 'Stockfish updated. No app installer is available.',
      engineUpdate,
      appUpdate
    };
  }

  return {
    status: appUpdate?.status ?? 'unavailable',
    message: appUpdate?.message || engineUpdate?.message || 'No updates are available.',
    releaseTag: appUpdate?.releaseTag,
    path: appUpdate?.path,
    engineUpdate,
    appUpdate
  };
}

async function downloadLatestAppInstaller() {
  if (process.platform !== 'darwin') {
    return {
      status: 'unavailable',
      message: 'App installer updates are only enabled for the macOS app.'
    };
  }

  let release;
  try {
    release = await getJson(appReleaseApi);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Could not read latest release';
    return {
      status: 'unavailable',
      message: `${detail}. Publish the latest release assets publicly, or download them from GitHub Actions.`
    };
  }

  let releaseManifest = null;
  try {
    releaseManifest = await readReleaseAppManifest(release);
  } catch {
    releaseManifest = null;
  }

  const currentManifest = await readPackagedAppManifest() ?? {
    appVersion: app.getVersion(),
    buildNumber: -1
  };

  if (releaseManifest && !isNewerAppManifest(releaseManifest, currentManifest)) {
    return {
      status: 'current',
      releaseTag: release.tag_name,
      message: 'You are up to date'
    };
  }

  const asset = selectMacInstallerAsset(release.assets ?? []);
  if (!asset?.browser_download_url) {
    return {
      status: 'unavailable',
      releaseTag: release.tag_name,
      message: 'No macOS Chessfish installer was found in the latest release.'
    };
  }

  const updateDir = path.join(app.getPath('downloads'), 'Chessfish Updates');
  const installerPath = path.join(updateDir, safeFileName(asset.name));
  await fsp.mkdir(updateDir, { recursive: true });

  let shouldDownload = true;
  try {
    const stat = await fsp.stat(installerPath);
    shouldDownload = Number(asset.size) > 0 && stat.size !== Number(asset.size);
  } catch {
    shouldDownload = true;
  }

  if (shouldDownload) {
    await download(asset.browser_download_url, installerPath);
  }

  const openError = await shell.openPath(installerPath);
  if (openError) {
    throw new Error(openError);
  }

  return {
    status: 'opened',
    releaseTag: release.tag_name,
    path: installerPath,
    message: 'Finish the Chessfish installer to update the app.'
  };
}

function selectMacInstallerAsset(assets) {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const installers = assets.filter((asset) => /\.dmg$/i.test(asset.name ?? ''));
  return (
    installers.find((asset) => new RegExp(`chessfish.*macos.*${arch}`, 'i').test(asset.name)) ??
    installers.find((asset) => new RegExp(`chessfish.*${arch}`, 'i').test(asset.name)) ??
    installers.find((asset) => /chessfish.*macos/i.test(asset.name)) ??
    installers.find((asset) => /chessfish/i.test(asset.name)) ??
    installers[0]
  );
}

function safeFileName(name) {
  return String(name || 'Chessfish.dmg').replace(/[/:\\]/g, '-');
}

async function readReleaseAppManifest(release) {
  const asset = (release.assets ?? []).find((item) => item.name === 'update-manifest.json');
  if (!asset?.browser_download_url) {
    return null;
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'chessfish-app-update-'));
  try {
    const manifestPath = path.join(tempDir, 'update-manifest.json');
    await download(asset.browser_download_url, manifestPath);
    return JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function readPackagedAppManifest() {
  const manifests = [
    path.join(resourceRoot(), 'dist', 'update-manifest.json'),
    path.join(resourceRoot(), 'update-manifest.json')
  ];

  for (const manifestPath of manifests) {
    try {
      return JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
    } catch {
      // Try the next location.
    }
  }

  return null;
}

function isNewerAppManifest(latest, current) {
  const latestBuild = Number(latest?.buildNumber);
  const currentBuild = Number(current?.buildNumber);

  if (Number.isFinite(latestBuild) && Number.isFinite(currentBuild)) {
    return latestBuild > currentBuild;
  }

  const versionDiff = compareVersions(String(latest?.appVersion ?? ''), String(current?.appVersion ?? ''));
  return versionDiff > 0;
}

function compareVersions(left, right) {
  const leftParts = left.split(/[.-]/).map((part) => Number(part) || 0);
  const rightParts = right.split(/[.-]/).map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

async function updateStockfish() {
  const variant = selectMacVariant();
  const current = await readCurrentManifest();

  let release;
  try {
    release = await getJson(stockfishApi);
  } catch (error) {
    return {
      updated: false,
      releaseTag: current?.releaseTag,
      message: error instanceof Error ? error.message : 'Could not check Stockfish release'
    };
  }

  const existingUpdatedEngine = path.join(userEngineDir(), variant.fileName);
  if (current?.releaseTag === release.tag_name && fs.existsSync(existingUpdatedEngine)) {
    return { updated: false, releaseTag: release.tag_name, message: 'Stockfish is current' };
  }

  if (current?.releaseTag === release.tag_name && fs.existsSync(await bundledEnginePath())) {
    return { updated: false, releaseTag: release.tag_name, message: 'Bundled Stockfish is current' };
  }

  const asset = release.assets.find((item) => variant.asset.test(item.name));
  if (!asset) {
    return { updated: false, releaseTag: release.tag_name, message: `No ${variant.key} asset found` };
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'stockfish-update-'));
  try {
    const archive = path.join(tempDir, asset.name);
    const extractDir = path.join(tempDir, 'extract');
    await download(asset.browser_download_url, archive);
    await fsp.mkdir(extractDir, { recursive: true });
    await execFilePromise('tar', ['-xf', archive, '-C', extractDir]);

    const binary = await findStockfishBinary(extractDir);
    await fsp.mkdir(userEngineDir(), { recursive: true });
    await fsp.copyFile(binary, existingUpdatedEngine);
    await fsp.chmod(existingUpdatedEngine, 0o755);
    await fsp.writeFile(
      path.join(userEngineDir(), 'manifest.json'),
      `${JSON.stringify({
        releaseTag: release.tag_name,
        releaseName: release.name,
        releaseUrl: release.html_url,
        asset: asset.name,
        updatedAt: new Date().toISOString()
      }, null, 2)}\n`
    );

    return { updated: true, releaseTag: release.tag_name, message: 'Stockfish updated' };
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function locateEngine() {
  const variant = selectMacVariant();
  const updated = path.join(userEngineDir(), variant.fileName);
  if (fs.existsSync(updated)) {
    return updated;
  }

  const bundled = await bundledEnginePath();
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  const fallback = bundledFallbacks(variant).find((candidate) => fs.existsSync(candidate));
  if (fallback) {
    return fallback;
  }

  throw new Error('Stockfish binary is missing. Run npm run update:stockfish.');
}

function resourceRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
}

function userEngineDir() {
  return path.join(app.getPath('userData'), 'engines');
}

async function bundledEnginePath() {
  const variant = selectMacVariant();
  return path.join(resourceRoot(), 'engines', 'macos', process.arch === 'arm64' ? 'arm64' : 'x64', variant.fileName);
}

function bundledFallbacks(variant) {
  if (process.arch === 'arm64') {
    return [path.join(resourceRoot(), 'engines', 'macos', 'arm64', 'stockfish')];
  }

  const names = [variant.fileName, 'stockfish-bmi2', 'stockfish-avx2', 'stockfish-popcnt', 'stockfish'];
  return [...new Set(names)].map((name) => path.join(resourceRoot(), 'engines', 'macos', 'x64', name));
}

function selectMacVariant() {
  if (process.arch === 'arm64') {
    return {
      key: 'macos-arm64',
      fileName: 'stockfish',
      asset: /^stockfish-macos-m1-apple-silicon\.tar$/
    };
  }

  const features = cpuFeatures();
  if (features.includes('BMI2')) {
    return {
      key: 'macos-x64-bmi2',
      fileName: 'stockfish-bmi2',
      asset: /^stockfish-macos-x86-64-bmi2\.tar$/
    };
  }

  if (features.includes('AVX2')) {
    return {
      key: 'macos-x64-avx2',
      fileName: 'stockfish-avx2',
      asset: /^stockfish-macos-x86-64-avx2\.tar$/
    };
  }

  if (features.includes('SSE4.1') && features.includes('POPCNT')) {
    return {
      key: 'macos-x64-popcnt',
      fileName: 'stockfish-popcnt',
      asset: /^stockfish-macos-x86-64-sse41-popcnt\.tar$/
    };
  }

  return {
    key: 'macos-x64',
    fileName: 'stockfish',
    asset: /^stockfish-macos-x86-64\.tar$/
  };
}

function cpuFeatures() {
  try {
    return execFileSync('sysctl', ['-n', 'machdep.cpu.features'], { encoding: 'utf8' }).toUpperCase().split(/\s+/);
  } catch {
    return [];
  }
}

async function readCurrentManifest() {
  const manifests = [
    path.join(userEngineDir(), 'manifest.json'),
    path.join(resourceRoot(), 'engine-manifest.json')
  ];

  for (const manifestPath of manifests) {
    try {
      return JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
    } catch {
      // Try the next location.
    }
  }

  return null;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': userAgent
      }
    }, (response) => {
      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error(`GitHub returned ${response.statusCode}`));
        response.resume();
        return;
      }

      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
  });
}

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, {
      headers: {
        'User-Agent': userAgent
      }
    }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.rmSync(outPath, { force: true });
        download(response.headers.location, outPath).then(resolve, reject);
        return;
      }

      if (!response.statusCode || response.statusCode >= 400) {
        file.close();
        fs.rmSync(outPath, { force: true });
        reject(new Error(`Download failed with ${response.statusCode}`));
        response.resume();
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (error) => {
      file.close();
      fs.rmSync(outPath, { force: true });
      reject(error);
    });
  });
}

function execFilePromise(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function findStockfishBinary(dir) {
  const files = await walk(dir);
  const candidates = [];

  for (const file of files) {
    const base = path.basename(file);
    if (!base.startsWith('stockfish') || base.endsWith('.txt') || base.endsWith('.md')) {
      continue;
    }

    const stat = await fsp.stat(file);
    if (stat.size > 1024 * 1024) {
      candidates.push(file);
    }
  }

  if (candidates.length === 0) {
    throw new Error('No Stockfish executable found in archive');
  }

  return candidates.sort((a, b) => path.basename(a).localeCompare(path.basename(b)))[0];
}

async function walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}
