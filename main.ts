import { Editor, EditorPosition, Plugin, MarkdownView, PluginSettingTab, Setting, App } from "obsidian";
import { EditorView } from "@codemirror/view";
import { EditorSelection, Transaction } from "@codemirror/state";

// Regex constants for consistent pattern matching
const WORD_CHAR_REGEX = /[\p{L}\p{N}_]/u;
const KEY_CODE_KEY_REGEX = /^Key[A-Z]$/u;
const KEY_CODE_DIGIT_REGEX = /^Digit[0-9]$/u;
const KEY_CODE_NUMPAD_REGEX = /^Numpad[0-9]$/u;
const WORD_BOUNDARY_REGEX = /\b/gu;

interface EmacsKeyRepeatSettings {
	enableKeyRepeat: boolean;
	keyRepeatDelay: number;
	keyRepeatInterval: number;
	beginningOfLineLikeObsidian: boolean;
}

const DEFAULT_SETTINGS: EmacsKeyRepeatSettings = {
	enableKeyRepeat: true,
	keyRepeatDelay: 500, // Initial delay before repeat starts (ms)
	keyRepeatInterval: 50, // Interval between repeats (ms)
	beginningOfLineLikeObsidian: false,
};

const DEFAULT_REPEATABLE_HOTKEYS: Record<string, { modifiers: string[]; key: string }[]> = {
	'forward-char': [{ modifiers: ['ctrl'], key: 'f' }],
	'backward-char': [{ modifiers: ['ctrl'], key: 'b' }],
	'next-line': [{ modifiers: ['ctrl'], key: 'n' }],
	'previous-line': [{ modifiers: ['ctrl'], key: 'p' }],
	'delete-char': [{ modifiers: ['ctrl'], key: 'd' }],
	'forward-word': [{ modifiers: ['alt'], key: 'f' }],
	'backward-word': [{ modifiers: ['alt'], key: 'b' }],
	'kill-word': [{ modifiers: ['alt'], key: 'd' }],
};

enum Direction {
	Forward,
	Backward,
}

enum CopyCut {
	Copy,
	Cut,
}

const insertableSpecialKeys = [
	"Comma",
	"Period",
	"Slash",
	"Semicolon",
	"Quote",
	"BracketLeft",
	"BracketRight",
	"Backslash",
	"Backquote",
	"Minus",
	"Equal",
];

export default class EmacsTextEditorPlugin extends Plugin {
	settings: EmacsKeyRepeatSettings;
	private markPosition: EditorPosition | undefined;
	disableSelectionWhenPossible = false;

	private currentRepeatTimeouts: Map<string, { timeoutId: number; intervalId?: number }> = new Map();
	private repeatableMoveHandlers: Map<string, (editor: Editor) => void> | null = null;

	// async so can wait for settings before full init
	async onload() {
		console.log("loading plugin: Emacs text editor");

		await this.loadSettings();
		this.addSettingTab(new EmacsKeyRepeatSettingTab(this.app, this));

		// DOM so timer events + residual listeners cleared if unload plugin
		this.registerDomEvent(document, "keydown", (e) => {
			if (isEventInterruptSelection(e)) {
				this.disableSelectionWhenPossible = true;
				this.markPosition = undefined;
			}

			if (this.settings.enableKeyRepeat) {
				this.handleKeyRepeat(e);
			}
		});

		// Things that stop repeat

		// stop holding a key down
		this.registerDomEvent(document, "keyup", () => {
			this.stopAllKeyRepeats();
		});

		// change window focus
		this.registerDomEvent(window, "blur", () => {
			this.stopAllKeyRepeats();
		});

		// defocus current editor
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			this.stopAllKeyRepeats();
		}));

		// Mouse click cancels mark mode (same as keyboard-quit)
		this.registerDomEvent(document, "mousedown", () => {
			this.markPosition = undefined;
			this.disableSelectionWhenPossible = false;
		});

		this.addCommand({
			id: "forward-char",
			name: "Forward char",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'f' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.moveForwardOneChar(editor);
			},
		});

		this.addCommand({
			id: "backward-char",
			name: "Backward char",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'b' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.moveBackOneChar(editor);
			},
		});

		this.addCommand({
			id: "next-line",
			name: "Next line",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'n' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.moveNextLine(editor);
			},
		});

		this.addCommand({
			id: "previous-line",
			name: "Previous line",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'p' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.movePreviousLine(editor);
			},
		});

		this.addCommand({
			id: "forward-word",
			name: "Forward word",
			hotkeys: [{ modifiers: ['Alt'], key: 'f' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.moveForwardOneWord(editor);
			},
		});

		this.addCommand({
			id: "backward-word",
			name: "Backward word",
			hotkeys: [{ modifiers: ['Alt'], key: 'b' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.moveBackOneWord(editor);
			},
		});

		this.addCommand({
			id: "move-end-of-line",
			name: "Move end of line",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'e' }],
			editorCallback: (editor: Editor, markdownView: MarkdownView) => {
				const view = this.getCodeMirrorView(markdownView);
				if (view) {
					this.moveToLineBoundary(editor, view, true);
				} else {
					this.withSelectionUpdateDirect(editor,
						(head) => ({ line: head.line, ch: editor.getLine(head.line).length }),
					);
				}
			},
		});

		this.addCommand({
			id: "move-beginning-of-line",
			name: "Move cursor to beginning of line",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'a' }],
			editorCallback: (editor: Editor, markdownView: MarkdownView) => {
				if (this.settings.beginningOfLineLikeObsidian) {
					this.withSelectionUpdateDirect(editor, (head) => {
						const lineText = editor.getLine(head.line);
						const homeCol = getObsidianHomeColumn(lineText);
						const targetCh = head.ch === homeCol ? 0 : homeCol;
						return { line: head.line, ch: targetCh };
					});
					return;
				}
				const view = this.getCodeMirrorView(markdownView);
				if (view) {
					this.moveToLineBoundary(editor, view, false);
				} else {
					this.withSelectionUpdateDirect(editor,
						(head) => ({ line: head.line, ch: 0 }),
					);
				}
			},
		});

		this.addCommand({
			id: "beginning-of-buffer",
			name: "Beginning of buffer",
			hotkeys: [{ modifiers: ['Alt', 'Shift'], key: ',' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdateDirect(editor,
					() => ({ line: 0, ch: 0 }),
				);
			},
		});

		this.addCommand({
			id: "end-of-buffer",
			name: "End of buffer",
			hotkeys: [{ modifiers: ['Alt', 'Shift'], key: '.' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdateDirect(editor,
					() => {
						const lastLine = editor.lineCount() - 1;
						return { line: lastLine, ch: editor.getLine(lastLine).length };
					},
				);
			},
		});

		this.addCommand({
			id: "kill-line",
			name: "Kill line",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'k' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor);

				const cursor = editor.getCursor();
				const lineContent = editor.getLine(cursor.line);
				if (lineContent === "") {
					editor.exec("deleteLine");
				} else {
					editor.setSelection(cursor, {
						line: cursor.line,
						ch: lineContent.length,
					});
					this.putSelectionInClipboard(editor, CopyCut.Cut);
					editor.setCursor(cursor);
				}
			},
		});

		this.addCommand({
			id: "delete-char",
			name: "Delete char",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'd' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.deleteOneChar(editor);
			},
		});

		this.addCommand({
			id: "kill-word",
			name: "Kill word",
			hotkeys: [{ modifiers: ['Alt'], key: 'd' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.killOneWord(editor);

			},
		});

		this.addCommand({
			id: "backward-kill-word",
			name: "Backward kill word",
			hotkeys: [{ modifiers: ['Alt'], key: 'Backspace' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withDeleteInText(editor, () => {
					editor.exec("goWordLeft");
				});
			},
		});

		this.addCommand({
			id: "kill-ring-save",
			name: "Kill ring save",
			hotkeys: [{ modifiers: ['Alt'], key: 'w' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.putSelectionInClipboard(editor, CopyCut.Copy);
			},
		});

		this.addCommand({
			id: "kill-region",
			name: "Kill region",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'w' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.putSelectionInClipboard(editor, CopyCut.Cut);
			},
		});

		this.addCommand({
			id: "yank",
			name: "Yank",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'y' }],
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				const clipboardContent = await navigator.clipboard.readText();
				const cursor = editor.getCursor();

				if (!this.getCurrentSelectionStart(editor)) {
					editor.replaceRange(clipboardContent, cursor);
				} else {
					editor.replaceSelection(clipboardContent);
					this.disableSelection(editor);
				}

				editor.setCursor(
					cursor.line,
					cursor.ch + clipboardContent.length,
				);
				document.dispatchEvent(new ClipboardEvent("paste"));
			},
		});

		this.addCommand({
			id: "set-mark-command",
			name: "Set mark command",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'Space' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				if (this.markPosition) {
					this.disableSelection(editor);
				} else {
					this.markPosition = editor.getCursor();
				}
				this.disableSelectionWhenPossible = false;
			},
		});

		this.addCommand({
			id: "mark-whole-buffer",
			name: "Mark whole buffer",
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const lastLine = editor.lineCount() - 1;
				const bufferStart = { line: 0, ch: 0 };
				const bufferEnd = { line: lastLine, ch: editor.getLine(lastLine).length };

				this.markPosition = bufferStart;
				this.disableSelectionWhenPossible = false;
				editor.setSelection(bufferStart, bufferEnd);
			},
		});

		this.addCommand({
			id: "keyboard-quit",
			name: "Keyboard-quit",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'g' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor);
			},
		});

		this.addCommand({
			id: "undo",
			name: "Undo",
			hotkeys: [{ modifiers: ['Ctrl'], key: '/' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				editor.undo();
			},
		});

		this.addCommand({
			id: "redo",
			name: "Redo",
			hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: '-' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				editor.redo();
			},
		});

		this.addCommand({
			id: "recenter-top-bottom",
			name: "Recenter",
			hotkeys: [{ modifiers: ['Ctrl'], key: 'l' }],
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const cursor = editor.getCursor();
				const range = {
					from: { line: cursor.line, ch: cursor.ch },
					to: { line: cursor.line, ch: cursor.ch },
				};
				editor.scrollIntoView(range, true);
			},
		});

		this.addCommand({
			id: "forward-paragraph",
			name: "Forward paragraph",
			hotkeys: [{ modifiers: ['Alt', 'Shift'], key: ']' }],
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					this.moveToNextParagraph(editor, Direction.Forward);
				});
			},
		});

		this.addCommand({
			id: "backward-paragraph",
			name: "Backward paragraph",
			hotkeys: [{ modifiers: ['Alt', 'Shift'], key: '[' }],
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					this.moveToNextParagraph(editor, Direction.Backward);
				});
			},
		});

		this.addCommand({
			id: 'upcase-word',
			name: 'Upcase word',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.transformWordAtCursor(editor, word => word.toUpperCase());
			}
		});

		this.addCommand({
			id: 'downcase-word',
			name: 'Downcase word',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.transformWordAtCursor(editor, word => word.toLowerCase());
			}
		});

		this.addCommand({
			id: 'capitalize-word',
			name: 'Capitalize word',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.transformWordAtCursor(editor, capitalizeOneWord);
			}
		});

		this.addCommand({
			id: 'upcase-region',
			name: 'Upcase region',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					this.transformSelection(editor, word => word.toUpperCase());
				});
			}
		});

		this.addCommand({
			id: 'downcase-region',
			name: 'Downcase region',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					this.transformSelection(editor, word => word.toLowerCase());
				});
			}
		});

		this.addCommand({
			id: 'capitalize-region',
			name: 'Capitalize region',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					this.transformSelection(editor, capitalizeWords);
				});
			}
		});

		this.addCommand({
			id: 'upcase-dwim',
			name: 'Upcase dwim',
			hotkeys: [{ modifiers: ['Alt'], key: 'u' }],
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.transformDWIM(editor, word => word.toUpperCase());
			}
		});

		this.addCommand({
			id: 'downcase-dwim',
			name: 'Downcase dwim',
			hotkeys: [{ modifiers: ['Alt'], key: 'l' }],
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.transformDWIM(editor, word => word.toLowerCase());
			}
		});

		this.addCommand({
			id: 'capitalize-dwim',
			name: 'Capitalize dwim',
			hotkeys: [{ modifiers: ['Alt'], key: 'c' }],
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.transformDWIM(editor, capitalizeOneWord, capitalizeWords);
			}
		});

		this.addCommand({
			id: "transpose-chars",
			name: "Transpose chars",
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.transposeChars(editor);
			},
		});
	}

	onunload() {
		console.log("unloading plugin: Emacs text editor");
		this.stopAllKeyRepeats();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.settings.keyRepeatDelay = Math.max(25, Math.min(2000, this.settings.keyRepeatDelay));
		this.settings.keyRepeatInterval = Math.max(10, Math.min(1000, this.settings.keyRepeatInterval));
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getCodeMirrorView(markdownView: MarkdownView): EditorView | undefined {
		return (markdownView as MarkdownView & { editor?: { cm?: EditorView } }).editor?.cm;
	}

	moveToLineBoundary(editor: Editor, view: EditorView, forward: boolean) {
		const eventName = forward ? "emacs.moveToEnd" : "emacs.moveToBeginning";
		const selection = view.state.selection.main;
		const headCursor = EditorSelection.cursor(selection.head, selection.assoc);
		const newRange = view.moveToLineBoundary(headCursor, forward);

		if (this.disableSelectionWhenPossible) {
			this.disableSelection(editor);
		}

		const currentSelectionStart = this.getCurrentSelectionStart(editor);
		let newSelection;

		if (currentSelectionStart) {
			const anchorOffset = editor.posToOffset(currentSelectionStart);
			newSelection = EditorSelection.create([
				EditorSelection.range(anchorOffset, newRange.head, newRange.assoc)
			]);
		} else {
			newSelection = EditorSelection.create([
				EditorSelection.cursor(newRange.head, newRange.assoc)
			]);
		}

		view.dispatch({
			selection: newSelection,
			scrollIntoView: true,
			annotations: Transaction.userEvent.of(eventName),
		});
	}

	handleKeyRepeat(keyEvent: KeyboardEvent) {
		if (!this.isInActiveEditor()) {
			return;
		}

		const keyId = this.getKeyId(keyEvent);
		const keyMoveFunc = this.getKeyMoveFunc(keyEvent);

		if (keyMoveFunc) {
			keyEvent.preventDefault();
			keyEvent.stopPropagation();

			if (this.currentRepeatTimeouts.has(keyId)) {
				return;
			}

			try {
				keyMoveFunc();  // 1st key movement
			} catch (error) {
				console.error('Key move function error:', error);
				return;
			}

			// Following delay after 1st key movement, do repeated key movements at intervals
			const timeoutId = window.setTimeout(() => {
				const intervalId = window.setInterval(() => {
					if (this.isInActiveEditor() && this.currentRepeatTimeouts.has(keyId)) {
						// Still in editor and still repeating
						try {
							keyMoveFunc();
						} catch (error) {
							console.error('Key repeat interval error:', error);
							this.stopKeyRepeat(keyId);
						}
					} else {
						this.stopKeyRepeat(keyId);
					}
				}, this.settings.keyRepeatInterval);

				const repeatState = this.currentRepeatTimeouts.get(keyId);
				if (repeatState) {
					repeatState.intervalId = intervalId;
				}
			}, this.settings.keyRepeatDelay);

			this.currentRepeatTimeouts.set(keyId, { timeoutId });
		}
	}

	isInActiveEditor(): boolean {
		const markdownView = this.app.workspace.getActiveViewOfType?.(MarkdownView);
		return !!(markdownView && markdownView.editor);
	}

	getKeyId(e: KeyboardEvent): string {
		const modifiers = [];
		if (e.ctrlKey) modifiers.push('ctrl');
		if (e.altKey) modifiers.push('alt');
		if (e.shiftKey) modifiers.push('shift');
		if (e.metaKey) modifiers.push('meta');
		return [...modifiers, e.key.toLowerCase()].join('+');
	}

	getKeyMoveFunc(e: KeyboardEvent): (() => void) | null {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) return null;

		this.buildRepeatableMoveHandlers();
		const keyId = this.getKeyId(e);
		const handler = this.repeatableMoveHandlers?.get(keyId);
		if (!handler) return null;

		const editor = activeView.editor;
		return () => handler(editor);
	}

	buildRepeatableMoveHandlers() {
		if (this.repeatableMoveHandlers) {
			return;
		}

		const handlerByCommand: Record<string, (editor: Editor) => void> = {
			'forward-char': (ed) => this.moveForwardOneChar(ed),
			'backward-char': (ed) => this.moveBackOneChar(ed),
			'next-line': (ed) => this.moveNextLine(ed),
			'previous-line': (ed) => this.movePreviousLine(ed),
			'delete-char': (ed) => this.deleteOneChar(ed),
			'forward-word': (ed) => this.moveForwardOneWord(ed),
			'backward-word': (ed) => this.moveBackOneWord(ed),
			'kill-word': (ed) => this.killOneWord(ed),
		};

		const result = new Map<string, (editor: Editor) => void>();
		const prefix = `${this.manifest.id}:`;
		const hotkeyManager = (this.app as App & { hotkeyManager?: { getHotkeys(id: string): { modifiers: string[]; key: string }[] | null } }).hotkeyManager;

		for (const [commandId, handler] of Object.entries(handlerByCommand)) {
			const hotkeys = hotkeyManager?.getHotkeys(`${prefix}${commandId}`);
			const effectiveHotkeys = hotkeys ?? DEFAULT_REPEATABLE_HOTKEYS[commandId];
			if (!effectiveHotkeys) continue;
			for (const hotkey of effectiveHotkeys) {
				const normalized = this.normalizeHotkey(hotkey);
				if (normalized) {
					result.set(normalized, handler);
				}
			}
		}

		this.repeatableMoveHandlers = result;
	}

	normalizeHotkey(hotkey: { modifiers: string[]; key: string }): string | null {
		const key = hotkey.key?.toLowerCase();
		if (!key) return null;

		// Resolve platform-specific "Mod" modifier to Ctrl (non-mac) or Meta (mac).
		const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
		const resolvedModifiers = hotkey.modifiers.map((m) => {
			if (m === 'Mod') return isMac ? 'meta' : 'ctrl';
			return m.toLowerCase();
		});

		return [...resolvedModifiers.sort(), key].join('+');
	}

	stopKeyRepeat(keyId: string) {
		const timeout = this.currentRepeatTimeouts.get(keyId);
		if (timeout) {
			if (timeout.timeoutId) {
				clearTimeout(timeout.timeoutId);
			}
			if (timeout.intervalId) {
				clearInterval(timeout.intervalId);
			}
			this.currentRepeatTimeouts.delete(keyId);
		}
	}

	stopAllKeyRepeats() {
		this.currentRepeatTimeouts.forEach(({ timeoutId, intervalId }) => {
			if (timeoutId) clearTimeout(timeoutId);
			if (intervalId) clearInterval(intervalId);
		});
		this.currentRepeatTimeouts.clear();
	}

	moveForwardOneChar(editor: Editor) {
		this.withSelectionUpdateDirect(editor, (head) => {
			const offset = editor.posToOffset(head);
			const maxOffset = editor.getValue().length;
			return offset < maxOffset ? editor.offsetToPos(offset + 1) : head;
		});
	}

	deleteOneChar(editor: Editor) {
	  this.withDeleteInText(editor, () => {
		editor.exec("goRight");
	  }, false);
	}

	killOneWord(editor: Editor) {
		this.withDeleteInText(editor, () => {
			editor.exec("goWordRight");
		});
	}

	moveBackOneChar(editor: Editor) {
		this.withSelectionUpdateDirect(editor, (head) => {
			const offset = editor.posToOffset(head);
			return offset > 0 ? editor.offsetToPos(offset - 1) : head;
		});
	}

	moveNextLine(editor: Editor) {
		this.withSelectionUpdate(editor, () => {
			editor.exec("goDown"); // visual screen lines down, not string
		});
	}

	movePreviousLine(editor: Editor) {
		this.withSelectionUpdate(editor, () => {
			editor.exec("goUp");  // visual screen lines up, not string
		});
	}

	moveForwardOneWord(editor: Editor) {
		this.withSelectionUpdateDirect(editor, (head) => {
			const doc = editor.getValue();
			let offset = editor.posToOffset(head);
			const len = doc.length;
			// Skip non-word characters, then skip word characters
			while (offset < len && !WORD_CHAR_REGEX.test(doc[offset])) offset++;
			while (offset < len && WORD_CHAR_REGEX.test(doc[offset])) offset++;
			return editor.offsetToPos(offset);
		});
	}

	moveBackOneWord(editor: Editor) {
		this.withSelectionUpdateDirect(editor, (head) => {
			const doc = editor.getValue();
			let offset = editor.posToOffset(head);
			// Skip non-word characters backwards, then skip word characters backwards
			while (offset > 0 && !WORD_CHAR_REGEX.test(doc[offset - 1])) offset--;
			while (offset > 0 && WORD_CHAR_REGEX.test(doc[offset - 1])) offset--;
			return editor.offsetToPos(offset);
		});
	}

	disableSelection(editor: Editor) {
		editor.setSelection(editor.getCursor(), editor.getCursor());
		this.markPosition = undefined;
		this.disableSelectionWhenPossible = false;
	}

	withSelectionUpdate(
		editor: Editor,
		callback: () => void,
		directMove?: (head: EditorPosition) => EditorPosition,
	) {
		if (this.disableSelectionWhenPossible) {
			this.disableSelection(editor);
		}

		const currentSelectionStart = this.getCurrentSelectionStart(editor);

		if (currentSelectionStart && directMove) {
			// Direct computation: set selection in a single call to avoid
			// intermediate collapse that causes live preview link re-rendering glitches
			const newHead = directMove(editor.getCursor());
			editor.setSelection(currentSelectionStart, newHead);
		} else if (currentSelectionStart) {
			// Fallback: collapse, move via callback, re-expand
			editor.setSelection(editor.getCursor());
			callback();
			editor.setSelection(currentSelectionStart, editor.getCursor());
		} else {
			callback();
		}
	}

	withSelectionUpdateDirect(
		editor: Editor,
		directMove: (head: EditorPosition) => EditorPosition,
	) {
		if (this.disableSelectionWhenPossible) {
			this.disableSelection(editor);
		}

		const currentSelectionStart = this.getCurrentSelectionStart(editor);
		const newHead = directMove(editor.getCursor());

		if (currentSelectionStart) {
			editor.setSelection(currentSelectionStart, newHead);
		} else {
			editor.setCursor(newHead);
		}
	}

	getCurrentSelectionStart(editor: Editor): EditorPosition | undefined {
		// If mark was explicitly set, always use the stored position.
		// This prevents the mark from being lost when the editor
		// internally collapses the selection during rapid key repeat.
		if (this.markPosition) {
			return this.markPosition;
		}

		// Otherwise, check for existing selection (from mouse or shift+arrows)
		const selections = editor.listSelections();

		if (selections.length == 0) {
			return undefined;
		}

		if (
			selections[0].anchor.line !== selections[0].head.line ||
			selections[0].anchor.ch !== selections[0].head.ch
		) {
			return selections[0].anchor;
		}

		return undefined;
	}


	withDeleteInText(editor: Editor, callback: () => void,
		putIntoClipboard: boolean = true) {
		
		const cursorBefore = editor.getCursor();

		callback();

		const cursorAfter = editor.getCursor();

		editor.setSelection(cursorBefore, cursorAfter);

		if (putIntoClipboard) {
			this.putSelectionInClipboard(editor, CopyCut.Cut);
		} else {
			editor.replaceSelection("");
		}
	}

	putSelectionInClipboard(editor: Editor, mode: CopyCut) {
		if (!this.getCurrentSelectionStart(editor)) {
			return;
		}

		navigator.clipboard.writeText(editor.getSelection());

		if (mode == CopyCut.Copy) {
			document.dispatchEvent(new ClipboardEvent("copy"));
		} else if (mode == CopyCut.Cut) {
			editor.replaceSelection("");
			document.dispatchEvent(new ClipboardEvent("cut"));
		}

		this.disableSelection(editor);
	}

	moveToNextParagraph(editor: Editor, direction: Direction) {
		const cursor = editor.getCursor();
		const value = editor.getValue();
		const maxOffset = value.length;
		const currentOffset = editor.posToOffset(cursor);

		if (
			(direction === Direction.Forward && currentOffset >= maxOffset) ||
			(direction === Direction.Backward && currentOffset === 0)
		) {
			return;
		}

		let nextParagraphOffset =
			direction === Direction.Forward ? maxOffset : 0;
		let foundText = false;
		let foundFirstBreak = false;

		function isNewLine(position: number, direction: Direction): boolean {
			if (direction === Direction.Forward) {
				return (
					value[position] === "\n" ||
					(value[position] === "\r" && value[position + 1] === "\n")
				);
			} else {
				return (
					value[position] === "\n" ||
					(position > 0 &&
						value[position - 1] === "\r" &&
						value[position] === "\n")
				);
			}
		}

		const step = direction === Direction.Forward ? 1 : -1;
		let i = currentOffset;

		while (
			(direction === Direction.Forward && i < maxOffset) ||
			(direction === Direction.Backward && i > 0)
		) {
			if (foundText && isNewLine(i, direction)) {
				if (foundFirstBreak) {
					nextParagraphOffset =
						direction === Direction.Forward ? i : i + 1;
					if (
						(direction === Direction.Forward &&
							value[i] === "\r") ||
						(direction === Direction.Backward &&
							i > 0 &&
							value[i - 1] === "\r")
					) {
						nextParagraphOffset +=
							direction === Direction.Forward ? 1 : -1;
					}
					break;
				} else {
					foundFirstBreak = true;
					i += step;
					continue;
				}
			} else {
				foundFirstBreak = false;
			}

			if (value[i] !== "\n" && value[i] !== "\r" && value[i] !== " ") {
				foundText = true;
			}

			i += step;
		}

		const newPos = editor.offsetToPos(nextParagraphOffset);
		editor.setCursor(newPos);
	}

	transformWordAtCursor(
		editor: Editor,
		transform: (word: string) => string
	) {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		let ch = cursor.ch;

		// Find word boundaries
		while (ch < line.length && !WORD_CHAR_REGEX.test(line[ch])) {
			ch++;
		}
		const start = ch;
		while (ch < line.length && WORD_CHAR_REGEX.test(line[ch])) {
			ch++;
		}
		const end = ch;

		const word = line.substring(start, end);
		const newWord = transform(word);
		const range = {
			from: { line: cursor.line, ch: start },
			to: { line: cursor.line, ch: end }
		};
		editor.replaceRange(newWord, range.from, range.to);
		editor.setCursor(cursor.line, end);
	}

	transformSelection(
		editor: Editor,
		transform: (word: string) => string
	) {
		const selection = editor.getSelection();
		if (!selection) {
			return;
		}

		const transformedSelection = transform(selection);
		editor.replaceSelection(transformedSelection);
		this.disableSelection(editor);
	}

	transformDWIM(
		editor: Editor,
		transformOneWord: (word: string) => string,
		transformWords?: (text: string) => string
	) {
		if (editor.getSelection()) {
			this.transformSelection(editor, transformWords ? transformWords : transformOneWord);
		} else {
			this.transformWordAtCursor(editor, transformOneWord);
		}
	}

	transposeChars(editor: Editor) {
		this.disableSelection(editor);

		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);

		if (line.length < 2 || cursor.ch === 0) {
			return;
		}

		const swapRightIndex = cursor.ch < line.length ? cursor.ch : line.length - 1;
		const swapLeftIndex = swapRightIndex - 1;

		const transposedLine =
			line.slice(0, swapLeftIndex) +
			line[swapRightIndex] +
			line[swapLeftIndex] +
			line.slice(swapRightIndex + 1);

		editor.replaceRange(
			transposedLine,
			{ line: cursor.line, ch: 0 },
			{ line: cursor.line, ch: line.length },
		);

		editor.setCursor({
			line: cursor.line,
			ch: Math.min(swapRightIndex + 1, transposedLine.length),
		});
	}
}

class EmacsKeyRepeatSettingTab extends PluginSettingTab {
	plugin: EmacsTextEditorPlugin;

	constructor(app: App, plugin: EmacsTextEditorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Emacs Key Repeat Settings' });

		new Setting(containerEl)
			.setName('Enable key repeat')
			.setDesc('Allow cursor movement keys to repeat when held down')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableKeyRepeat)
				.onChange(async (value) => {
					this.plugin.settings.enableKeyRepeat = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Beginning of line like Obsidian HOME')
			.setDesc('Make Ctrl-A (move-beginning-of-line) toggle between column 0 and the first text character, matching Obsidian\'s HOME key. Skips indentation, list markers, checkboxes, heading markers, and blockquote markers.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.beginningOfLineLikeObsidian)
				.onChange(async (value) => {
					this.plugin.settings.beginningOfLineLikeObsidian = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Initial delay')
			.setDesc(`Time before key repeat starts (25-1000ms). Current: ${this.plugin.settings.keyRepeatDelay}ms`)
			.addSlider(slider => slider
				.setLimits(25, 1000, 50)
				.setValue(this.plugin.settings.keyRepeatDelay)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.keyRepeatDelay = value;
					await this.plugin.saveSettings();
					// Update description
					slider.sliderEl.parentElement?.parentElement
						?.querySelector('.setting-item-description')
						?.setText(`Time before key repeat starts (0-1000ms). Current: ${value}ms`);
				})
			);

		new Setting(containerEl)
			.setName('Repeat interval')
			.setDesc(`Time between repeats (10-1000ms). Current: ${this.plugin.settings.keyRepeatInterval}ms`)
			.addSlider(slider => slider
				.setLimits(10, 1000, 5)
				.setValue(this.plugin.settings.keyRepeatInterval)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.keyRepeatInterval = value;
					await this.plugin.saveSettings();
					// Update description 
					slider.sliderEl.parentElement?.parentElement
						?.querySelector('.setting-item-description')
						?.setText(`Time between repeats (10-1000ms). Current: ${value}ms`);
				})
			);

		containerEl.createEl('h3', { text: 'Quick Presets' });
		const presetContainer = containerEl.createEl('div', { cls: 'setting-item' });
		const buttonContainer = presetContainer.createEl('div', { cls: 'setting-item-control' });

		buttonContainer.createEl('button', { text: 'Slow' })
			.addEventListener('click', async () => {
				this.plugin.settings.keyRepeatDelay = 750;
				this.plugin.settings.keyRepeatInterval = 100;
				await this.plugin.saveSettings();
				this.display();
			});

		buttonContainer.createEl('button', { text: 'Medium' })
			.addEventListener('click', async () => {
				this.plugin.settings.keyRepeatDelay = 500;
				this.plugin.settings.keyRepeatInterval = 50;
				await this.plugin.saveSettings();
				this.display();
			});

		buttonContainer.createEl('button', { text: 'Fast' })
			.addEventListener('click', async () => {
		  this.plugin.settings.keyRepeatDelay = 25;
				this.plugin.settings.keyRepeatInterval = 25;
				await this.plugin.saveSettings();
				this.display();
			});
	}
}

function getObsidianHomeColumn(lineText: string): number {
	const match = lineText.match(/^(\s*(?:(?:(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)|(?:#+|>+)\s+)*)/);
	return match ? match[0].length : 0;
}

function isEventInterruptSelection(e: KeyboardEvent): boolean {
	let withKeyModifier = e.ctrlKey || e.altKey;
	return (
		e.code == "Backspace" ||
		e.code == "Delete" ||
		(KEY_CODE_KEY_REGEX.test(e.code) && !withKeyModifier) ||
		(KEY_CODE_DIGIT_REGEX.test(e.code) && !withKeyModifier) ||
		(KEY_CODE_NUMPAD_REGEX.test(e.code) && !withKeyModifier) ||
		(insertableSpecialKeys.includes(e.code) && !withKeyModifier)
	);
}

function capitalizeOneWord(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function capitalizeWords(selection: string): string {
	const words = selection.split(WORD_BOUNDARY_REGEX);
	const capitalizedWords = words.map(word => {
		if (WORD_CHAR_REGEX.test(word)) {
			return capitalizeOneWord(word);
		}
		return word;
	});
	return capitalizedWords.join('');
}
