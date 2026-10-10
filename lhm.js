/**
 * CPU and GPU temperatures from LibreHardwareMonitor's Remote Web Server
 * (Options > Remote Web Server in LibreHardwareMonitor, port 8085 by default).
 *
 * `data.json` is the tree LibreHardwareMonitor shows in its window: computer > hardware >
 * sensor groups ("Temperatures", "Load", ...) > sensors, each node `{ Text, Value, Children }`.
 * Newer versions add `Type` and `SensorId` to the sensors and `HardwareId` to the hardware.
 * Sensor names differ between CPU makers and versions, so the search tries several.
 */
import { network } from '/__sdk/index.js';

const URL = 'http://localhost:8085/data.json';

/** CPU sensors that stand for the whole chip, best first. */
const CPU_PACKAGE = ['cpu package', 'package', 'core (tctl/tdie)', 'tctl/tdie', 'cpu (tctl/tdie)', 'tdie', 'tctl'];
/** Values in °C that are not temperatures, and sensor names that are not the chip's. */
const NOT_A_TEMPERATURE = /distance|tjmax|limit|critical/i;

const CPU_NAME = /ryzen|threadripper|epyc|athlon|xeon|pentium|celeron|core\s?i\d|core\(tm\)|core ultra|processor/i;
const GPU_NAME = /geforce|radeon|nvidia|quadro|rtx|gtx|arc|graphics|gpu/i;

/** `{ value, celsius }` from a value such as "54.0 °C" (or "54,0 °C", or °F), else null. */
function parseTemperature(value) {
  const match = /(-?\d+(?:[.,]\d+)?)\s*°\s*([CF])/i.exec(String(value ?? ''));
  if (!match) return null;
  const number = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  const celsius = match[2].toUpperCase() === 'F' ? ((number - 32) * 5) / 9 : number;
  return { value: number, celsius };
}

/** Whether a hardware node is the CPU or a GPU, from its id, icon or name. */
function hardwareKind(sensor, hardware) {
  const id = String(sensor.SensorId ?? hardware?.HardwareId ?? '').toLowerCase();
  if (id) {
    if (/^\/[a-z]*cpu\//.test(id)) return 'cpu';
    if (/^\/[a-z-]*gpu[a-z-]*\//.test(id)) return 'gpu';
    // The motherboard's chips also report a "CPU" temperature; the CPU's own sensors are better.
    return 'other';
  }
  const image = String(hardware?.ImageURL ?? '').toLowerCase();
  if (image.endsWith('/cpu.png')) return 'cpu';
  if (/\/(nvidia|ati|amd|gpu)\.png$/.test(image)) return 'gpu';
  // "AMD Ryzen 7 5800H with Radeon Graphics" is a CPU, so CPU names are checked first.
  const name = String(hardware?.Text ?? '');
  if (CPU_NAME.test(name)) return 'cpu';
  if (GPU_NAME.test(name)) return 'gpu';
  return 'other';
}

/** All temperature sensors in the tree with the kind of hardware they belong to. */
function collect(root) {
  const sensors = [];
  // Each entry is a node and the nodes above it, so a sensor finds its hardware two levels up.
  const walk = (node, parents) => {
    if (!node || typeof node !== 'object') return;
    const children = Array.isArray(node.Children) ? node.Children : [];
    if (children.length) {
      for (const child of children) walk(child, [...parents, node]);
      return;
    }
    if (node.Type && node.Type !== 'Temperature') return;
    const name = String(node.Text ?? '');
    if (NOT_A_TEMPERATURE.test(name)) return;
    const reading = parseTemperature(node.Value);
    if (!reading) return;
    const hardware = parents.at(-2);
    sensors.push({ name: name.toLowerCase(), kind: hardwareKind(node, hardware), ...reading });
  };
  walk(root, []);
  return sensors;
}

function hottest(sensors) {
  return sensors.reduce((best, sensor) => (!best || sensor.celsius > best.celsius ? sensor : best), null);
}

function pick(sensor) {
  return sensor ? { value: sensor.value, celsius: sensor.celsius } : null;
}

/** `{ cpu, gpu }` readings (`{ value, celsius }` or null) found in a `data.json` tree. */
export function findTemperatures(root) {
  const sensors = collect(root);
  const cpu = sensors.filter((sensor) => sensor.kind === 'cpu');
  const gpu = sensors.filter((sensor) => sensor.kind === 'gpu');

  let cpuReading = null;
  for (const name of CPU_PACKAGE) {
    cpuReading = cpu.find((sensor) => sensor.name === name);
    if (cpuReading) break;
  }
  cpuReading ??= hottest(cpu.filter((sensor) => sensor.name.includes('core'))) ?? hottest(cpu);

  // With an integrated and a discrete GPU, the hotter one is the one doing the work.
  const gpuReading =
    hottest(gpu.filter((sensor) => sensor.name === 'gpu core')) ??
    hottest(gpu.filter((sensor) => sensor.name.includes('core')));

  return { cpu: pick(cpuReading), gpu: pick(gpuReading) };
}

/**
 * Reads the temperatures. Rejects when LibreHardwareMonitor does not answer (a `LizunError`
 * from `network.request`) or answers with something that is not its data.
 */
export async function readTemperatures() {
  const response = await network.request(URL);
  if (!response.ok) throw new Error(`LibreHardwareMonitor answered HTTP ${response.status}`);
  return findTemperatures(response.json());
}
