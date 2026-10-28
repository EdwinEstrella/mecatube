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
const { createBranchStore, migrateWorkspace, copyCharacterImages, getCharacterFilePath, copyVideoCharacterFiles } = require('./branches.cjs');
const { createConversationPurger } = require('./purge.cjs');
const { createSecretStore } = require('./secrets.cjs');
const deepseek = require('./deepseek.cjs');
const { createVoiceService } = require('./cartesia.cjs');
const { MEDIA_SCHEME, registerMediaScheme, createMediaHandler, registerVoiceIpc } = require('./voice-ipc.cjs');
const { createVoicePrefsStore } = require('./voice-prefs.cjs');
const { createDeepSeekPrefsStore } = require('./deepseek-prefs.cjs');
const { createCreditStore } = require('./credits.cjs');
const { createSavedVoiceStore } = require('./saved-voices.cjs');
const { createUpdater } = require('./updates.cjs');
const { createFlowStore, createFlowService, registerFlowIpc } = require('./flow.cjs');
const { createDirectorService, registerDirectorIpc } = require('./director.cjs');
const { createExporterService, registerExporterIpc } = require('./exporter.cjs');

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
    failInFlight(String(message.message ?? 'La extensión informó de un error.'));
  }
}

function createWindow() {
  const win = (mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    show: false,
    fullscreen: false,
    frame: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#1e1e1e',
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

  registerShortcuts(win.webContents);
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  const sendWindowState = () => {
    win.webContents.send('window:fullscreen-changed', win.isMaximized());
  };
  win.on('maximize', sendWindowState);
  win.on('unmaximize', sendWindowState);

  win.toggleAppMaximize = () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
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
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.handle('window:is-fullscreen', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
});


ipcMain.handle('chat:list', () => conversations.list());

ipcMain.handle('chat:get', (_event, id) => conversations.get(id));

function conversationPurger() {
  return createConversationPurger({
    conversations,
    videos,
    workspaceDir: activeWorkspacePath,
    isVideoBusy: (videoId) => Boolean(flowService?.isVideoBusy(videoId)) || voice?.activeVideoId() === videoId,
  });
}

// Deletes the chat together with every video (and its folder) linked to it
ipcMain.handle('chat:delete', (_event, id) => {
  if (inFlight?.conversationId === id) throw new Error('Espera a que termine la respuesta antes de eliminar.');
  return conversationPurger().purge(id);
});

ipcMain.handle('chat:rename', (_event, { conversationId, title }) => conversations.rename(conversationId, title));

ipcMain.handle('prompts:get-overrides', () => prompts.getOverrides());
ipcMain.handle('prompts:save', (_event, { id, text }) => prompts.save(id, text));
ipcMain.handle('prompts:reset', (_event, { id }) => prompts.reset(id));

ipcMain.handle('ideas:list', () => ideas.list());
ipcMain.handle('ideas:save', (_event, idea) => ideas.save(idea));
ipcMain.handle('ideas:delete', (_event, payload) => ideas.delete(payload?.id));

ipcMain.handle('branches:list', () => branches.list());
ipcMain.handle('branches:create', (_event, input) => branches.create(input));
ipcMain.handle('branches:update', (_event, { id, ...patch } = {}) => branches.update(id, patch));
ipcMain.handle('branches:delete', (_event, payload) => {
  const id = typeof payload === 'object' && payload !== null ? payload.id : payload;
  if (!id) throw new Error('ID de rama no válido.');
  if (branches.list().length <= 1) {
    throw new Error('No se puede eliminar la única rama del espacio de trabajo.');
  }
  const branchVideos = videos.list(id);
  if (branchVideos.length > 0) {
    throw new Error('No se puede eliminar una rama que contiene videos.');
  }
  branches.delete(id);
});

ipcMain.handle('branches:set-characters', (_event, payload) => {
  const branchId = payload?.branchId || payload?.id;
  const characters = payload?.characters;
  const flowProjectUrl = payload?.flowProjectUrl;
  return branches.setCharacters(branchId, characters, flowProjectUrl);
});

ipcMain.handle('branches:save-from-video', async (_event, payload) => {
  const branchId = payload?.branchId;
  const videoId = payload?.videoId;
  if (!branchId) throw new Error('ID de rama no válido.');
  if (!videoId) throw new Error('ID de video no válido.');
  const video = videos.list().find((v) => v.id === videoId);
  if (!video) throw new Error('Video no encontrado.');
  const videoCharacters = flowStore.list(videoId);
  if (!videoCharacters || videoCharacters.length === 0) {
    throw new Error('El video no tiene personajes.');
  }
  for (const c of videoCharacters) {
    if (!c.selectedFile) throw new Error(`El personaje "${c.name || c.key}" no tiene imagen seleccionada.`);
  }
  const copied = copyVideoCharacterFiles(activeWorkspacePath, branchId, videoId, videoCharacters);
  return branches.setCharacters(branchId, copied, video.flowProjectUrl ?? null);
});

ipcMain.handle('branches:add-character-image', async (_event, payload) => {
  const branchId = typeof payload === 'object' && payload !== null ? payload.branchId : payload;
  if (!branchId) throw new Error('ID de rama no válido.');
  let filePaths = payload?.filePaths;
  if (!filePaths || filePaths.length === 0) {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar imágenes del personaje',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return [];
    }
    filePaths = result.filePaths;
  }
  return copyCharacterImages(activeWorkspacePath, branchId, filePaths);
});

ipcMain.handle('branches:generate-series-outline', async (_event, payload) => {
  const prompt = typeof payload === 'string' ? payload : payload?.prompt;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('El prompt para la IA está vacío.');
  }
  const apiKey = secrets.getDeepSeekKey();
  if (!apiKey) {
    throw new Error('Configura tu API Key de DeepSeek en Configuración para generar capítulos con IA.');
  }
  const raw = await deepseek.streamChat({
    apiKey,
    messages: [{ role: 'user', content: prompt }],
    model: 'deepseek-chat',
  });
  return { raw };
});

ipcMain.handle('videos:list', (_event, payload) => {
  const branchId = typeof payload === 'object' && payload !== null ? payload.branchId : payload;
  return videos.list(branchId);
});
ipcMain.handle('videos:get-active', () => videos.getActive());
ipcMain.handle('videos:set-active', (_event, payload) => {
  const id = typeof payload === 'object' && payload !== null ? payload.id : payload;
  return videos.setActive(id);
});
// A different illustrator chat taking over the workspace video starts with clean illustration data
ipcMain.handle('videos:create', (_event, input) => {
  const payload = { ...(input ?? {}) };
  if (!payload.branchId) {
    payload.branchId = branches.list()[0]?.id;
  }
  return conversationPurger().linkIllustrator(payload);
});
ipcMain.handle('videos:update', (_event, { id, ...patch } = {}) => videos.update(id, patch));
ipcMain.handle('videos:set-stage', (_event, { id, key, value } = {}) => videos.setStage(id, key, value));
ipcMain.handle('videos:delete', (_event, payload) => {
  const id = typeof payload === 'object' && payload !== null ? payload.id : payload;
  videos.delete(id);
  // Generated narration lives next to the video record; id was validated by the store
  fs.rmSync(path.join(activeWorkspacePath, 'videos', id), { recursive: true, force: true });
});

ipcMain.handle('chat:send', (_event, { conversationId, text }) => {
  // The text is sent and stored exactly as received; trim() is only used to detect an empty message
  const content = typeof text === 'string' ? text : '';
  if (content.trim() === '') throw new Error('El mensaje está vacío.');
  if (inFlight) throw new Error('Ya hay una respuesta en curso.');
  if (resyncing) throw new Error('Se está resincronizando una conversación. Espera un momento.');

  const deepSeekKey = secrets.getDeepSeekKey();
  if (!deepSeekKey && !bridge.isConnected()) {
    throw new Error('Configura tu API Key de DeepSeek en Configuración o conecta la extensión.');
  }

  const conversation = (conversationId && conversations.get(conversationId)) || conversations.create();
  conversations.appendMessage(conversation.id, 'user', content);

  if (deepSeekKey) {
    const abortController = new AbortController();
    inFlight = { conversationId: conversation.id, abortController };

    (async () => {
      try {
        const fullConv = conversations.get(conversation.id);
        const historyForApi = (fullConv?.messages || []).map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));

        const finalContent = await deepseek.streamChat({
          apiKey: deepSeekKey,
          messages: historyForApi,
          model: 'deepseek-chat',
          signal: abortController.signal,
          onDelta: (accumulated) => {
            pushToWindow('chat:delta', { conversationId: conversation.id, text: accumulated });
          },
        });

        const savedMessage = conversations.appendMessage(conversation.id, 'assistant', finalContent);
        pushToWindow('chat:done', {
          conversationId: conversation.id,
          message: savedMessage,
          source: 'api',
        });
      } catch (err) {
        if (!abortController.signal.aborted) {
          pushToWindow('chat:error', {
            conversationId: conversation.id,
            message: err.message || 'Error al comunicarse con la API de DeepSeek.',
          });
        }
      } finally {
        inFlight = null;
      }
    })();

    return { conversationId: conversation.id };
  }

  const requestId = crypto.randomUUID();
  inFlight = { requestId, conversationId: conversation.id };
  try {
    const dsPrefs = deepseekPrefs ? deepseekPrefs.get() : { webSearch: true };
    bridge.sendPrompt({ requestId, text: content, deepseekUrl: conversation.deepseekUrl, webSearch: dsPrefs.webSearch });
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
let branches;
let prefs;
let deepseekPrefs;
let credits;
let savedVoices;
let flowStore;
let flowService;

const branchesProxy = new Proxy({}, { get: (_t, p) => branches?.[p] });
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

  migrateWorkspace(workspacePath);
  branches = createBranchStore(workspacePath);
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
  deepseekPrefs = createDeepSeekPrefsStore(workspacePath);
  credits = createCreditStore(workspacePath);
  savedVoices = createSavedVoiceStore(workspacePath);
  flowStore = createFlowStore(workspacePath);
  if (bridge) {
    flowService = createFlowService({ bridge, store: flowStoreProxy, videos: videosProxy, branches: branchesProxy, pushToWindow });
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  workspaceStore = createWorkspaceStore(app.getPath('userData'));
  secrets = createSecretStore(app.getPath('userData'), safeStorage);
  bridge = createBridge();

  ipcMain.handle('deepseek:prefs-get', () => (deepseekPrefs ? deepseekPrefs.get() : { webSearch: true }));
  ipcMain.handle('deepseek:prefs-set', (_event, input) => (deepseekPrefs ? deepseekPrefs.set(input) : { webSearch: true }));
  ipcMain.handle('secrets:deepseek-status', () => secrets.deepSeekStatus());
  ipcMain.handle('secrets:deepseek-save', (_event, { key } = {}) => {
    secrets.saveDeepSeekKey(key);
    return secrets.deepSeekStatus();
  });
  ipcMain.handle('secrets:deepseek-clear', () => {
    secrets.clearDeepSeekKey();
    return secrets.deepSeekStatus();
  });
  ipcMain.handle('secrets:deepseek-test', async () => {
    const key = secrets.getDeepSeekKey();
    return await deepseek.testConnection(key);
  });

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

  flowService = createFlowService({ bridge, store: flowStoreProxy, videos: videosProxy, branches: branchesProxy, pushToWindow });
  registerFlowIpc({
    ipcMain,
    shell,
    service: flowService,
  });

  const directorService = createDirectorService({
    getWorkspacePath: () => activeWorkspacePath,
    getApiKey: () => secrets.getDeepSeekKey(),
    streamChat: deepseek.streamChat,
  });
  registerDirectorIpc({
    ipcMain,
    service: directorService,
  });

  const exporterService = createExporterService({
    getWorkspacePath: () => activeWorkspacePath,
    shell,
  });
  registerExporterIpc({
    ipcMain,
    service: exporterService,
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

  ipcMain.handle('workspace:create', async (_event, { name, path: targetPath, style }) => {
    const newWs = workspaceStore.createWorkspace({ name, targetPath, style });
    setupWorkspace(newWs.path);
    BrowserWindow.getAllWindows().forEach((win) => win.reload());
    return newWs;
  });

  ipcMain.handle('workspace:set-style', async (_event, payload) => {
    const style = typeof payload === 'string' ? payload : payload?.style;
    const active = workspaceStore.getActive();
    if (!active) throw new Error('No hay espacio de trabajo activo.');
    return workspaceStore.updateStyle(active.id, style);
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

  protocol.handle(
    MEDIA_SCHEME,
    createMediaHandler(voiceProxy, {
      characterFile: (videoId, key, file) => flowStoreProxy.filePath(videoId, key, file),
      sceneFile: (videoId, number, file) => flowStoreProxy.sceneFilePath(videoId, number, file),
      animationFile: (videoId, number, file) => flowStoreProxy.animationFilePath(videoId, number, file),
      branchCharacterFile: (branchId, file) => getCharacterFilePath(activeWorkspacePath, branchId, file),
    }),
  );
  bridge.onMessage(handleBridgeMessage);
  bridge.onStatusChange((connected) => {
    if (!connected) failInFlight('La extensión de DeepSeek se desconectó.');
    pushToWindow('bridge:status-changed', connected);
  });
  bridge.start();
  createWindow();

  // electron-updater is loaded lazily so the dev run never touches it
  const updater = createUpdater({
    app,
    ipcMain,
    pushToWindow,
    loadAutoUpdater: () => require('electron-updater').autoUpdater,
  });
  updater.register();
  if (app.isPackaged) {
    mainWindow.webContents.once('did-finish-load', () => setTimeout(() => updater.check(), 3000));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => bridge?.stop());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
