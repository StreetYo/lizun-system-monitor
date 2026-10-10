/** What the closed island shows: the chosen metric at the right end, the others in the middle. */
import { level, percent, rate } from './format.js';

const COLORS = { warn: '#ff9f0a', high: '#ff453a' };

/** The live activity for these stats, or null when it is turned off. */
export function islandActivity(stats, options, text, lang) {
  if (!options.showInIsland || !stats) return null;
  const memory = stats.memory.totalBytes ? (stats.memory.usedBytes / stats.memory.totalBytes) * 100 : 0;
  const loads = [
    { key: 'cpu', label: text.cpu, value: stats.cpu.usage },
    { key: 'ram', label: text.ram, value: memory },
  ];
  if (stats.gpu) loads.push({ key: 'gpu', label: text.gpu, value: stats.gpu.usage });
  const said = (load) => `${load.label} ${percent(load.value)}`;
  const down = `↓ ${rate(stats.network.downBytesPerSec, text.rateUnits, lang)}`;
  const up = `↑ ${rate(stats.network.upBytesPerSec, text.rateUnits, lang)}`;

  let trailing;
  let middle;
  let main;
  if (options.islandMetric === 'network') {
    trailing = down;
    middle = [up, ...loads.slice(0, 2).map(said)];
    // The icon still warns about the CPU.
    main = loads[0];
  } else {
    // GPU may be unknown on this computer; the CPU stands in for it then.
    main = loads.find((load) => load.key === options.islandMetric) ?? loads[0];
    trailing = said(main);
    middle = loads.filter((load) => load !== main).map(said);
  }
  const color = COLORS[level(main.value)];
  return {
    leading: color ? { icon: 'lightning', color } : { icon: 'lightning' },
    title: middle.join(' · ').slice(0, 100),
    trailing: { text: trailing.slice(0, 16) },
  };
}
