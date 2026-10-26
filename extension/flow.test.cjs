// Offline tests for the pure helpers of flow.js / flow-main.js. DOM behavior (settings popover, upload
// interception, disabled prompt box) can only be verified live in Flow.
const assert = require('node:assert/strict');
const flow = require('./flow.js');
const { base64ToBytes } = require('./flow-main.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test('modelLabel maps ids and rejects unknown models', () => {
  assert.equal(flow.modelLabel('nano-banana-pro'), 'Nano Banana Pro');
  assert.equal(flow.modelLabel(' Nano-Banana-Pro '), 'Nano Banana Pro');
  assert.throws(() => flow.modelLabel('other'), /no soportado/);
});

test('outputsLabel builds xN and validates', () => {
  assert.equal(flow.outputsLabel(2), 'x2');
  assert.equal(flow.outputsLabel('4'), 'x4');
  assert.throws(() => flow.outputsLabel(0));
  assert.throws(() => flow.outputsLabel(9));
  assert.throws(() => flow.outputsLabel('dos'));
});

test('labelMatches handles icon ligature prefixes, accents and loose mode', () => {
  assert.equal(flow.labelMatches('crop_16_9 16:9', '16:9'), true);
  assert.equal(flow.labelMatches('crop_16_9 9:16', '16:9'), false);
  assert.equal(flow.labelMatches('image Imagen', 'Imagen'), true);
  assert.equal(flow.labelMatches('videocam Vídeo', 'Imagen'), false);
  assert.equal(flow.labelMatches('x2', 'x2'), true);
  assert.equal(flow.labelMatches('x12', 'x2'), false);
  assert.equal(flow.labelMatches('🍌 Nano Banana Pro', 'Nano Banana Pro', true), true);
  assert.equal(flow.labelMatches('Nano Banana 2 Lite', 'Nano Banana Pro', true), false);
  assert.equal(flow.labelMatches('anything', ''), false);
});

test('findByLabel picks the matching element', () => {
  const els = [{ textContent: 'image Imagen' }, { textContent: 'videocam Vídeo' }];
  assert.equal(flow.findByLabel(els, 'Vídeo'), els[1]);
  assert.equal(flow.findByLabel(els, 'x9'), null);
});

test('isFlowUrl accepts flow.google.com and the legacy labs URL only', () => {
  assert.equal(flow.isFlowUrl('https://flow.google.com/project/abc'), true);
  assert.equal(flow.isFlowUrl('https://labs.google/fx/tools/flow'), true);
  assert.equal(flow.isFlowUrl('https://labs.google/fx/other'), false);
  assert.equal(flow.isFlowUrl('https://evil.example/flow.google.com'), false);
  assert.equal(flow.isFlowUrl('nope'), false);
});

test('projectUrlFrom detects the project on flow.google.com', () => {
  const id = '0123456789abcdef0123456789abcdef0123';
  const loc = (origin, pathname) => ({ origin, pathname });
  assert.equal(flow.projectUrlFrom(loc('https://flow.google.com', `/project/${id}/x`)), `https://flow.google.com/project/${id}`);
  assert.equal(flow.projectUrlFrom(loc('https://flow.google.com', `/u/4/project/${id}`)), `https://flow.google.com/u/4/project/${id}`);
  assert.equal(flow.projectUrlFrom(loc('https://labs.google', `/project/${id}`)), null);
});

test('normalizeReferences validates and fills defaults', () => {
  assert.deepEqual(flow.normalizeReferences(undefined), []);
  const [filled] = flow.normalizeReferences([{ base64: 'AAAA' }]);
  assert.equal(filled.mime, 'image/png');
  assert.equal(filled.base64, 'AAAA');
  // Unique per job so the upload can be found in Flow's asset list; the extension stays last
  assert.match(filled.name, /^referencia-1-[a-z0-9]+\.png$/);
  const [a, b] = flow.normalizeReferences([{ name: 'hoja.jpg', base64: 'A' }, { name: 'hoja.jpg', base64: 'B' }]);
  assert.notEqual(a.name, b.name);
  assert.match(a.name, /^hoja-[a-z0-9]+\.jpg$/);
  assert.throws(() => flow.normalizeReferences([{ name: 'a' }]), /sin contenido|no tiene contenido/);
});

test('normalizeReferences keeps assetId and accepts assetId-only references', () => {
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const [both, only] = flow.normalizeReferences([
    { name: 'hoja.jpg', base64: 'AAAA', assetId: id.toUpperCase() },
    { name: 'hoja.jpg', assetId: id },
  ]);
  assert.equal(both.assetId, id);
  assert.equal(both.base64, 'AAAA');
  assert.equal(only.assetId, id);
  assert.equal(only.base64, '');
  assert.equal(flow.normalizeReferences([{ base64: 'A' }])[0].assetId, null);
  assert.equal(flow.normalizeReferences([{ base64: 'A', assetId: 'not-an-id' }])[0].assetId, null);
  assert.throws(() => flow.normalizeReferences([{ assetId: 'not-an-id' }]), /no tiene contenido/);
});

test('assetIdFromSrc reads the uuid of a Flow image URL', () => {
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  assert.equal(flow.assetIdFromSrc(`https://flow-content.google/image/${id}?Expires=1&Signature=x`), id);
  assert.equal(flow.assetIdFromSrc(`https://flow-content.google/image/${id.toUpperCase()}`), id);
  assert.equal(flow.assetIdFromSrc('https://flow.google.com/asb/abc'), null);
  assert.equal(flow.assetIdFromSrc('https://flow-content.google/image/not-a-uuid?x=1'), null);
  assert.equal(flow.assetIdFromSrc(undefined), null);
});

test('isAgentModeOn reads aria-pressed or the checked class', () => {
  const chip = (pressed, cls) => ({
    getAttribute: () => pressed,
    classList: { contains: (c) => c === cls },
  });
  assert.equal(flow.isAgentModeOn(chip('true', '')), true);
  assert.equal(flow.isAgentModeOn(chip('false', 'agent-mode-chip-checked')), true);
  assert.equal(flow.isAgentModeOn(chip('false', '')), false);
  assert.equal(flow.isAgentModeOn(null), false);
});

test('isBoxReady requires contenteditable and no aria-disabled', () => {
  const box = (attrs) => ({ getAttribute: (name) => attrs[name] ?? null });
  assert.equal(flow.isBoxReady(box({ contenteditable: 'true' })), true);
  assert.equal(flow.isBoxReady(box({ contenteditable: 'false' })), false);
  assert.equal(flow.isBoxReady(box({ contenteditable: 'true', 'aria-disabled': 'true' })), false);
  assert.equal(flow.isBoxReady(null), false);
});

test('base64ToBytes round-trips with bytesToBase64', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 128]);
  const back = base64ToBytes(flow.bytesToBase64(bytes));
  assert.deepEqual(Array.from(back), Array.from(bytes));
  assert.equal(base64ToBytes('').length, 0);
});

test('videoModelLabel maps known ids and rejects unknown ones', () => {
  assert.equal(flow.videoModelLabel('omni-1.1-flash'), 'Omni 1.1 Flash');
  assert.equal(flow.videoModelLabel('veo-3.1-lite'), 'Veo 3.1 - Lite');
  assert.equal(flow.videoModelLabel('veo-3.1-fast'), 'Veo 3.1 - Fast');
  assert.equal(flow.videoModelLabel('VEO-3.1-Quality'), 'Veo 3.1 - Quality');
  assert.throws(() => flow.videoModelLabel('nano-banana-pro'), /no soportado/);
});

test('secondsLabel and resolutionLabel validate against Flow options', () => {
  assert.equal(flow.secondsLabel(8), '8 s');
  assert.equal(flow.secondsLabel('10'), '10 s');
  assert.throws(() => flow.secondsLabel(7), /no válida/);
  assert.equal(flow.resolutionLabel('720P'), '720p');
  assert.throws(() => flow.resolutionLabel('1080p'), /no válida/);
});

test('flowUuidFromUrl reads image and video uuids', () => {
  const id = '0a1b2c3d-1111-4222-8333-444455556666';
  assert.equal(flow.flowUuidFromUrl(`https://flow-content.google/image/${id}?Expires=1&Signature=x`), id);
  assert.equal(flow.flowUuidFromUrl(`https://flow-content.google/video/${id.toUpperCase()}?Expires=1`), id);
  assert.equal(flow.flowUuidFromUrl('https://flow-content.google/image/not-a-uuid'), null);
  assert.equal(flow.flowUuidFromUrl(null), null);
});

test('newVideoIds returns only ids missing from the snapshot, once each', () => {
  assert.deepEqual(flow.newVideoIds(new Set(['a', 'b']), ['a', 'c', 'b', 'c', 'd']), ['c', 'd']);
  assert.deepEqual(flow.newVideoIds(['a'], ['a']), []);
  assert.deepEqual(flow.newVideoIds(new Set(), []), []);
});

test('capResults keeps only the requested number of results (old tiles re-rendered after a scroll)', () => {
  const fresh = ['n1', 'n2', 'old1', 'old2', 'old3'];
  assert.deepEqual(flow.capResults(fresh, 2), ['n1', 'n2']);
  assert.deepEqual(flow.capResults(fresh, 1), ['n1']);
  assert.deepEqual(flow.capResults(['n1'], 2), ['n1']);
  assert.deepEqual(flow.capResults(fresh, undefined), fresh);
  assert.deepEqual(flow.capResults(fresh, 0), fresh);
});

console.log(`${passed} passed`);
