// Pure helpers that derive idea-choice state from the message list.

// Number of the idea the user chose after the assistant message at `index`, or null.
// The choice is the very next message when it is a user message that is only a number.
export function chosenIdeaNumber(messages, index) {
  const next = messages[index + 1];
  if (!next || next.role !== 'user') return null;
  const text = typeof next.content === 'string' ? next.content.trim() : '';
  return /^\d{1,3}$/.test(text) ? Number(text) : null;
}

export function hasUserMessageAfter(messages, index) {
  return messages.slice(index + 1).some((message) => message.role === 'user');
}
