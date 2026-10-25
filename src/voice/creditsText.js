// Pure helpers for credit messages (1 credit = 1 character)

export function formatCredits(value, locale = 'es-ES') {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString(locale);
}

// Estimated balance after spending `chars`; left is null when the balance is unknown
export function afterRemaining(summary, chars) {
  if (!summary || !Number.isFinite(summary.remaining)) return { left: null, over: false };
  return { left: Math.max(0, summary.remaining - chars), over: chars > summary.remaining };
}

// Text that will actually be sent: as pasted, or run through the narration cleanup
export function voiceoverText(text, clean, extract) {
  return clean ? extract(text) : text;
}
