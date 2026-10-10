import { activity, language, ready, settings, system } from '/__sdk/index.js';
import { islandActivity } from './island.js';
import { readTemperatures } from './lhm.js';
import { TEXTS } from './texts.js';
import { HISTORY, render } from './view.js';

/** After LibreHardwareMonitor did not answer, it is asked again this often. */
const LHM_RETRY = 10000;
/** LibreHardwareMonitor itself updates once a second, so asking more often gains nothing. */
const LHM_MIN_INTERVAL = 2000;

let text = TEXTS.en;
let lang = 'en';
let options;

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

function schedule() {
  clearTimeout(timer);
  timer = document.hidden ? undefined : setTimeout(poll, options.interval * 1000);
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    const stats = await system.stats();
    const now = Date.now();
    // A gap (the page was hidden, the computer slept) would join two far apart moments.
    if (now - state.sampledAt > options.interval * 3000 + 1000) state.history = [];
    state.history.push(stats.cpu.usage);
    if (state.history.length > HISTORY) state.history.splice(0, state.history.length - HISTORY);
    Object.assign(state, { stats, sampledAt: now, error: null });
    readLhm();
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
settings.subscribe((next) => {
  const intervalChanged = next.interval !== options.interval;
  const temperaturesOn = next.temperatures && !options.temperatures;
  options = next;
  if (!options.temperatures) Object.assign(state, { temps: null, lhmHint: false });
  if (temperaturesOn) lhmNextAt = 0;
  draw();
  if (temperaturesOn) readLhm();
  if (intervalChanged && !polling) schedule();
});
// The activity survives a reload of the frame, so it is set or cleared right away.
draw();
poll();
