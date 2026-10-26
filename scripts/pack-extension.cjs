// Zips extension/ into release/Mecatube-Extension.zip (manifest.json at the zip root),
// leaving out tests and docs. Uses the tar (bsdtar) that ships with Windows 10+.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const source = path.join(root, 'extension');
const releaseDir = path.join(root, 'release');
const output = path.join(releaseDir, 'Mecatube-Extension.zip');
const EXCLUDED = [/\.test\.cjs$/, /^README\.md$/i];

function copyFiltered(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (EXCLUDED.some((pattern) => pattern.test(entry.name))) continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyFiltered(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'mecatube-ext-'));
try {
  copyFiltered(source, staging);
  fs.mkdirSync(releaseDir, { recursive: true });
  fs.rmSync(output, { force: true });
  const result = spawnSync('tar', ['-a', '-c', '-f', output, '-C', staging, '.'], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('tar failed to create the zip');
  console.log(`Created ${path.relative(root, output)}`);
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
