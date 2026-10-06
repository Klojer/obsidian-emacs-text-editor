// Physical-key matching helpers.
//
// macOS composes Option (Alt) + key into special characters (Alt+F -> "ƒ",
// Alt+D -> "∂") before JavaScript sees the event, so KeyboardEvent.key never
// equals the letter a hotkey was registered with. Matching on the physical
// key code (KeyboardEvent.code, e.g. "KeyF") is immune to that composition
// and to the keyboard layout, and is what makes Emacs meta chords work on
// macOS.

export const IS_MAC =
	typeof navigator !== "undefined" &&
	/Mac|iPod|iPhone|iPad/.test(navigator.platform);

export interface HotkeyBinding {
	modifiers: string[];
	key: string;
}

export interface KeyEventLike {
	code?: string;
	key?: string;
	ctrlKey?: boolean;
	altKey?: boolean;
	shiftKey?: boolean;
	metaKey?: boolean;
}

// event.code -> canonical lowercase key name for keys whose code is not
// derived from a printable character. Values match how Obsidian names keys
// in hotkey bindings ("Space", "Backspace", ...), lowercased.
const CODE_TO_CANONICAL_KEY: Record<string, string> = {
	Space: "space",
	Backspace: "backspace",
	Tab: "tab",
	Enter: "enter",
	Escape: "escape",
	Delete: "delete",
	Insert: "insert",
	Home: "home",
	End: "end",
	PageUp: "pageup",
	PageDown: "pagedown",
	ArrowLeft: "arrowleft",
	ArrowUp: "arrowup",
	ArrowRight: "arrowright",
	ArrowDown: "arrowdown",
	Comma: ",",
	Period: ".",
	Slash: "/",
	Semicolon: ";",
	Quote: "'",
	BracketLeft: "[",
	BracketRight: "]",
	Backslash: "\\",
	Backquote: "`",
	Minus: "-",
	Equal: "=",
};

// Canonical name of the physical key an event was produced by, independent
// of OS composition and layout: "KeyF" -> "f", "Digit1" -> "1",
// "Comma" -> ",", "Space" -> "space". Falls back to event.key for keys
// without a well-known code (e.g. international layout keys).
export function canonicalKeyFromEvent(e: KeyEventLike): string {
	const code = e.code ?? "";
	if (/^Key[A-Z]$/u.test(code)) {
		return code.slice(3).toLowerCase();
	}
	if (/^Digit[0-9]$/u.test(code)) {
		return code.slice(5);
	}
	if (/^Numpad[0-9]$/u.test(code)) {
		return code.slice(6);
	}
	return CODE_TO_CANONICAL_KEY[code] ?? (e.key ?? "").toLowerCase();
}

// What the OS actually delivered: the (possibly composed) event.key.
export function literalKeyFromEvent(e: KeyEventLike): string {
	return (e.key ?? "").toLowerCase();
}

// Modifier names in the canonical ordering used by key ids everywhere in
// this plugin: alphabetical, so ["alt", "ctrl", "meta", "shift"].
export function eventModifiers(e: KeyEventLike): string[] {
	const modifiers: string[] = [];
	if (e.ctrlKey) modifiers.push("ctrl");
	if (e.altKey) modifiers.push("alt");
	if (e.shiftKey) modifiers.push("shift");
	if (e.metaKey) modifiers.push("meta");
	return modifiers.sort();
}

export function keyId(modifiers: string[], key: string): string {
	return [...modifiers.slice().sort(), key].join("+");
}

export function eventKeyId(e: KeyEventLike, key: string): string {
	return keyId(eventModifiers(e), key);
}

// Normalize an Obsidian hotkey binding into the same id format used for
// events. "Mod" resolves to Meta on macOS and Ctrl elsewhere, matching
// Obsidian's own convention. A literal space character is normalized to
// "space" so bindings like {Ctrl, Space} match code-based lookups.
export function normalizeHotkey(hotkey: HotkeyBinding): string | null {
	const key = hotkey.key?.toLowerCase();
	if (!key) {
		return null;
	}
	const resolvedModifiers = hotkey.modifiers.map((m) =>
		m === "Mod" ? (IS_MAC ? "meta" : "ctrl") : m.toLowerCase(),
	);
	return keyId(resolvedModifiers, key === " " ? "space" : key);
}
