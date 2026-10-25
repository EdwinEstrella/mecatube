const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createWorkspaceStore(defaultUserDataDir) {
  const configFile = path.join(defaultUserDataDir, 'workspaces.json');

  function readConfig() {
    try {
      if (fs.existsSync(configFile)) {
        return JSON.parse(fs.readFileSync(configFile, 'utf8'));
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
    const found = config.workspaces.find((w) => w.id === config.activeId);
    return found || config.workspaces[0];
  }

  function list() {
    const config = readConfig();
    return config.workspaces;
  }

  function createWorkspace({ name, targetPath }) {
    if (!name || !name.trim()) throw new Error('El nombre del espacio de trabajo es requerido.');
    if (!targetPath || !targetPath.trim()) throw new Error('La carpeta de destino es requerida.');

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
    return found;
  }

  return {
    getActive,
    list,
    createWorkspace,
    switchWorkspace,
  };
}

module.exports = { createWorkspaceStore };
