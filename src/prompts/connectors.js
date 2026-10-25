// Pure helpers for the "Agregar palabras conectoras" message. No DOM, no React.

const foldKey = (value) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Non-empty trimmed lines, deduplicated ignoring case and accents; first spelling and order win
export function parseConnectors(listText) {
  if (typeof listText !== 'string') return [];
  const seen = new Set();
  const connectors = [];
  for (const line of listText.split(/\r\n|\r|\n/)) {
    const connector = line.trim();
    if (!connector) continue;
    const key = foldKey(connector);
    if (seen.has(key)) continue;
    seen.add(key);
    connectors.push(connector);
  }
  return connectors;
}

// INSTRUCTION + blank line + header + connectors on one line, no trailing period
export function composeConnectorsMessage(instruction, listText) {
  return `${instruction}\n\nPALABRAS CONECTORAS DISPONIBLES:\n${parseConnectors(listText).join(', ')}`;
}
