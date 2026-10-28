import { collectImageScenes, parseImageScenes } from './parseImageScenes.js';
import { animationSeconds } from './animationSeconds.js';
import { parseThumbnail } from './parseThumbnail.js';
import { parseIdeas } from '../chat/parseIdeas.js';
import { parseCharacterSheets } from './parseCharacterSheets.js';

// Pure helper: parses assistant messages from an illustrator chat into structured blocks.
// Returns { sceneBlocks, animationBlocks, thumbnail, imageBlocks, thumbnails }
export function parseIllustratorBlocks(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      sceneBlocks: [],
      animationBlocks: [],
      thumbnail: null,
      imageBlocks: [],
      thumbnails: [],
    };
  }

  const imageScenes = collectImageScenes(messages);
  const anchorByNumber = new Map(imageScenes.map((scene) => [scene.number, scene.scriptAnchor]));

  const sceneBlocks = [];
  const animationBlocks = [];
  let latestThumbnail = null;
  const imageBlocks = [];
  const thumbnails = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message?.role !== 'assistant' || !message.content) {
      imageBlocks.push(null);
      thumbnails.push(null);
      continue;
    }

    if (parseIdeas(message.content) || parseCharacterSheets(message.content)) {
      imageBlocks.push(null);
      thumbnails.push(null);
      continue;
    }

    const rawBlock = parseImageScenes(message.content);
    if (rawBlock) {
      if (rawBlock.kind === 'animations') {
        const enriched = {
          ...rawBlock,
          messageIndex: index,
          message,
          scenes: rawBlock.scenes.map((scene) => {
            const scriptAnchor = scene.scriptAnchor || anchorByNumber.get(scene.number) || '';
            return {
              ...scene,
              scriptAnchor,
              seconds: animationSeconds(scriptAnchor),
            };
          }),
        };
        animationBlocks.push(enriched);
        imageBlocks.push(enriched);
        thumbnails.push(null);
      } else {
        const block = {
          ...rawBlock,
          messageIndex: index,
          message,
        };
        sceneBlocks.push(block);
        imageBlocks.push(block);
        thumbnails.push(null);
      }
      continue;
    }

    const parsedThumb = parseThumbnail(message.content);
    if (parsedThumb) {
      const thumb = {
        ...parsedThumb,
        messageIndex: index,
        message,
      };
      latestThumbnail = thumb;
      imageBlocks.push(null);
      thumbnails.push(thumb);
      continue;
    }

    imageBlocks.push(null);
    thumbnails.push(null);
  }

  return {
    sceneBlocks,
    animationBlocks,
    thumbnail: latestThumbnail,
    imageBlocks,
    thumbnails,
  };
}
