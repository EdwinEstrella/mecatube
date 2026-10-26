// Copies the versioned installer to the stable name used by the README download link.
// latest.yml keeps pointing at the versioned file, which is what electron-updater reads.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const releaseDir = path.join(root, 'release');
const versioned = path.join(releaseDir, `Mecatube-Setup-${version}.exe`);
const stable = path.join(releaseDir, 'Mecatube-Setup.exe');

if (!fs.existsSync(versioned)) {
  console.error(`Installer not found: ${versioned}`);
  process.exit(1);
}
fs.copyFileSync(versioned, stable);
console.log(`Created ${path.relative(root, stable)}`);
