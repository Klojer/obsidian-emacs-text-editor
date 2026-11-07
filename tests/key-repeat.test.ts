import * as assert from "assert";
import EmacsTextEditorPlugin from "../main";

const plugin: EmacsTextEditorPlugin = Object.create(EmacsTextEditorPlugin.prototype);
let movements = 0;
let timeouts = 0;
let intervals = 0;
let repeatCallback: (() => void) | undefined;
let intervalCallback: (() => void) | undefined;

plugin.settings = { enableKeyRepeat: true, keyRepeatDelay: 500, keyRepeatInterval: 50, macKeyRescueMode: "auto" };
plugin.isInActiveEditor = () => true;
plugin.getKeyId = () => "ctrl+f";
plugin.getKeyMoveFunc = () => () => { movements++; };
Object.assign(plugin, { currentRepeatTimeouts: new Map() });
Object.assign(globalThis, {
	window: {
		setTimeout(callback: () => void) {
			timeouts++;
			repeatCallback = callback;
			return 1;
		},
		setInterval(callback: () => void) {
			intervals++;
			intervalCallback = callback;
			return 2;
		},
	},
});

function event(defaultPrevented: boolean): KeyboardEvent {
	return {
		defaultPrevented,
		preventDefault() { this.defaultPrevented = true; },
		stopPropagation() {},
	} as KeyboardEvent;
}

const consumed = event(true);
plugin.handleKeyRepeat(consumed);
assert.strictEqual(movements, 0, "a consumed key must not move the editor cursor");
assert.strictEqual(timeouts, 0, "a consumed key must not start a repeat timer");

const normal = event(false);
plugin.handleKeyRepeat(normal);
assert.strictEqual(movements, 1, "an unconsumed key should move the cursor once");
assert.strictEqual(timeouts, 1, "an unconsumed key should start a repeat timer");
assert.strictEqual(normal.defaultPrevented, true);
assert.ok(repeatCallback);
repeatCallback();
assert.strictEqual(intervals, 1, "the repeat interval should still start");
assert.ok(intervalCallback);
intervalCallback();
assert.strictEqual(movements, 2, "held keys should continue to repeat");

console.log("key-repeat tests passed");
