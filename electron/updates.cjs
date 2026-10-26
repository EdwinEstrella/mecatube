// App updates through electron-updater (GitHub releases). Only active in the installed app.
// State pushed to the renderer: { status: 'idle'|'checking'|'available'|'none'|'downloading'|'downloaded'|'error'|'dev', version?, message? }

function createUpdater({ app, ipcMain, pushToWindow, loadAutoUpdater }) {
  const enabled = app.isPackaged;
  let autoUpdater = null;
  let state = { status: enabled ? 'idle' : 'dev' };
  let checking = null;

  function setState(next) {
    state = next;
    pushToWindow('updates:state', state);
    return state;
  }

  function getUpdater() {
    if (autoUpdater) return autoUpdater;
    autoUpdater = loadAutoUpdater();
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('download-progress', (progress) => {
      setState({ status: 'downloading', version: state.version, percent: Math.round(progress.percent ?? 0) });
      pushToWindow('updates:progress', { percent: Math.round(progress.percent ?? 0) });
    });
    autoUpdater.on('update-downloaded', (info) => setState({ status: 'downloaded', version: info.version }));
    autoUpdater.on('error', (error) => setState({ status: 'error', message: String(error?.message ?? error) }));
    return autoUpdater;
  }

  async function check() {
    if (!enabled) return { status: 'dev' };
    if (state.status === 'downloading' || state.status === 'downloaded') return state;
    if (checking) return checking;
    checking = (async () => {
      setState({ status: 'checking' });
      try {
        const result = await getUpdater().checkForUpdates();
        const info = result?.updateInfo;
        if (info && result.isUpdateAvailable) return setState({ status: 'available', version: info.version });
        return setState({ status: 'none' });
      } catch (error) {
        return setState({ status: 'error', message: String(error?.message ?? error) });
      } finally {
        checking = null;
      }
    })();
    return checking;
  }

  async function download() {
    if (!enabled) return { status: 'dev' };
    if (state.status !== 'available') return state;
    const version = state.version;
    setState({ status: 'downloading', version, percent: 0 });
    try {
      await getUpdater().downloadUpdate();
    } catch (error) {
      setState({ status: 'error', message: String(error?.message ?? error) });
    }
    return state;
  }

  function install() {
    if (!enabled || state.status !== 'downloaded') return state;
    getUpdater().quitAndInstall();
    return state;
  }

  function register() {
    ipcMain.handle('updates:check', () => check());
    ipcMain.handle('updates:download', () => download());
    ipcMain.handle('updates:install', () => install());
    ipcMain.handle('updates:state', () => state);
  }

  return { register, check, download, install, getState: () => state };
}

module.exports = { createUpdater };
