// Zips extension/ into release/extension.zip (manifest.json at the zip root),
// leaving out tests, docs and the Web Store listing images (icons/store, uploaded separately).
// Uses the tar (bsdtar) that ships with Windows 10+.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const source = path.join(root, 'extension');
const releaseDir = path.join(root, 'release');
const output = path.join(releaseDir, 'extension.zip');
const EXCLUDED = [/\.test\.cjs$/, /^README\.md$/i, /^store$/];

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
  // Use the Windows bsdtar explicitly: a GNU tar earlier in PATH (e.g. Git Bash) treats "C:" as a remote host
  const tarBin = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? 'C:\Windows', 'System32', 'tar.exe') : 'tar';
  const result = spawnSync(tarBin, ['-a', '-c', '-f', output, '-C', staging, ...fs.readdirSync(staging)], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('tar failed to create the zip');
  console.log(`Created ${path.relative(root, output)}`);
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
