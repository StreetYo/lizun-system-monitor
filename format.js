/** Numbers, sizes, rates and durations in the widget's language. */

const GB = 1024 ** 3;

/** Above this share of use a bar turns orange, and red above the second. */
export const WARN = 75;
export const HIGH = 90;

/** `warn`, `high` or '' for a usage of 0–100. */
export function level(percent) {
  if (percent > HIGH) return 'high';
  if (percent > WARN) return 'warn';
  return '';
}

/** `warn`, `high` or '' for a temperature in °C. */
export function heatLevel(celsius) {
  if (celsius >= 90) return 'high';
  if (celsius >= 80) return 'warn';
  return '';
}

export function number(value, digits, lang) {
  return value.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function percent(value) {
  return `${Math.round(value)}%`;
}

/** One decimal below 10, whole numbers above, the way sizes and rates read best. */
function short(value, lang) {
  return number(value, value < 10 ? 1 : 0, lang);
}

/** A size in GB, or in TB from 1000 GB. */
export function size(bytes, text, lang) {
  const gb = bytes / GB;
  if (gb >= 1000) return `${short(gb / 1024, lang)} ${text.sizeUnits.tb}`;
  return `${short(gb, lang)} ${text.sizeUnits.gb}`;
}

/** Memory in use and in total, such as `9.8 / 16 GB`. */
export function memory(used, total, text, lang) {
  return `${number(used / GB, 1, lang)} / ${short(total / GB, lang)} ${text.sizeUnits.gb}`;
}

/** A rate in B/s, KB/s, MB/s or GB/s; `units` picks the long or the short names. */
export function rate(bytesPerSec, units, lang) {
  let value = Math.max(0, bytesPerSec);
  let step = 0;
  // From 1000 on the next unit reads better than a four-digit number.
  while (value >= 1000 && step < units.length - 1) {
    value /= 1024;
    step += 1;
  }
  const digits = step === 0 || value >= 10 ? 0 : 1;
  return `${number(value, digits, lang)} ${units[step]}`;
}

/** A duration such as `2 h 15 min`, or days and hours for long ones. */
export function duration(seconds, text) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return text.days(Math.floor(hours / 24), hours % 24);
  if (hours > 0) return text.hours(hours, minutes % 60);
  return text.minutes(minutes);
}

export function temperature(reading) {
  return `${Math.round(reading.value)}°`;
}
