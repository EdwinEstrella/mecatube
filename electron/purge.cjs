// Deleting a chat with its data: removes the conversation and every video linked to it
// (record + <workspace>/videos/<id>/ folder with characters, scenes, voice and index files).
const fs = require('node:fs');
const path = require('node:path');

const ID_PATTERN = /^[\w-]{1,100}$/;
const BUSY_MESSAGE = 'Hay una generación en curso para este chat; espera a que termine o cancélala.';

function createConversationPurger({ conversations, videos, workspaceDir, isVideoBusy = () => false }) {
  const videosDir = path.resolve(workspaceDir, 'videos');

  // Folder of a validated id, guaranteed to sit directly inside <workspace>/videos
  function videoFolder(videoId) {
    if (typeof videoId !== 'string' || !ID_PATTERN.test(videoId)) throw new Error('ID de video no válido.');
    const folder = path.resolve(videosDir, videoId);
    if (path.dirname(folder) !== videosDir) throw new Error('ID de video no válido.');
    return folder;
  }

  function linkedVideos(conversationId) {
    return videos
      .list()
      .filter((v) => v.scriptConversationId === conversationId || v.illustratorConversationId === conversationId);
  }

  // Describes what deleting the conversation would remove (used before any mutation)
  function purge(conversationId) {
    if (typeof conversationId !== 'string' || !ID_PATTERN.test(conversationId)) {
      throw new Error('ID de conversación no válido.');
    }
    const linked = linkedVideos(conversationId);
    // Validate every id and check for running jobs before touching anything
    for (const video of linked) {
      videoFolder(video.id);
      if (isVideoBusy(video.id)) throw new Error(BUSY_MESSAGE);
    }
    conversations.delete(conversationId);
    const removedVideoIds = [];
    for (const video of linked) {
      const folder = videoFolder(video.id);
      videos.delete(video.id);
      fs.rmSync(folder, { recursive: true, force: true });
      removedVideoIds.push(video.id);
    }
    return { conversationId, removedVideoIds };
  }

  // Links into the active video (or creates one). When a different illustrator chat takes
  // over the active video, its illustration data (character sheets, scene images, animation
  // videos, their indexes and the Flow project) is removed so the new chat starts clean;
  // script, voice and timeline data stay.
  const ILLUSTRATION_ENTRIES = ['characters', 'scenes', 'animations', 'characters.json', 'scenes.json', 'animations.json'];

  function linkIllustrator(input = {}) {
    if (input?.newVideo === true) {
      const { newVideo: _unused, ...createInput } = input;
      return videos.create(createInput);
    }

    const current = videos.getActive();
    if (!current) {
      const { newVideo: _unused, ...createInput } = input;
      return videos.create(createInput);
    }

    const next = input?.illustratorConversationId;
    let purged = false;
    if (next && current.illustratorConversationId && current.illustratorConversationId !== next) {
      const folder = videoFolder(current.id);
      if (isVideoBusy(current.id)) throw new Error(BUSY_MESSAGE);
      for (const entry of ILLUSTRATION_ENTRIES) fs.rmSync(path.join(folder, entry), { recursive: true, force: true });
      purged = true;
    }

    const { newVideo: _unused, branchId: _ignoreBranch, ...fields } = input ?? {};
    if (purged) {
      fields.flowProjectUrl = null;
    }

    if (fields.title !== undefined) {
      if (current.titleEdited) {
        delete fields.title;
        delete fields.titleEdited;
      } else if (fields.titleEdited === undefined) {
        fields.titleEdited = false;
      }
    }

    return videos.update(current.id, fields);
  }

  return { purge, linkedVideos, linkIllustrator };
}

module.exports = { createConversationPurger, BUSY_MESSAGE };
