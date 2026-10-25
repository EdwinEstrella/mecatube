// Run: node electron/credits.test.cjs
const assert = require('node:assert/strict');
const { computeBalance, cycleWindow } = require('./credits.cjs');

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const entry = (when, chars, videoId = null) => ({ at: when, chars, videoId });
let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok   ${name}`);
}

test('cycle window starts on the start day and ends one month later', () => {
  const w = cycleWindow(at(2026, 3, 20), 15);
  assert.equal(w.start, new Date(2026, 2, 15).getTime());
  assert.equal(w.end, new Date(2026, 3, 15).getTime());
});

test('before the start day the cycle began last month', () => {
  const w = cycleWindow(at(2026, 3, 10), 15);
  assert.equal(w.start, new Date(2026, 1, 15).getTime());
  assert.equal(w.end, new Date(2026, 2, 15).getTime());
});

test('year rollover and short months (day 28 in February)', () => {
  assert.equal(cycleWindow(at(2026, 1, 5), 20).start, new Date(2025, 11, 20).getTime());
  const feb = cycleWindow(at(2026, 2, 28, 0), 28);
  assert.equal(feb.start, new Date(2026, 1, 28).getTime());
  assert.equal(feb.end, new Date(2026, 2, 28).getTime());
});

test('exact boundary: start inclusive, end belongs to the next cycle', () => {
  const start = new Date(2026, 4, 1).getTime();
  const ledger = [entry(start - 1, 100), entry(start, 40), entry(new Date(2026, 5, 1).getTime(), 7)];
  const b = computeBalance(ledger, { planCredits: 1000, cycleStartDay: 1 }, at(2026, 5, 20));
  assert.equal(b.usedThisCycle, 40);
  assert.equal(b.remaining, 960);
  assert.equal(b.totalAllTime, 147);
  assert.equal(b.estimated, true);
});

test('remaining never drops below zero', () => {
  const b = computeBalance([entry(at(2026, 5, 3), 5000)], { planCredits: 1000, cycleStartDay: 1 }, at(2026, 5, 20));
  assert.equal(b.remaining, 0);
});

test('calibration inside the cycle replaces the plan and subtracts later usage only', () => {
  const ledger = [entry(at(2026, 5, 2), 300), entry(at(2026, 5, 10), 100), entry(at(2026, 5, 12), 50)];
  const settings = { planCredits: 1000, cycleStartDay: 1, calibration: { remaining: 400, at: at(2026, 5, 10, 18) } };
  const b = computeBalance(ledger, settings, at(2026, 5, 20));
  assert.equal(b.remaining, 350);
  assert.equal(b.usedThisCycle, 450);
  assert.equal(b.calibrationActive, true);
});

test('calibration from a previous cycle is ignored; calibration clamps at zero', () => {
  const old = { planCredits: 1000, cycleStartDay: 1, calibration: { remaining: 10, at: at(2026, 4, 20) } };
  assert.equal(computeBalance([entry(at(2026, 5, 2), 100)], old, at(2026, 5, 20)).remaining, 900);
  assert.equal(computeBalance([], old, at(2026, 5, 20)).calibrationActive, false);
  const tight = { planCredits: 1000, cycleStartDay: 1, calibration: { remaining: 10, at: at(2026, 5, 3) } };
  assert.equal(computeBalance([entry(at(2026, 5, 4), 99)], tight, at(2026, 5, 20)).remaining, 0);
});

test('per-video sums (all time), standalone excluded, recent newest first and capped', () => {
  const ledger = [entry(at(2026, 1, 1), 10, 'a'), entry(at(2026, 5, 1), 5, 'a'), entry(at(2026, 5, 2), 7, 'b'), entry(at(2026, 5, 3), 9)];
  const b = computeBalance(ledger, {}, at(2026, 5, 20));
  assert.deepEqual(b.perVideo, { a: 15, b: 7 });
  assert.equal(b.recent[0].chars, 9);
  const many = Array.from({ length: 30 }, (_, i) => entry(at(2026, 5, 1) + i * 1000, 1));
  assert.equal(computeBalance(many, {}, at(2026, 5, 20)).recent.length, 20);
});

test('defaults: Pro plan 100000 on day 1; junk entries ignored', () => {
  const b = computeBalance([null, { at: 'x', chars: 3 }, entry(at(2026, 5, 2), 1000)], undefined, at(2026, 5, 20));
  assert.equal(b.planCredits, 100000);
  assert.equal(b.cycleStartDay, 1);
  assert.equal(b.remaining, 99000);
});

console.log(`\n${passed} passed`);
