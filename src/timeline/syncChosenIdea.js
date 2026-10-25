// Keeps the Timeline in step with a chosen idea. Returns the affected video, or null.
// A video linked to the conversation takes the idea title unless the user renamed it;
// without one, a new video is created for that conversation.
const TITLE_MAX = 120;

export async function syncChosenIdea(api, conversationId, idea) {
  if (!api || !conversationId || !idea) return null;
  const title = String(idea.title ?? '').trim().slice(0, TITLE_MAX);
  const videos = (await api.listVideos()) ?? [];
  const linked = videos.find((video) => video.scriptConversationId === conversationId);

  if (linked) {
    const patch = { ideaNumber: idea.number };
    if (!linked.titleEdited && title) Object.assign(patch, { title, titleEdited: false });
    return api.updateVideo(linked.id, patch);
  }
  return api.createVideo({
    ...(title ? { title } : {}),
    scriptConversationId: conversationId,
    ideaNumber: idea.number,
  });
}
