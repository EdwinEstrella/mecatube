// Finds the video of a script conversation, creating it the way choosing an idea does
import { findChosenIdea } from '../timeline/stages.js';

const TITLE_MAX = 120;

export async function ensureScriptVideo(api, conversationId, messages, chooseTarget) {
  if (!api || !conversationId) throw new Error('Abre primero una conversación guardada.');
  const videos = (await api.listVideos()) ?? [];
  const linked = videos.find((video) => video.scriptConversationId === conversationId);
  if (linked) return linked;

  const idea = findChosenIdea(messages);
  const title = String(idea?.title ?? '').trim().slice(0, TITLE_MAX);
  const fields = {
    ...(title ? { title } : {}),
    scriptConversationId: conversationId,
    ...(idea ? { ideaNumber: idea.number } : {}),
  };

  const active = (await api.getActiveVideo?.()) ?? null;
  if (active && active.scriptConversationId && active.scriptConversationId !== conversationId) {
    const choiceFn = chooseTarget ?? (async () => 'new');
    const target = await choiceFn({ slot: 'script', video: active });
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
