// Run: node electron/workspaces.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWorkspaceStore } = require('./workspaces.cjs');
const { STYLE_IDS, DEFAULT_STYLE_ID } = require('./styles.cjs');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mecatube-ws-test-'));
}

test('createWorkspace defaults style to stickman when omitted', () => {
  const rootDir = makeTmpDir();
  const store = createWorkspaceStore(rootDir);
  const targetDir = makeTmpDir();

  const ws = store.createWorkspace({
    name: 'Canal Principal',
    targetPath: targetDir,
  });

  assert.equal(ws.style, 'stickman');

  // Verify workspace.json on disk
  const wsJson = JSON.parse(fs.readFileSync(path.join(targetDir, 'workspace.json'), 'utf8'));
  assert.equal(wsJson.style, 'stickman');

  // Verify config
  const active = store.getActive();
  assert.equal(active.id, ws.id);
  assert.equal(active.style, 'stickman');
});

test('createWorkspace persists chosen valid style', () => {
  const rootDir = makeTmpDir();
  const store = createWorkspaceStore(rootDir);
  const targetDir = makeTmpDir();

  const ws = store.createWorkspace({
    name: 'Canal Anime',
    targetPath: targetDir,
    style: 'anime',
  });

  assert.equal(ws.style, 'anime');

  const wsJson = JSON.parse(fs.readFileSync(path.join(targetDir, 'workspace.json'), 'utf8'));
  assert.equal(wsJson.style, 'anime');

  const active = store.getActive();
  assert.equal(active.style, 'anime');
});

test('createWorkspace rejects invalid style with a Spanish error', () => {
  const rootDir = makeTmpDir();
  const store = createWorkspaceStore(rootDir);
  const targetDir = makeTmpDir();

  assert.throws(
    () => {
      store.createWorkspace({
        name: 'Canal Invalido',
        targetPath: targetDir,
        style: 'cyberpunk-neon',
      });
    },
    (err) => {
      assert.match(err.message, /Estilo visual no v[aá]lido/i);
      return true;
    }
  );
});

test('updateStyle updates active workspace in config and workspace.json', () => {
  const rootDir = makeTmpDir();
  const store = createWorkspaceStore(rootDir);
  const targetDir = makeTmpDir();

  const ws = store.createWorkspace({
    name: 'Canal Test',
    targetPath: targetDir,
    style: 'flat',
  });

  assert.equal(ws.style, 'flat');

  const updated = store.updateStyle(ws.id, 'realistic');
  assert.equal(updated.style, 'realistic');

  // Check config
  assert.equal(store.getActive().style, 'realistic');

  // Check workspace.json
  const wsJson = JSON.parse(fs.readFileSync(path.join(targetDir, 'workspace.json'), 'utf8'));
  assert.equal(wsJson.style, 'realistic');
});

test('updateStyle rejects invalid style with a Spanish error', () => {
  const rootDir = makeTmpDir();
  const store = createWorkspaceStore(rootDir);
  const targetDir = makeTmpDir();

  const ws = store.createWorkspace({
    name: 'Canal Test',
    targetPath: targetDir,
  });

  assert.throws(
    () => {
      store.updateStyle(ws.id, 'estilo-inexistente');
    },
    (err) => {
      assert.match(err.message, /Estilo visual no v[aá]lido/i);
      return true;
    }
  );
});

test('existing workspaces without style default to stickman', () => {
  const rootDir = makeTmpDir();
  const configFile = path.join(rootDir, 'workspaces.json');
  // Write legacy config without style
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      activeId: 'legacy-ws',
      workspaces: [
        {
          id: 'legacy-ws',
          name: 'Legacy Workspace',
          path: rootDir,
          createdAt: Date.now(),
        },
      ],
    }),
    'utf8'
  );

  const store = createWorkspaceStore(rootDir);
  const active = store.getActive();
  assert.equal(active.style, 'stickman');

  const list = store.list();
  assert.equal(list[0].style, 'stickman');
});
