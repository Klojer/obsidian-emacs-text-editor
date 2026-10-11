// Unit tests for the physical-key matching helpers in keys.ts.
//
// Run with: npm test
// (bundled by esbuild because Node cannot import TypeScript sources
// directly in every environment this repo is built from)
import * as assert from "assert";
import {
	IS_MAC,
	canonicalKeyFromEvent,
	eventKeyId,
	eventModifiers,
	keyId,
	literalKeyFromEvent,
	normalizeHotkey,
} from "../keys";

let passed = 0;
function check(name: string, fn: () => void) {
	fn();
	passed++;
	console.log(`ok - ${name}`);
}

// --- canonicalKeyFromEvent: macOS Option composition ---

check("Option+F on macOS arrives composed as ƒ; physical key is f", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "KeyF", key: "ƒ" }), "f");
});

check("Option+D composed as ∂ resolves to d", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "KeyD", key: "∂" }), "d");
});

check("Option+Shift+Comma composed as ≤ resolves to ,", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "Comma", key: "≤" }), ",");
});

check("Option+BracketLeft composed as “ resolves to [", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "BracketLeft", key: "“" }), "[");
});

check("plain unmodified letter passes through", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "KeyF", key: "f" }), "f");
});

check("spacebar delivers key ' ' but code Space normalizes to space", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "Space", key: " " }), "space");
});

check("backspace normalizes to backspace", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "Backspace", key: "Backspace" }), "backspace");
});

check("digits use the physical key: Shift+1 delivers '!' but canonical is 1", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "Digit1", key: "!" }), "1");
	assert.strictEqual(canonicalKeyFromEvent({ code: "Digit1", key: "1" }), "1");
});

check("numpad digits strip the Numpad prefix", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "Numpad3", key: "3" }), "3");
});

check("unknown codes fall back to event.key", () => {
	assert.strictEqual(canonicalKeyFromEvent({ code: "IntlBackslash", key: "§" }), "§");
	assert.strictEqual(canonicalKeyFromEvent({ code: "", key: "ƒ" }), "ƒ");
});

// --- modifier sets and key ids ---

check("modifiers come back sorted so ids always compare equal", () => {
	assert.deepStrictEqual(
		eventModifiers({ ctrlKey: true, altKey: true, shiftKey: false, metaKey: true }),
		["alt", "ctrl", "meta"],
	);
	assert.strictEqual(keyId(["ctrl", "alt"], "x"), "alt+ctrl+x");
});

check("composed mac chord builds canonical and literal ids that differ", () => {
	const e = { code: "KeyF", key: "ƒ", altKey: true };
	assert.strictEqual(eventKeyId(e, canonicalKeyFromEvent(e)), "alt+f");
	assert.strictEqual(eventKeyId(e, literalKeyFromEvent(e)), "alt+ƒ");
});

check("uncomposed chord builds identical canonical and literal ids", () => {
	const e = { code: "KeyF", key: "f", ctrlKey: true };
	assert.strictEqual(
		eventKeyId(e, canonicalKeyFromEvent(e)),
		eventKeyId(e, literalKeyFromEvent(e)),
	);
});

check("Ctrl+Space literal id uses ' ' while bindings normalize to space", () => {
	const e = { code: "Space", key: " ", ctrlKey: true };
	assert.strictEqual(eventKeyId(e, canonicalKeyFromEvent(e)), "ctrl+space");
	assert.strictEqual(eventKeyId(e, literalKeyFromEvent(e)), "ctrl+ ");
	assert.strictEqual(normalizeHotkey({ modifiers: ["Ctrl"], key: "Space" }), "ctrl+space");
});

// --- normalizeHotkey: binding side ---

check("Obsidian-style bindings normalize to the same id format as events", () => {
	assert.strictEqual(normalizeHotkey({ modifiers: ["Ctrl"], key: "f" }), "ctrl+f");
	assert.strictEqual(normalizeHotkey({ modifiers: ["Alt"], key: "Backspace" }), "alt+backspace");
	assert.strictEqual(normalizeHotkey({ modifiers: ["Alt", "Shift"], key: "," }), "alt+shift+,");
	assert.strictEqual(normalizeHotkey({ modifiers: ["Ctrl", "Shift"], key: "-" }), "ctrl+shift+-");
	assert.strictEqual(normalizeHotkey({ modifiers: ["Ctrl"], key: "/" }), "ctrl+/");
	assert.strictEqual(normalizeHotkey({ modifiers: ["Alt", "Shift"], key: "]" }), "alt+shift+]");
	assert.strictEqual(normalizeHotkey({ modifiers: ["Alt"], key: "u" }), "alt+u");
	assert.strictEqual(normalizeHotkey({ modifiers: ["Ctrl"], key: " " }), "ctrl+space");
	assert.strictEqual(normalizeHotkey({ modifiers: [], key: "" }), null);
});

check("Mod resolves per-platform (Ctrl off mac, Meta on mac)", () => {
	assert.strictEqual(normalizeHotkey({ modifiers: ["Mod"], key: "f" }), IS_MAC ? "meta+f" : "ctrl+f");
});

// --- rescue decision logic, simulated against a binding table ---

// Mirrors handleComposedKeyRescue: rescue only when the delivered key was
// composed away from the physical key AND the literal id is not itself a
// binding (which Obsidian's own hotkey dispatch would have run).
function shouldRescue(
	e: { code: string; key: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean },
	table: Map<string, string>,
): string | undefined {
	const canonicalId = eventKeyId(e, canonicalKeyFromEvent(e));
	const literalId = eventKeyId(e, literalKeyFromEvent(e));
	if (canonicalId === literalId || table.has(literalId)) {
		return undefined;
	}
	return table.get(canonicalId);
}

check("mac Option+F event is rescued to forward-word", () => {
	const table = new Map([
		["alt+f", "forward-word"],
		["alt+backspace", "backward-kill-word"],
		["ctrl+space", "set-mark-command"],
	]);
	assert.strictEqual(shouldRescue({ code: "KeyF", key: "ƒ", altKey: true }, table), "forward-word");
});

check("Option+Backspace is uncomposed, so it is left for Obsidian's dispatch", () => {
	const table = new Map([
		["alt+f", "forward-word"],
		["alt+backspace", "backward-kill-word"],
	]);
	assert.strictEqual(
		shouldRescue({ code: "Backspace", key: "Backspace", altKey: true }, table),
		undefined,
	);
});

check("Ctrl+F is uncomposed, so it is left for Obsidian's dispatch / key repeat", () => {
	const table = new Map([
		["ctrl+f", "forward-char"],
	]);
	assert.strictEqual(shouldRescue({ code: "KeyF", key: "f", ctrlKey: true }, table), undefined);
});

check("Ctrl+Space is rescued because ' ' never matches the 'space' binding", () => {
	const table = new Map([
		["ctrl+space", "set-mark-command"],
	]);
	assert.strictEqual(shouldRescue({ code: "Space", key: " ", ctrlKey: true }, table), "set-mark-command");
});

check("unbound composed chord (Option+J) is not rescued and no command runs", () => {
	const table = new Map([
		["alt+f", "forward-word"],
	]);
	assert.strictEqual(shouldRescue({ code: "KeyJ", key: "∆", altKey: true }, table), undefined);
});

check("a user rebind to the literal composed key is left for Obsidian's dispatch", () => {
	const table = new Map([
		["alt+d", "kill-word"],        // default binding
		["alt+∂", "forward-word"],     // user rebind recorded as the composed glyph
	]);
	assert.strictEqual(shouldRescue({ code: "KeyD", key: "∂", altKey: true }, table), undefined);
});

console.log(`\n${passed} tests passed`);
