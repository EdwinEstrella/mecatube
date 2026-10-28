const { contextBridge, ipcRenderer } = require('electron');

// Subscribes to a main-process push channel and returns an unsubscribe function
function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleFullScreen: () => ipcRenderer.send('window:toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  onFullScreenChange: (callback) => {
    const listener = (_event, isFullScreen) => callback(isFullScreen);
    ipcRenderer.on('window:fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('window:fullscreen-changed', listener);
  },
  listConversations: () => ipcRenderer.invoke('chat:list'),
  getConversation: (id) => ipcRenderer.invoke('chat:get', id),
  deleteConversation: (id) => ipcRenderer.invoke('chat:delete', id),
  renameConversation: (conversationId, title) => ipcRenderer.invoke('chat:rename', { conversationId, title }),
  listIdeas: () => ipcRenderer.invoke('ideas:list'),
  saveIdea: (idea) => ipcRenderer.invoke('ideas:save', idea),
  deleteIdea: (id) => ipcRenderer.invoke('ideas:delete', { id }),
  listBranches: () => ipcRenderer.invoke('branches:list'),
  createBranch: (input) => ipcRenderer.invoke('branches:create', input),
  updateBranch: (id, patch) => ipcRenderer.invoke('branches:update', { ...patch, id }),
  deleteBranch: (id) => ipcRenderer.invoke('branches:delete', { id }),
  setBranchCharacters: (branchId, characters, flowProjectUrl) => {
    if (typeof branchId === 'object' && branchId !== null) {
      return ipcRenderer.invoke('branches:set-characters', branchId);
    }
    return ipcRenderer.invoke('branches:set-characters', { branchId, characters, flowProjectUrl });
  },
  saveBranchCharactersFromVideo: (branchId, videoId) =>
    ipcRenderer.invoke('branches:save-from-video', { branchId, videoId }),
  addBranchCharacterImage: (payload) =>
    ipcRenderer.invoke('branches:add-character-image', typeof payload === 'object' && payload !== null ? payload : { branchId: payload }),
  generateSeriesOutline: (payload) =>
    ipcRenderer.invoke('branches:generate-series-outline', typeof payload === 'object' && payload !== null ? payload : { prompt: payload }),
  listVideos: (branchId) => ipcRenderer.invoke('videos:list', branchId),
  getActiveVideo: () => ipcRenderer.invoke('videos:get-active'),
  setActiveVideo: (id) => ipcRenderer.invoke('videos:set-active', { id }),
  createVideo: (input) => ipcRenderer.invoke('videos:create', input),
  updateVideo: (id, patch) => ipcRenderer.invoke('videos:update', { ...patch, id }),
  setVideoStage: (id, key, value) => ipcRenderer.invoke('videos:set-stage', { id, key, value }),
  deleteVideo: (id) => ipcRenderer.invoke('videos:delete', { id }),
  getCartesiaStatus: () => ipcRenderer.invoke('secrets:cartesia-status'),
  saveCartesiaKey: (key) => ipcRenderer.invoke('secrets:cartesia-save', { key }),
  clearCartesiaKey: () => ipcRenderer.invoke('secrets:cartesia-clear'),
  testCartesiaKey: () => ipcRenderer.invoke('secrets:cartesia-test'),
  getDeepSeekStatus: () => ipcRenderer.invoke('secrets:deepseek-status'),
  saveDeepSeekKey: (key) => ipcRenderer.invoke('secrets:deepseek-save', { key }),
  clearDeepSeekKey: () => ipcRenderer.invoke('secrets:deepseek-clear'),
  testDeepSeekKey: () => ipcRenderer.invoke('secrets:deepseek-test'),
  listOwnedVoices: (options) => ipcRenderer.invoke('voice:owned-voices', options),
  lookupVoice: (id) => ipcRenderer.invoke('voice:lookup', { id }),
  listSavedVoices: () => ipcRenderer.invoke('saved-voices:list'),
  addSavedVoice: (voice) => ipcRenderer.invoke('saved-voices:add', voice),
  renameSavedVoice: (id, label) => ipcRenderer.invoke('saved-voices:rename', { id, label }),
  removeSavedVoice: (id) => ipcRenderer.invoke('saved-voices:remove', { id }),
  generateVoice: (payload) => ipcRenderer.invoke('voice:generate', payload),
  getVoicePrefs: () => ipcRenderer.invoke('voice:prefs-get'),
  saveVoicePrefs: (prefs) => ipcRenderer.invoke('voice:prefs-set', prefs),
  getVoiceBusy: () => ipcRenderer.invoke('voice:busy'),
  generateVoiceover: (payload) => ipcRenderer.invoke('voiceover:generate', payload),
  listVoiceovers: () => ipcRenderer.invoke('voiceover:list'),
  deleteVoiceover: (id) => ipcRenderer.invoke('voiceover:delete', { id }),
  openVoiceoverFolder: (id) => ipcRenderer.invoke('voiceover:open-folder', { id }),
  getCreditSummary: () => ipcRenderer.invoke('credits:summary'),
  saveCreditSettings: (settings) => ipcRenderer.invoke('credits:settings-save', settings),
  calibrateCredits: (remaining) => ipcRenderer.invoke('credits:calibrate', { remaining }),
  clearCreditCalibration: () => ipcRenderer.invoke('credits:clear-calibration'),
  onCreditsChanged: (callback) => subscribe('credits:changed', callback),
  cancelVoice: () => ipcRenderer.invoke('voice:cancel'),
  getActiveVoice: () => ipcRenderer.invoke('voice:active'),
  getVoice: (videoId) => ipcRenderer.invoke('voice:get', { videoId }),
  openVoiceFolder: (videoId) => ipcRenderer.invoke('voice:open-folder', { videoId }),
  onVoiceProgress: (callback) => subscribe('voice:progress', callback),
  onVoiceFinished: (callback) => subscribe('voice:finished', callback),
  generateCharacter: (payload) => ipcRenderer.invoke('flow:generate', payload),
  getFlowStatus: () => ipcRenderer.invoke('flow:status'),
  getCharacters: (videoId) => ipcRenderer.invoke('flow:characters', { videoId }),
  selectCharacterImage: (videoId, characterKey, file) => ipcRenderer.invoke('flow:select', { videoId, characterKey, file }),
  approveCharacters: (videoId, keys, approved) => ipcRenderer.invoke('flow:approve', { videoId, keys, approved }),
  getScenes: (videoId) => ipcRenderer.invoke('flow:scenes', { videoId }),
  selectSceneImage: ({ videoId, number, file }) => ipcRenderer.invoke('flow:scene-select', { videoId, number, file }),
  generateScenes: (payload) => ipcRenderer.invoke('flow:scenes-generate', payload),
  cancelScenes: () => ipcRenderer.invoke('flow:scenes-cancel'),
  onFlowSceneStatus: (callback) => subscribe('flow:scene-status', callback),
  getAnimations: (videoId) => ipcRenderer.invoke('flow:animations', { videoId }),
  generateAnimations: (payload) => ipcRenderer.invoke('flow:animations-generate', payload),
  cancelAnimations: () => ipcRenderer.invoke('flow:animations-cancel'),
  onFlowAnimationStatus: (callback) => subscribe('flow:animation-status', callback),
  setFlowProject: (videoId, url) => ipcRenderer.invoke('flow:set-project', { videoId, url }),
  openFlowProject: (videoId) => ipcRenderer.invoke('flow:open-project', { videoId }),
  onFlowProgress: (callback) => subscribe('flow:progress', callback),
  onFlowCaptcha: (callback) => subscribe('flow:captcha', callback),
  onFlowResult: (callback) => subscribe('flow:result', callback),
  onFlowError: (callback) => subscribe('flow:error', callback),
  directEdit: (payload) => ipcRenderer.invoke('editor:direct', payload),
  alignEdit: (payload) => ipcRenderer.invoke('editor:align', payload),
  getEdit: (videoId) => ipcRenderer.invoke('editor:get', { videoId }),
  saveEdit: (videoId, edl) => ipcRenderer.invoke('editor:save', { videoId, edl }),
  getEditBusy: () => ipcRenderer.invoke('editor:busy'),
  getExport: (videoId) =>
    ipcRenderer.invoke('editor:get-export', typeof videoId === 'object' && videoId !== null ? videoId : { videoId }),
  saveExport: async (payload, maybeFileName, maybeBytes) => {
    const videoId = typeof payload === 'object' && payload !== null ? payload.videoId : payload;
    const fileName = typeof payload === 'object' && payload !== null ? payload.fileName : maybeFileName;
    const bytes = typeof payload === 'object' && payload !== null ? payload.bytes : maybeBytes;

    const byteLength = bytes?.byteLength ?? bytes?.length ?? 0;
    const CHUNK_SIZE = 8 * 1024 * 1024;
    if (byteLength <= CHUNK_SIZE) {
      return ipcRenderer.invoke('editor:save-export', { videoId, fileName, bytes });
    }
    const { exportId } = await ipcRenderer.invoke('editor:export-start', {
      videoId,
      fileName,
      totalSize: byteLength,
    });
    try {
      const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      for (let offset = 0; offset < byteLength; offset += CHUNK_SIZE) {
        const slice = uint8.subarray(offset, Math.min(offset + CHUNK_SIZE, byteLength));
        await ipcRenderer.invoke('editor:export-chunk', { exportId, chunk: slice });
      }
      return await ipcRenderer.invoke('editor:export-finish', { exportId });
    } catch (err) {
      await ipcRenderer.invoke('editor:export-abort', { exportId }).catch(() => {});
      throw err;
    }
  },
  openExportFolder: (videoId) =>
    ipcRenderer.invoke('editor:open-export-folder', typeof videoId === 'object' && videoId !== null ? videoId : { videoId }),
  saveThumbnail: (payload, maybeSourcePath) => {
    const videoId = typeof payload === 'object' && payload !== null ? payload.videoId : payload;
    const sourcePath = typeof payload === 'object' && payload !== null ? payload.sourcePath : maybeSourcePath;
    return ipcRenderer.invoke('editor:save-thumbnail', { videoId, sourcePath });
  },
  getPromptOverrides: () => ipcRenderer.invoke('prompts:get-overrides'),
  savePrompt: (id, text) => ipcRenderer.invoke('prompts:save', { id, text }),
  resetPrompt: (id) => ipcRenderer.invoke('prompts:reset', { id }),
  sendChatMessage: (payload) => ipcRenderer.invoke('chat:send', payload),
  resyncConversation: (conversationId) => ipcRenderer.invoke('chat:resync', { conversationId }),
  onChatRefresh: (callback) => subscribe('chat:refresh', callback),
  getBridgeStatus: () => ipcRenderer.invoke('bridge:status'),
  onChatDelta: (callback) => subscribe('chat:delta', callback),
  onChatDone: (callback) => subscribe('chat:done', callback),
  onChatError: (callback) => subscribe('chat:error', callback),
  onBridgeStatusChange: (callback) => subscribe('bridge:status-changed', callback),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  getUpdateState: () => ipcRenderer.invoke('updates:state'),
  onUpdateState: (callback) => subscribe('updates:state', callback),
  onUpdateProgress: (callback) => subscribe('updates:progress', callback),
  getCurrentWorkspace: () => ipcRenderer.invoke('workspace:get-current'),
  listWorkspaces: () => ipcRenderer.invoke('workspace:list'),
  selectWorkspaceDirectory: () => ipcRenderer.invoke('workspace:select-directory'),
  createWorkspace: (payload) => ipcRenderer.invoke('workspace:create', payload),
  switchWorkspace: (id) => ipcRenderer.invoke('workspace:switch', { id }),
  revealWorkspace: () => ipcRenderer.invoke('workspace:reveal'),
  setWorkspaceStyle: (style) => ipcRenderer.invoke('workspace:set-style', typeof style === 'string' ? { style } : style),
});
