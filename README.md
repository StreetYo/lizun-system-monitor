# System monitor for Lizun

How busy the computer is, at a glance in the [Lizun](https://github.com/StreetYo/Lizun) island:
CPU load with a graph of the last minute or two, memory, GPU, network, the system disk and the
battery. With LibreHardwareMonitor running it also shows the CPU and GPU temperatures.

## Install

In Lizun, open Settings > Widgets > Add a widget, paste this link and press Install:

```
https://github.com/StreetYo/lizun-system-monitor
```

To install a fixed version, use the link of a release instead, for example
`https://github.com/StreetYo/lizun-system-monitor/releases/tag/v1.0.0`.

The widget needs a Lizun build with `system.stats()` (the `system` permission).

## Using it

- **CPU**: total load and a graph of the last 60 samples. Point at the card for the CPU's name,
  its logical cores and how long the computer has been up.
- **RAM**: used and total memory, and the share in use.
- **GPU**: the busiest GPU engine. Not shown when Windows does not report it.
- **Disk**: free space on the system disk (C:), or on another disk once that one is more than
  90% full. Point at it for all disks.
- **Network**: download and upload rates of all adapters together.
- **Battery**: charge, a bolt while charging, and the time left on battery. Not shown on a
  computer without a battery.

Bars turn orange above 75% and red above 90%; temperatures turn orange from 80 °C and red from
90 °C. The widget refreshes every 2 seconds (see Settings) while its page is visible and pauses
while it is hidden.

### Temperatures

Windows does not give temperatures to programs without a driver, so the widget reads them from
[LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor):

1. Run LibreHardwareMonitor (as administrator, or the CPU temperatures stay empty).
2. In its menu, turn on Options > Remote Web Server (port 8085, the default).
3. In Settings > Widgets > System monitor, turn on "Temperatures from LibreHardwareMonitor".

The CPU card shows the package temperature (`CPU Package` on Intel, `Core (Tctl/Tdie)` on AMD,
else the hottest core), and the GPU row the `GPU Core` temperature. While LibreHardwareMonitor
does not answer, the CPU card says so and the widget tries again every 10 seconds.

### In the closed island

With "Show the load in the closed island" on, the mini island shows a lightning icon, the chosen
value at the right end (`CPU 23%`, or the download rate for Network) and the others in the
middle (`RAM 61% · GPU 12%`). The icon turns orange or red when that value is high.

## Settings

| Setting | Default |
|---|---|
| Refresh every (1–10 s) | 2 s |
| Temperatures from LibreHardwareMonitor | Off |
| Show the load in the closed island | Off |
| Main value in the closed island: CPU, Memory, GPU or Network | CPU |

## Permissions

| Permission | Why |
|---|---|
| `system` | Reads the CPU, memory, GPU, disk, network and battery figures from Windows. |
| `activity` | Shows the load in the closed island, when that setting is on. |
| Network `http://localhost:8085` | LibreHardwareMonitor's web server on this computer, for temperatures, only when that setting is on. Nothing is sent anywhere else. |

Nothing is stored.

## Development

The widget is plain HTML, CSS and JavaScript with no build step:

| File | What it is |
|---|---|
| `manifest.json` | Id, size, permissions, network, settings and their Russian translation |
| `index.html`, `style.css` | Page shown in the island, built on the island theme (`--lz-*` variables) |
| `main.js` | Polling while visible, settings, language, the live activity |
| `view.js` | Draws the cards, bars and the CPU graph |
| `island.js` | What the closed island shows |
| `lhm.js` | Reads and searches LibreHardwareMonitor's `data.json` |
| `format.js` | Sizes, rates, durations and load levels |
| `texts.js` | The widget's texts in English and Russian |

To try changes, choose this folder in Settings > Widgets > Add a widget, or copy it to
`%APPDATA%\app.lizun.desktop\widgets\lizun.system-monitor\` and press Reload. How widgets work:
[Writing a Lizun widget](https://github.com/StreetYo/Lizun/blob/master/docs/widgets.md).

To release a version, raise `version` in `manifest.json`, then tag and publish a GitHub release
(`v1.0.1`).
