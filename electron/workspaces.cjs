const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { STYLE_IDS, DEFAULT_STYLE_ID } = require('./styles.cjs');

function createWorkspaceStore(defaultUserDataDir) {
  const configFile = path.join(defaultUserDataDir, 'workspaces.json');

  function readConfig() {
    try {
      if (fs.existsSync(configFile)) {
        const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        if (parsed && Array.isArray(parsed.workspaces)) {
          return {
            ...parsed,
            workspaces: parsed.workspaces.map((w) => ({
              ...w,
              style: w.style || DEFAULT_STYLE_ID,
            })),
          };
        }
      }
    } catch {}
    return {
      activeId: 'default',
      workspaces: [
        {
          id: 'default',
          name: 'Espacio Principal',
          path: defaultUserDataDir,
          createdAt: Date.now(),
          style: DEFAULT_STYLE_ID,
        },
      ],
    };
  }

  function writeConfig(data) {
    fs.mkdirSync(defaultUserDataDir, { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(data, null, 2), 'utf8');
  }

  function getActive() {
    const config = readConfig();
    const found = config.workspaces.find((w) => w.id === config.activeId) || config.workspaces[0];
    if (!found) return null;
    return {
      ...found,
      style: found.style || DEFAULT_STYLE_ID,
    };
  }

  function list() {
    const config = readConfig();
    return config.workspaces.map((w) => ({
      ...w,
      style: w.style || DEFAULT_STYLE_ID,
    }));
  }

  function createWorkspace({ name, targetPath, style }) {
    if (!name || !name.trim()) throw new Error('El nombre del espacio de trabajo es requerido.');
    if (!targetPath || !targetPath.trim()) throw new Error('La carpeta de destino es requerida.');

    const resolvedStyle = style || DEFAULT_STYLE_ID;
    if (!STYLE_IDS.includes(resolvedStyle)) {
      throw new Error(`Estilo visual no válido: "${resolvedStyle}". Estilos permitidos: ${STYLE_IDS.join(', ')}.`);
    }

    const cleanPath = path.resolve(targetPath.trim());
    fs.mkdirSync(cleanPath, { recursive: true });
    fs.mkdirSync(path.join(cleanPath, 'videos'), { recursive: true });
    fs.mkdirSync(path.join(cleanPath, 'voiceovers'), { recursive: true });
    fs.mkdirSync(path.join(cleanPath, 'conversations'), { recursive: true });

    const id = crypto.randomUUID();
    const newWs = {
      id,
      name: name.trim(),
      path: cleanPath,
      createdAt: Date.now(),
      style: resolvedStyle,
    };

    try {
      fs.writeFileSync(path.join(cleanPath, 'workspace.json'), JSON.stringify(newWs, null, 2), 'utf8');
    } catch {}

    const config = readConfig();
    config.workspaces = config.workspaces.filter((w) => w.path !== cleanPath && w.id !== id);
    config.workspaces.push(newWs);
    config.activeId = id;
    writeConfig(config);

    return newWs;
  }

  function switchWorkspace(id) {
    const config = readConfig();
    const found = config.workspaces.find((w) => w.id === id);
    if (!found) throw new Error('Espacio de trabajo no encontrado.');
    config.activeId = id;
    writeConfig(config);
    return {
      ...found,
      style: found.style || DEFAULT_STYLE_ID,
    };
  }

  function updateStyle(id, style) {
    if (!STYLE_IDS.includes(style)) {
      throw new Error(`Estilo visual no válido: "${style}". Estilos permitidos: ${STYLE_IDS.join(', ')}.`);
    }
    const config = readConfig();
    const ws = config.workspaces.find((w) => w.id === id);
    if (!ws) throw new Error('Espacio de trabajo no encontrado.');

    ws.style = style;
    writeConfig(config);

    if (ws.path) {
      try {
        const wsJsonPath = path.join(ws.path, 'workspace.json');
        let data = {};
        if (fs.existsSync(wsJsonPath)) {
          try {
            data = JSON.parse(fs.readFileSync(wsJsonPath, 'utf8'));
          } catch {}
        }
        data = { ...data, ...ws, style };
        fs.writeFileSync(wsJsonPath, JSON.stringify(data, null, 2), 'utf8');
      } catch {}
    }

    return {
      ...ws,
      style,
    };
  }

  return {
    getActive,
    list,
    createWorkspace,
    switchWorkspace,
    updateStyle,
  };
}

module.exports = { createWorkspaceStore };
