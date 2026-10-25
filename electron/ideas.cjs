// Favorite ideas store: one JSON array, written atomically.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ID_PATTERN = /^[\w-]{1,100}$/;
// Max lengths of the free-text fields
const LIMITS = { title: 300, format: 100, question: 1000, thumbnailText: 200, trigger: 500, conversationTitle: 200 };

function text(value, field, { required = false } = {}) {
  if (typeof value !== 'string') throw new Error(`Idea no válida: ${field}.`);
  const clean = value.trim();
  if (required && !clean) throw new Error(`El campo de la idea «${field}» es obligatorio.`);
  if (clean.length > LIMITS[field]) throw new Error(`El campo de la idea «${field}» es demasiado largo.`);
  return clean;
}

function validate(input) {
  if (!input || typeof input !== 'object') throw new Error('Idea no válida.');
  const { number, conversationId, messageId } = input;
  if (!Number.isInteger(number) || number < 1 || number > 999) throw new Error('Número de idea no válido.');
  if (typeof conversationId !== 'string' || !ID_PATTERN.test(conversationId)) throw new Error('ID de conversación no válido.');
  if (typeof messageId !== 'string' || !ID_PATTERN.test(messageId)) throw new Error('ID de mensaje no válido.');
  return {
    number,
    title: text(input.title, 'title', { required: true }),
    format: text(input.format ?? '', 'format'),
    question: text(input.question ?? '', 'question'),
    thumbnailText: text(input.thumbnailText ?? '', 'thumbnailText'),
    trigger: text(input.trigger ?? '', 'trigger'),
    conversationId,
    conversationTitle: text(input.conversationTitle ?? '', 'conversationTitle'),
    messageId,
  };
}

function createIdeaStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'ideas.json');

  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function write(ideas) {
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(ideas, null, 2), 'utf8');
    fs.renameSync(temp, file);
  }

  // Newest first
  function list() {
    return read().sort((a, b) => b.savedAt - a.savedAt);
  }

  // Identity is conversationId + messageId + number; saving twice returns the stored record
  function save(input) {
    const fields = validate(input);
    const ideas = read();
    const existing = ideas.find(
      (idea) => idea.conversationId === fields.conversationId && idea.messageId === fields.messageId && idea.number === fields.number,
    );
    if (existing) return existing;
    const record = { id: crypto.randomUUID(), ...fields, savedAt: Date.now() };
    ideas.push(record);
    write(ideas);
    return record;
  }

  function remove(id) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error('ID de idea no válido.');
    const ideas = read();
    const kept = ideas.filter((idea) => idea.id !== id);
    if (kept.length !== ideas.length) write(kept);
  }

  return { list, save, delete: remove };
}

module.exports = { createIdeaStore };
