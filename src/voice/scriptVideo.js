// Finds the video of a script conversation, creating it the way choosing an idea does
import { findChosenIdea } from '../timeline/stages.js';

const TITLE_MAX = 120;

export async function ensureScriptVideo(api, conversationId, messages) {
  if (!api || !conversationId) throw new Error('Open a saved conversation first.');
  const videos = (await api.listVideos()) ?? [];
  const linked = videos.find((video) => video.scriptConversationId === conversationId);
  if (linked) return linked;
  const idea = findChosenIdea(messages);
  const title = String(idea?.title ?? '').trim().slice(0, TITLE_MAX);
  return api.createVideo({
    ...(title ? { title } : {}),
    scriptConversationId: conversationId,
    ...(idea ? { ideaNumber: idea.number } : {}),
  });
}
