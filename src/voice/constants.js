// Defaults and choices for the voice-over panel (the main process validates them again)
export const DEFAULT_VOICE = {
  id: 'b042270c-d46f-4d4f-8fb0-7dd7c5fe5615',
  name: 'Hector - Tour Leader',
  description: '',
};

export const DEFAULT_MODEL = 'sonic-3.5';
export const MODELS = ['sonic-3.5', 'sonic-3', 'sonic-turbo', 'sonic-2'];
export const VOICE_LANGUAGE = 'es';

export function cleanIpcError(error) {
  return String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
