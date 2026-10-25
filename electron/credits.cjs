// Local ledger of Cartesia usage plus an ESTIMATED balance. Cartesia exposes no usage endpoint,
// so the numbers come only from generations made through Mecatube (1 credit = 1 character).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_PLAN_CREDITS = 100000;
const DEFAULT_CYCLE_START_DAY = 1;
const RECENT_LIMIT = 20;
const PLAN_MAX = 100000000;
const REMAINING_MAX = 1000000000;
const TEXT_MAX = 200;

const DEFAULT_SETTINGS = Object.freeze({ planCredits: DEFAULT_PLAN_CREDITS, cycleStartDay: DEFAULT_CYCLE_START_DAY, calibration: null });

// Cycle that contains `now`: starts on cycleStartDay (1-28, local time) at 00:00; ends one month later
function cycleWindow(now, cycleStartDay) {
  const date = new Date(now);
  let start = new Date(date.getFullYear(), date.getMonth(), cycleStartDay);
  if (start.getTime() > date.getTime()) start = new Date(date.getFullYear(), date.getMonth() - 1, cycleStartDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, cycleStartDay);
  return { start: start.getTime(), end: end.getTime() };
}

function sumChars(entries) {
  return entries.reduce((total, entry) => total + entry.chars, 0);
}

// Pure. ledger: [{ at, chars, videoId, ... }]; settings: { planCredits, cycleStartDay, calibration: { remaining, at } | null }
function computeBalance(ledger, settings, now = Date.now()) {
  const entries = Array.isArray(ledger) ? ledger.filter((entry) => Number.isFinite(entry?.at) && Number.isFinite(entry?.chars)) : [];
  const planCredits = settings?.planCredits ?? DEFAULT_PLAN_CREDITS;
  const cycleStartDay = settings?.cycleStartDay ?? DEFAULT_CYCLE_START_DAY;
  const calibration = settings?.calibration ?? null;
  const { start, end } = cycleWindow(now, cycleStartDay);

  const inCycle = entries.filter((entry) => entry.at >= start && entry.at < end);
  const usedThisCycle = sumChars(inCycle);
  // A calibration only counts inside the current cycle; the dashboard number resets with the plan
  const calibrationActive = Boolean(calibration) && calibration.at >= start && calibration.at < end;
  const remaining = calibrationActive
    ? Math.max(0, calibration.remaining - sumChars(entries.filter((entry) => entry.at > calibration.at)))
    : Math.max(0, planCredits - usedThisCycle);

  const perVideo = {};
  for (const entry of entries) {
    if (entry.videoId) perVideo[entry.videoId] = (perVideo[entry.videoId] ?? 0) + entry.chars;
  }
  const recent = [...entries].sort((a, b) => b.at - a.at).slice(0, RECENT_LIMIT);

  return {
    estimated: true,
    planCredits,
    cycleStartDay,
    cycleStart: start,
    cycleEnd: end,
    usedThisCycle,
    remaining,
    totalAllTime: sumChars(entries),
    perVideo,
    recent,
    calibration,
    calibrationActive,
  };
}

function integerInRange(value, min, max, message) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(message);
  return value;
}

function cleanText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, TEXT_MAX) : fallback;
}

// dir holds cartesia-usage.json; writes are atomic (temp file + rename)
function createCreditStore(dir, { now = () => Date.now() } = {}) {
  const file = path.join(dir, 'cartesia-usage.json');

  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const settings = { ...DEFAULT_SETTINGS, ...(data?.settings && typeof data.settings === 'object' ? data.settings : {}) };
      return { entries: Array.isArray(data?.entries) ? data.entries : [], settings };
    } catch {
      return { entries: [], settings: { ...DEFAULT_SETTINGS } };
    }
  }

  function write(data) {
    fs.mkdirSync(dir, { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, file);
  }

  function record({ videoId = null, videoTitle, chars, model, voiceName }) {
    integerInRange(chars, 1, PLAN_MAX, 'Invalid character count.');
    const data = read();
    const entry = {
      id: crypto.randomUUID(),
      at: now(),
      videoId: typeof videoId === 'string' && videoId ? videoId : null,
      videoTitle: cleanText(videoTitle, ''),
      chars,
      model: cleanText(model, ''),
      voiceName: cleanText(voiceName, ''),
    };
    data.entries.push(entry);
    write(data);
    return entry;
  }

  const summary = () => {
    const { entries, settings } = read();
    return computeBalance(entries, settings, now());
  };

  function saveSettings({ planCredits, cycleStartDay } = {}) {
    integerInRange(planCredits, 1, PLAN_MAX, 'Plan credits must be a whole number above 0.');
    integerInRange(cycleStartDay, 1, 28, 'The cycle start day must be between 1 and 28.');
    const data = read();
    data.settings = { ...data.settings, planCredits, cycleStartDay };
    write(data);
    return summary();
  }

  function calibrate({ remaining } = {}) {
    integerInRange(remaining, 0, REMAINING_MAX, 'Remaining credits must be a whole number, 0 or more.');
    const data = read();
    data.settings = { ...data.settings, calibration: { remaining, at: now() } };
    write(data);
    return summary();
  }

  function clearCalibration() {
    const data = read();
    data.settings = { ...data.settings, calibration: null };
    write(data);
    return summary();
  }

  return { record, summary, saveSettings, calibrate, clearCalibration };
}

module.exports = { computeBalance, cycleWindow, createCreditStore, DEFAULT_SETTINGS };
