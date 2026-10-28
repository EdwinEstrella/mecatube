// Finds the video of an illustrator conversation, creating it the way the voice button does for scripts
const TITLE_MAX = 120;

export async function ensureIllustratorVideo(api, conversationId, title = '', chooseTarget) {
  if (!api || !conversationId) throw new Error('Abre primero una conversación guardada.');
  const videos = (await api.listVideos()) ?? [];
  const linked = videos.find((video) => video.illustratorConversationId === conversationId);
  if (linked) return linked;

  const name = String(title ?? '').trim().slice(0, TITLE_MAX);
  const fields = {
    ...(name ? { title: name } : {}),
    illustratorConversationId: conversationId,
  };

  const active = (await api.getActiveVideo?.()) ?? null;
  if (active && active.illustratorConversationId && active.illustratorConversationId !== conversationId) {
    const choiceFn = chooseTarget ?? (async () => 'new');
    const target = await choiceFn({ slot: 'illustrator', video: active });
    if (target === 'new') {
      return api.createVideo({ ...fields, newVideo: true, branchId: active.branchId });
    }
    if (target === 'current') {
      return api.createVideo(fields);
    }
    return null;
  }

  return api.createVideo(fields);
}
