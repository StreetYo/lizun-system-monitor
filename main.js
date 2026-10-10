import { activity, island, language, ready, settings, system } from '/__sdk/index.js';
import { islandActivity } from './island.js';
import { readTemperatures } from './lhm.js';
import { TEXTS } from './texts.js';
import { HISTORY, render } from './view.js';

/** After LibreHardwareMonitor did not answer, it is asked again this often. */
const LHM_RETRY = 10000;
/** LibreHardwareMonitor itself updates once a second, so asking more often gains nothing. */
const LHM_MIN_INTERVAL = 2000;
/** While the island is closed only the live activity needs the stats, so they come less often. */
const CLOSED_INTERVAL = 5000;

let text = TEXTS.en;
let lang = 'en';
let options;
/** Closing the island does not hide the page, so polling follows the island instead. */
let islandOpen = false;

const state = {
  stats: null,
  /** CPU usage of the last samples, oldest first. */
  history: [],
  /** When the last sample was taken, to start the graph over after a pause. */
  sampledAt: 0,
  error: null,
  temps: null,
  lhmHint: false,
};

let timer;
let polling = false;
let lhmBusy = false;
let lhmNextAt = 0;

/** What the closed island shows, to skip sending the same activity again. */
let shownActivity;

function showActivity() {
  const next = state.error ? null : islandActivity(state.stats, options, text, lang);
  const key = JSON.stringify(next);
  if (key === shownActivity) return;
  shownActivity = key;
  const update = next ? activity.set(next) : activity.clear();
  update.catch((error) => console.warn('could not update the live activity', error));
}

function draw() {
  render(state, text, lang);
  showActivity();
}

function readLhm() {
  if (!options.temperatures || lhmBusy || Date.now() < lhmNextAt) return;
  lhmBusy = true;
  readTemperatures()
    .then((temps) => {
      state.temps = temps;
      state.lhmHint = false;
      lhmNextAt = Date.now() + Math.max(LHM_MIN_INTERVAL, options.interval * 1000) - 250;
    })
    .catch((error) => {
      console.warn('LibreHardwareMonitor did not answer', error);
      state.temps = null;
      state.lhmHint = true;
      lhmNextAt = Date.now() + LHM_RETRY;
    })
    .finally(() => {
      lhmBusy = false;
      // Turned off while the request was out.
      if (!options.temperatures) Object.assign(state, { temps: null, lhmHint: false });
      draw();
    });
}

/** Stats are needed while the widget is on screen, or for the live activity in the closed island. */
function wanted() {
  return !document.hidden && (islandOpen || options.showInIsland);
}

function delay() {
  const interval = options.interval * 1000;
  return islandOpen ? interval : Math.max(interval, CLOSED_INTERVAL);
}

function schedule() {
  clearTimeout(timer);
  timer = wanted() ? setTimeout(poll, delay()) : undefined;
}

async function poll() {
  if (polling || !wanted()) return;
  polling = true;
  try {
    const stats = await system.stats();
    const now = Date.now();
    // A gap (the island was closed, the computer slept) would join two far apart moments.
    if (now - state.sampledAt > delay() * 3 + 1000) state.history = [];
    state.history.push(stats.cpu.usage);
    if (state.history.length > HISTORY) state.history.splice(0, state.history.length - HISTORY);
    Object.assign(state, { stats, sampledAt: now, error: null });
    // Temperatures are only shown in the open island.
    if (islandOpen) readLhm();
  } catch (error) {
    console.warn('system.stats failed', error);
    state.error = error;
  } finally {
    polling = false;
  }
  draw();
  schedule();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer);
  else poll();
});

const context = await ready();
lang = context.language;
text = TEXTS[lang] ?? TEXTS.en;
language.subscribe((next) => {
  lang = next;
  text = TEXTS[next] ?? TEXTS.en;
  draw();
});
options = context.settings;
islandOpen = context.islandOpen === true;
settings.subscribe((next) => {
  const temperaturesOn = next.temperatures && !options.temperatures;
  const activityOn = next.showInIsland && !options.showInIsland;
  options = next;
  if (!options.temperatures) Object.assign(state, { temps: null, lhmHint: false });
  if (temperaturesOn) lhmNextAt = 0;
  draw();
  if (temperaturesOn && islandOpen) readLhm();
  if (polling) return;
  // The live activity just turned on in the closed island: show it now, not after a pause.
  if (activityOn && !islandOpen) poll();
  else schedule();
});
island.subscribe(({ open }) => {
  islandOpen = open;
  // Fresh numbers as soon as the island opens; closing slows polling down or stops it.
  if (open) poll();
  else schedule();
});
// The activity survives a reload of the frame, so it is set or cleared right away.
draw();
poll();
