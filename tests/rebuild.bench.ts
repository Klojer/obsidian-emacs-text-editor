// Micro-benchmark for the per-keystroke binding-map rebuilds that
// replaced caching.
// The plugin class cannot run in Node (imports `obsidian`), so this
// replicates the loop shapes using the real normalizeHotkey() and
// realistic command volumes.
// Run: npm run bench
import { normalizeHotkey, HotkeyBinding } from "../keys";

const PLUGIN_PREFIX = "emacs-text-editor:";
const N_APP_COMMANDS = 1000;
const N_PLUGIN_COMMANDS = 24;
const N_REPEATABLE = 8;

// A busy app: 1000 registered commands, ~24 of them this plugin's.
const appCommands: Record<string, unknown> = {};
for (let i = 0; i < N_APP_COMMANDS - N_PLUGIN_COMMANDS; i++) {
	appCommands[`some-plugin-${i}:command-${i}`] = {};
}
const pluginCommandNames = Array.from(
	{ length: N_PLUGIN_COMMANDS },
	(_, i) => `plugin-command-${i}`,
);
for (const name of pluginCommandNames) {
	appCommands[`${PLUGIN_PREFIX}${name}`] = {};
}

// One binding per command, as shipped.
const hotkeysFor = (id: string): HotkeyBinding[] => [
	{ modifiers: ["Alt"], key: "f" },
];

// Rescue-table rebuild (rescueCommands() shape): given a command-id
// list, normalize each binding into the map.
function buildRescueTable(commandIds: string[]): void {
	const result = new Map<string, string>();
	for (const commandId of commandIds) {
		for (const hotkey of hotkeysFor(commandId)) {
			const normalized = normalizeHotkey(hotkey);
			if (normalized) result.set(normalized, commandId);
		}
	}
}

// Pre-T6 hot-path shape: the id list comes from a full registry scan
// on every keystroke (this measured ~163-169µs and triggered the
// cached-id-list change).
const scanIds = (): string[] =>
	Object.keys(appCommands)
		.filter((id) => id.startsWith(PLUGIN_PREFIX))
		.map((id) => id.slice(PLUGIN_PREFIX.length));

// Post-T6 hot-path shape: the id list is cached; only the bindings
// loop runs per keystroke.
const cachedIds = scanIds();

// Repeat-table rebuild (buildRepeatableMoveHandlers() shape).
const repeatableCommands = pluginCommandNames.slice(0, N_REPEATABLE);
function buildRepeatTable(): void {
	const result = new Map<string, string>();
	for (const commandId of repeatableCommands) {
		for (const hotkey of hotkeysFor(commandId)) {
			const normalized = normalizeHotkey(hotkey);
			if (normalized) result.set(normalized, commandId);
		}
	}
}

function bench(name: string, fn: () => void): number {
	for (let i = 0; i < 100; i++) fn(); // warmup
	const samples: number[] = [];
	for (let i = 0; i < 1000; i++) {
		const t0 = performance.now();
		fn();
		samples.push(performance.now() - t0);
	}
	samples.sort((a, b) => a - b);
	const median = samples[samples.length >> 1] * 1000; // ms -> µs
	console.log(`${name}: median ${median.toFixed(1)}µs (of 1000 runs, after 100 warmup)`);
	return median;
}

// Reference: what the full scan costs (kept out of the hot path now).
bench("rescue-table rebuild, full registry scan (pre-T6 shape, reference)", () => buildRescueTable(scanIds()));
const rescue = bench("rescue-table rebuild, cached ids (hot path)", () => buildRescueTable(cachedIds));
const repeat = bench("repeat-table rebuild (8 commands)", buildRepeatTable);

if (rescue >= 100 || repeat >= 20) {
	console.log("\nABOVE THRESHOLD — caching upgrade path becomes a real task (see plan)");
	process.exitCode = 1;
} else {
	console.log("\nBELOW THRESHOLD — per-keystroke rebuild is negligible; no caching");
}
