const { app, BrowserWindow, Menu, ipcMain, shell, protocol, safeStorage, dialog } = require('electron');
const { createWorkspaceStore } = require('./workspaces.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createBridge } = require('./bridge.cjs');
const { createConversationStore } = require('./conversations.cjs');
const { createPromptStore } = require('./prompts.cjs');
const { createIdeaStore } = require('./ideas.cjs');
const { createVideoStore } = require('./videos.cjs');
const { createSecretStore } = require('./secrets.cjs');
const { createVoiceService } = require('./cartesia.cjs');
const { MEDIA_SCHEME, registerMediaScheme, createMediaHandler, registerVoiceIpc } = require('./voice-ipc.cjs');
const { createVoicePrefsStore } = require('./voice-prefs.cjs');
const { createCreditStore } = require('./credits.cjs');
const { createSavedVoiceStore } = require('./saved-voices.cjs');
const { createFlowStore, createFlowService, registerFlowIpc } = require('./flow.cjs');

const isDev = process.argv.includes('--dev');
const DEV_SERVER_URL = 'http://127.0.0.1:5173';

// The voice player loads narration.wav through a custom scheme; it has to be declared before 'ready'
registerMediaScheme(protocol);

// Present a standard Chrome user agent so sign-in providers do not reject the embedded browser
app.userAgentFallback = app.userAgentFallback
  .replace(/\s?Electron\/\S+/, '')
  .replace(new RegExp(`\\s?${app.getName()}\\/\\S+`, 'i'), '');

// The application menu is removed, so its default reload and devtools shortcuts are restored here
function registerShortcuts(webContents) {
  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const ctrl = input.control || input.meta;

    if ((ctrl && key === 'r') || key === 'f5') {
      event.preventDefault();
      if (input.shift) {
        webContents.reloadIgnoringCache();
      } else {
        webContents.reload();
      }
    } else if (key === 'f12' || (ctrl && input.shift && key === 'i')) {
      event.preventDefault();
      webContents.toggleDevTools();
    }
  });
}

let mainWindow = null;
let bridge = null;
let conversations = null;
let prompts = null;
let ideas = null;
let videos = null;
let secrets = null;
let voice = null;
// DeepSeek handles one prompt at a time: { requestId, conversationId } while a reply is in flight
let inFlight = null;
// True while a DeepSeek history read for a resync is running (the DeepSeek tab is busy)
let resyncing = false;

function pushToWindow(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function failInFlight(message) {
  if (!inFlight) return;
  const { conversationId } = inFlight;
  inFlight = null;
  pushToWindow('chat:error', { conversationId, message });
}

function handleBridgeMessage(message) {
  if (!inFlight || message.requestId !== inFlight.requestId) return;
  const { conversationId } = inFlight;

  if (message.type === 'delta') {
    pushToWindow('chat:delta', { conversationId, text: String(message.text ?? '') });
  } else if (message.type === 'done') {
    inFlight = null;
    try {
      const reply = conversations.appendMessage(conversationId, 'assistant', String(message.text ?? ''));
      if (message.deepseekUrl) conversations.update(conversationId, { deepseekUrl: message.deepseekUrl });
      // source is 'dom' when the extension could not read the final text from DeepSeek's history API
      pushToWindow('chat:done', { conversationId, message: reply, source: message.source === 'dom' ? 'dom' : 'api' });
    } catch (error) {
      pushToWindow('chat:error', { conversationId, message: error.message });
    }
  } else if (message.type === 'error') {
    failInFlight(String(message.message ?? 'The extension reported an error.'));
  }
}

function createWindow() {
  const win = (mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    show: false,
    fullscreen: true,
    frame: false,
    backgroundColor: '#0b0b0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }));

  // Links in rendered replies open in the default browser; the app window never navigates away
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  let wantsFullScreen = true;

  registerShortcuts(win.webContents);
  win.once('ready-to-show', () => win.show());

  const sendFullScreenState = () => {
    win.webContents.send('window:fullscreen-changed', win.isFullScreen());
  };
  win.on('enter-full-screen', sendFullScreenState);
  win.on('leave-full-screen', sendFullScreenState);

  // Return to fullscreen after being restored from the taskbar
  win.on('restore', () => {
    if (wantsFullScreen) win.setFullScreen(true);
  });

  win.toggleAppFullScreen = () => {
    wantsFullScreen = !win.isFullScreen();
    win.setFullScreen(wantsFullScreen);
    if (!wantsFullScreen) win.maximize();
  };

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:toggle-fullscreen', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.toggleAppFullScreen();
});

ipcMain.handle('window:is-fullscreen', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false;
});


ipcMain.handle('chat:list', () => conversations.list());

ipcMain.handle('chat:get', (_event, id) => conversations.get(id));

ipcMain.handle('chat:delete', (_event, id) => {
  if (inFlight?.conversationId === id) throw new Error('Wait for the reply to finish before deleting.');
  conversations.delete(id);
});

ipcMain.handle('chat:rename', (_event, { conversationId, title }) => conversations.rename(conversationId, title));

ipcMain.handle('prompts:get-overrides', () => prompts.getOverrides());
ipcMain.handle('prompts:save', (_event, { id, text }) => prompts.save(id, text));
ipcMain.handle('prompts:reset', (_event, { id }) => prompts.reset(id));

ipcMain.handle('ideas:list', () => ideas.list());
ipcMain.handle('ideas:save', (_event, idea) => ideas.save(idea));
ipcMain.handle('ideas:delete', (_event, payload) => ideas.delete(payload?.id));

ipcMain.handle('videos:list', () => videos.list());
ipcMain.handle('videos:create', (_event, input) => videos.create(input));
ipcMain.handle('videos:update', (_event, { id, ...patch } = {}) => videos.update(id, patch));
ipcMain.handle('videos:set-stage', (_event, { id, key, value } = {}) => videos.setStage(id, key, value));
ipcMain.handle('videos:delete', (_event, payload) => {
  const id = payload?.id;
  videos.delete(id);
  // Generated narration lives next to the video record; id was validated by the store
  fs.rmSync(path.join(activeWorkspacePath, 'videos', id), { recursive: true, force: true });
});

ipcMain.handle('chat:send', (_event, { conversationId, text }) => {
  // The text is sent and stored exactly as received; trim() is only used to detect an empty message
  const content = typeof text === 'string' ? text : '';
  if (content.trim() === '') throw new Error('Message is empty.');
  if (inFlight) throw new Error('A reply is already in progress.');
  if (resyncing) throw new Error('Se está resincronizando una conversación. Espera un momento.');
  if (!bridge.isConnected()) throw new Error('The DeepSeek extension is not connected.');

  const conversation = (conversationId && conversations.get(conversationId)) || conversations.create();
  conversations.appendMessage(conversation.id, 'user', content);

  const requestId = crypto.randomUUID();
  inFlight = { requestId, conversationId: conversation.id };
  try {
    bridge.sendPrompt({ requestId, text: content, deepseekUrl: conversation.deepseekUrl });
  } catch (error) {
    inFlight = null;
    throw error;
  }
  return { conversationId: conversation.id };
});

// Rewrites stored assistant replies with what DeepSeek's own history holds (repairs replies that
// were stored truncated). Needs the extension, and cannot overlap a prompt in flight.
ipcMain.handle('chat:resync', async (_event, { conversationId } = {}) => {
  if (inFlight) throw new Error('Espera a que termine la respuesta en curso antes de resincronizar.');
  if (resyncing) throw new Error('Ya hay una resincronización en curso.');
  const conversation = conversationId ? conversations.get(conversationId) : null;
  if (!conversation) throw new Error('La conversación ya no existe.');
  if (!conversation.deepseekUrl) throw new Error('Esta conversación no tiene un chat de DeepSeek asociado.');
  if (!bridge.isConnected()) throw new Error('La extensión del navegador no está conectada.');

  resyncing = true;
  try {
    const remote = await bridge.requestHistory({ deepseekUrl: conversation.deepseekUrl });
    const result = conversations.applyRemoteHistory(conversation.id, remote);
    pushToWindow('chat:refresh', { conversationId: conversation.id });
    return result;
  } finally {
    resyncing = false;
  }
});

ipcMain.handle('bridge:status', () => bridge.isConnected());


let workspaceStore;
let activeWorkspacePath;
let prefs;
let credits;
let savedVoices;
let flowStore;
let flowService;

const voiceProxy = new Proxy({}, { get: (_t, p) => voice?.[p] });
const videosProxy = new Proxy({}, { get: (_t, p) => videos?.[p] });
const flowStoreProxy = new Proxy({}, { get: (_t, p) => flowStore?.[p] });
const prefsProxy = new Proxy({}, { get: (_t, p) => prefs?.[p] });
const creditsProxy = new Proxy({}, { get: (_t, p) => credits?.[p] });
const savedVoicesProxy = new Proxy({}, { get: (_t, p) => savedVoices?.[p] });

function setupWorkspace(workspacePath) {
  activeWorkspacePath = workspacePath;
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.mkdirSync(path.join(workspacePath, 'videos'), { recursive: true });
  fs.mkdirSync(path.join(workspacePath, 'voiceovers'), { recursive: true });
  fs.mkdirSync(path.join(workspacePath, 'conversations'), { recursive: true });

  conversations = createConversationStore(path.join(workspacePath, 'conversations'));
  prompts = createPromptStore(path.join(workspacePath, 'prompts'));
  ideas = createIdeaStore(workspacePath);
  videos = createVideoStore(workspacePath);
  voice = createVoiceService({
    userDataDir: workspacePath,
    getApiKey: () => secrets.getCartesiaKey(),
    videoExists: (id) => videos.list().some((v) => v.id === id),
    onProgress: (progress) => pushToWindow('voice:progress', progress),
  });
  prefs = createVoicePrefsStore(workspacePath);
  credits = createCreditStore(workspacePath);
  savedVoices = createSavedVoiceStore(workspacePath);
  flowStore = createFlowStore(workspacePath);
  if (bridge) {
    flowService = createFlowService({ bridge, store: flowStoreProxy, videos: videosProxy, pushToWindow });
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  workspaceStore = createWorkspaceStore(app.getPath('userData'));
  secrets = createSecretStore(app.getPath('userData'), safeStorage);
  bridge = createBridge();
  setupWorkspace(workspaceStore.getActive().path);

  registerVoiceIpc({
    ipcMain,
    shell,
    voice: voiceProxy,
    secrets,
    pushToWindow,
    prefs: prefsProxy,
    credits: creditsProxy,
    savedVoices: savedVoicesProxy,
    getVideoTitle: (id) => videosProxy.list().find((v) => v.id === id)?.title ?? '',
  });

  flowService = createFlowService({ bridge, store: flowStoreProxy, videos: videosProxy, pushToWindow });
  registerFlowIpc({
    ipcMain,
    shell,
    service: flowService,
  });

  ipcMain.handle('workspace:get-current', () => workspaceStore.getActive());
  ipcMain.handle('workspace:list', () => workspaceStore.list());

  ipcMain.handle('workspace:select-directory', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar carpeta para el espacio de trabajo',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('workspace:create', async (_event, { name, path: targetPath }) => {
    const newWs = workspaceStore.createWorkspace({ name, targetPath });
    setupWorkspace(newWs.path);
    BrowserWindow.getAllWindows().forEach((win) => win.reload());
    return newWs;
  });

  ipcMain.handle('workspace:switch', async (_event, { id }) => {
    const ws = workspaceStore.switchWorkspace(id);
    setupWorkspace(ws.path);
    BrowserWindow.getAllWindows().forEach((win) => win.reload());
    return ws;
  });

  ipcMain.handle('workspace:reveal', async () => {
    const ws = workspaceStore.getActive();
    if (ws?.path) shell.openPath(ws.path);
  });

  protocol.handle(MEDIA_SCHEME, createMediaHandler(voiceProxy, { characterFile: (videoId, key, file) => flowStoreProxy.filePath(videoId, key, file) }));
  bridge.onMessage(handleBridgeMessage);
  bridge.onStatusChange((connected) => {
    if (!connected) failInFlight('The DeepSeek extension disconnected.');
    pushToWindow('bridge:status-changed', connected);
  });
  bridge.start();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => bridge?.stop());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
