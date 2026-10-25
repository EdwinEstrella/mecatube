// Finds the video of an illustrator conversation, creating it the way the voice button does for scripts
const TITLE_MAX = 120;

export async function ensureIllustratorVideo(api, conversationId, title = '') {
  if (!api || !conversationId) throw new Error('Open a saved conversation first.');
  const videos = (await api.listVideos()) ?? [];
  const linked = videos.find((video) => video.illustratorConversationId === conversationId);
  if (linked) return linked;
  const name = String(title ?? '').trim().slice(0, TITLE_MAX);
  return api.createVideo({ ...(name ? { title: name } : {}), illustratorConversationId: conversationId });
}
