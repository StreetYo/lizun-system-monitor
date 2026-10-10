/** Draws the stats into the page from index.html. */
import { duration, heatLevel, level, memory, percent, rate, size, temperature } from './format.js';

/** Samples in the CPU graph. */
export const HISTORY = 60;

const $ = (id) => document.getElementById(id);

const monitor = $('monitor');
const message = $('message');
const cpuCard = $('cpu');
const spark = document.querySelector('.spark');
const sparkLine = $('spark-line');
const sparkArea = $('spark-area');
const hint = $('hint');

/** The parts of a row in the right card. */
function row(id) {
  const element = $(id);
  const part = (selector) => element.querySelector(selector);
  return {
    element,
    label: part('.label'),
    temp: part('.temp'),
    detail: part('.detail'),
    value: part('.value'),
    bar: part('.bar i'),
    bolt: part('.bolt'),
  };
}

const rows = { ram: row('ram'), gpu: row('gpu'), disk: row('disk'), net: row('net'), battery: row('battery') };

function setLevel(element, name) {
  element.classList.toggle('warn', name === 'warn');
  element.classList.toggle('high', name === 'high');
}

function fill(bar, share) {
  bar.style.width = `${Math.min(100, Math.max(0, share))}%`;
}

function showTemperature(element, reading) {
  element.textContent = reading ? temperature(reading) : '';
  setLevel(element, reading ? heatLevel(reading.celsius) : '');
}

/** The system disk, unless another one is nearly full. */
function pickDisk(disks) {
  const known = disks.filter((disk) => disk.totalBytes > 0);
  if (!known.length) return null;
  const used = (disk) => 1 - disk.freeBytes / disk.totalBytes;
  const system = known.find((disk) => /^c:/i.test(disk.mount)) ?? known[0];
  const fullest = known.reduce((best, disk) => (used(disk) > used(best) ? disk : best));
  return used(fullest) * 100 > 90 ? fullest : system;
}

/** Line and area of the CPU graph, newest sample on the right edge. */
function drawSpark(history) {
  if (history.length < 2) {
    sparkLine.removeAttribute('d');
    sparkArea.removeAttribute('d');
    return;
  }
  const step = 100 / (HISTORY - 1);
  const points = history.map((value, index) => {
    const x = 100 - (history.length - 1 - index) * step;
    // A little room at the top and bottom, so 0% and 100% are not cut by the edges.
    const y = 96 - Math.min(100, Math.max(0, value)) * 0.88;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M${points.join('L')}`;
  const first = points[0].split(',')[0];
  sparkLine.setAttribute('d', line);
  sparkArea.setAttribute('d', `${line}L100,100L${first},100Z`);
}

function drawCpu(stats, temps, history, text) {
  const usage = stats.cpu.usage;
  $('cpu-label').textContent = text.cpu;
  $('cpu-value').textContent = percent(usage);
  showTemperature($('cpu-temp'), temps?.cpu);
  setLevel(cpuCard, level(usage));
  const details = [stats.cpu.name, text.cores(stats.cpu.cores.length)];
  if (stats.uptimeSec) details.push(text.uptime(duration(stats.uptimeSec, text)));
  cpuCard.title = details.filter(Boolean).join('\n');
  drawSpark(history);
}

function drawRam(stats, text, lang) {
  const { usedBytes, totalBytes } = stats.memory;
  const share = totalBytes ? (usedBytes / totalBytes) * 100 : 0;
  const ram = rows.ram;
  ram.label.textContent = text.ram;
  ram.detail.textContent = memory(usedBytes, totalBytes, text, lang);
  ram.value.textContent = percent(share);
  fill(ram.bar, share);
  setLevel(ram.element, level(share));
}

function drawGpu(stats, temps, text) {
  const gpu = rows.gpu;
  gpu.element.hidden = !stats.gpu;
  if (!stats.gpu) return;
  gpu.label.textContent = text.gpu;
  showTemperature(gpu.temp, temps?.gpu);
  gpu.value.textContent = percent(stats.gpu.usage);
  fill(gpu.bar, stats.gpu.usage);
  setLevel(gpu.element, level(stats.gpu.usage));
}

function drawDisk(stats, text, lang) {
  const disk = rows.disk;
  const shown = pickDisk(stats.disks ?? []);
  disk.element.hidden = !shown;
  if (!shown) return;
  const share = (1 - shown.freeBytes / shown.totalBytes) * 100;
  disk.label.textContent = text.disk(shown.mount);
  disk.value.textContent = text.free(size(shown.freeBytes, text, lang));
  fill(disk.bar, share);
  setLevel(disk.element, level(share));
  disk.element.title = stats.disks
    .filter((each) => each.totalBytes > 0)
    .map((each) => {
      const name = each.label ? `${each.mount} ${each.label}` : each.mount;
      const used = percent((1 - each.freeBytes / each.totalBytes) * 100);
      return `${name}: ${text.free(size(each.freeBytes, text, lang))} / ${size(each.totalBytes, text, lang)} (${used})`;
    })
    .join('\n');
}

function drawNetwork(stats, text, lang) {
  $('net-down').textContent = rate(stats.network.downBytesPerSec, text.rateUnits, lang);
  $('net-up').textContent = rate(stats.network.upBytesPerSec, text.rateUnits, lang);
  rows.net.element.title = text.network;
}

function drawBattery(stats, text) {
  const battery = rows.battery;
  const state = stats.battery;
  battery.element.hidden = !state;
  if (!state) return;
  battery.label.textContent = text.battery;
  battery.bolt.toggleAttribute('hidden', !state.charging);
  battery.value.textContent = percent(state.percent);
  const timeLeft = !state.pluggedIn && state.secondsLeft ? duration(state.secondsLeft, text) : '';
  // Charging shows as the bolt; plugged in and full says so in words.
  battery.detail.textContent = timeLeft || (state.pluggedIn && !state.charging ? text.pluggedIn : '');
  battery.element.title = state.charging ? text.charging : timeLeft ? text.timeLeft(timeLeft) : '';
  fill(battery.bar, state.percent);
  const low = state.percent <= 10 ? 'high' : state.percent <= 20 ? 'warn' : '';
  setLevel(battery.element, state.pluggedIn ? '' : low);
  battery.element.classList.toggle('good', Boolean(state.pluggedIn));
}

/**
 * Shows the latest stats, or a message while there are none. `temps` is `{ cpu, gpu }` from
 * LibreHardwareMonitor or null; `lhmHint` says that it could not be reached.
 */
export function render({ stats, history, temps, lhmHint, error }, text, lang) {
  monitor.hidden = !stats;
  message.hidden = Boolean(stats);
  if (!stats) {
    message.textContent = error ? text.unavailable : text.loading;
    message.title = error ? String(error.message ?? error) : '';
    return;
  }
  drawCpu(stats, temps, history, text);
  drawRam(stats, text, lang);
  drawGpu(stats, temps, text);
  drawDisk(stats, text, lang);
  drawNetwork(stats, text, lang);
  drawBattery(stats, text);
  hint.hidden = !lhmHint;
  hint.textContent = text.lhmHint;
  spark.classList.toggle('dim', lhmHint);
  // Stats that stopped coming in look dimmer until they come back.
  monitor.style.opacity = error ? '0.5' : '';
}
