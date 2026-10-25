// Prompt overrides: user edits of the preset prompts, stored byte-exact as UTF-8 files.
const fs = require('node:fs');
const path = require('node:path');

const PROMPT_IDS = ['prompt-1', 'prompt-2', 'connectors-instruction', 'connectors'];

function createPromptStore(dir) {
  fs.mkdirSync(dir, { recursive: true });

  const fileFor = (id) => {
    if (!PROMPT_IDS.includes(id)) throw new Error('Prompt desconocido.');
    return path.join(dir, `${id}.txt`);
  };

  function read(id) {
    try {
      return fs.readFileSync(fileFor(id), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  function getOverrides() {
    return Object.fromEntries(PROMPT_IDS.map((id) => [id, read(id)]));
  }

  // The text is written as received: no trimming and no line-ending changes
  function save(id, text) {
    if (typeof text !== 'string') throw new Error('El texto del prompt debe ser una cadena.');
    const file = fileFor(id);
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, text, 'utf8');
    fs.renameSync(temp, file);
    return text;
  }

  function reset(id) {
    try {
      fs.unlinkSync(fileFor(id));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  return { getOverrides, save, reset };
}

module.exports = { createPromptStore, PROMPT_IDS };
