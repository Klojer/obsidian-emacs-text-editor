import { App, Editor, EditorPosition, Plugin, PluginSettingTab, MarkdownView, Setting } from "obsidian";

class KeyPress {
	public readonly key: string;
	public readonly alt: boolean;
	public readonly ctrl: boolean;
	public readonly shift: boolean;
	public readonly meta: boolean;

	public constructor(
		key: string,
		shift: boolean,
		alt: boolean,
		ctrl: boolean,
		meta: boolean,
	) {
		this.key = key;
		this.shift = shift;
		this.alt = alt;
		this.ctrl = ctrl;
		this.meta = meta;
	}

	public static fromEvent(event: KeyboardEvent): KeyPress {
		const key = event.key;
		const shift = event.shiftKey;
		const ctrl = event.ctrlKey;
		const alt = event.altKey;
		const meta = event.metaKey;

		return new KeyPress(key, shift, alt, ctrl, meta);
	}

	public readonly text = (): string => {
		const metaRepr = this.meta ? 'Meta + ' : '';
		const altRepr = this.alt ? 'Alt + ' : '';
		const ctrlRepr = this.ctrl ? 'Ctrl + ' : '';
		const shiftRepr = this.shift ? 'Shift + ' : '';

		return metaRepr + ctrlRepr + altRepr + shiftRepr + this.key;
	};

}

type EditorCb = (this: EmacsTextEditorPlugin, editor: Editor) => void;

type EmacsCommandName = 'backwardChar' | 'backwardKillWord' |
'backwardWord' | 'beginningOfBuffer' | 'deleteChar' | 'endOfBuffer' |
'forwardChar' | 'forwardWord' | 'keyboardQuit' | 'killLine' | 'killRegion' |
 'killRingSave' | 'killWord' | 'moveBeginningOfLine' | 'moveEndOfLine' | 'nextLine' |
 'previousLine' | 'recenter' | 'redo' | 'setMarkCommand' | 'undo' | 'yank';

interface PluginSettings {
	keyEmacsCmdMap:  { [key: string]: EmacsCommandName } ;
}

const DEFAULT_SETTINGS: PluginSettings = {
	keyEmacsCmdMap: {
		"Ctrl + f": 'forwardChar',
		"Ctrl + b": 'backwardChar',
		"Ctrl + n": 'nextLine',
		"Ctrl + p": 'previousLine',
	}
}

export default class EmacsTextEditorPlugin extends Plugin {

	// TODO: Consider possibility migrate to native selection mechanism
	selectFrom?: EditorPosition = undefined

	settings: PluginSettings;
	emacsCmdCallbackMap?: Map<EmacsCommandName, EditorCb> = undefined;

	async onload() {
		console.log('loading plugin: Emacs text editor');

		await this.loadSettings();

		// TODO: replace with obj?
		this.emacsCmdCallbackMap = new Map<EmacsCommandName, EditorCb>([
			['forwardChar', this.forwardChar],
			['backwardChar', this.backwardChar],
			['nextLine', this.nextLine],
			['previousLine', this.previousLine],
		]);

		this.addSettingTab(new EmacsTextEditorSettingTab(this.app, this));

		this.addCommand({
			id: 'forward-char',
			name: 'Forward char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.forwardChar(editor)
			},
		});

		this.addCommand({
			id: 'backward-char',
			name: 'Backward char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.backwardChar(editor)
			}
		});

		this.addCommand({
			id: 'next-line',
			name: 'Next line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goDown")
				})
			}
		});

		this.addCommand({
			id: 'previous-line',
			name: 'Previous line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goUp")
				})
			}
		});

		this.addCommand({
			id: 'forward-word',
			name: 'Forward word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goWordRight")
				})
			}
		});

		this.addCommand({
			id: 'backward-word',
			name: 'Backward word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goWordLeft")
				})
			}
		});

		this.addCommand({
			id: 'move-end-of-line',
			name: 'Move end of line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					const cursor = editor.getCursor()
					const lineContent = editor.getLine(cursor.line)
					editor.setCursor({ line: cursor.line, ch: lineContent.length })
				})
			}
		});

		this.addCommand({
			id: 'move-beginning-of-line',
			name: 'Move cursor to beginning of line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					const cursor = editor.getCursor()
					editor.setCursor({ line: cursor.line, ch: 0 })
				})
			}
		});

		this.addCommand({
			id: 'beginning-of-buffer',
			name: 'Beginning of buffer',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goStart")
				})
			}
		});

		this.addCommand({
			id: 'end-of-buffer',
			name: 'End of buffer',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goEnd")
				})
			}
		});

		this.addCommand({
			id: 'kill-line',
			name: 'Kill line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor)

				const cursor = editor.getCursor()
				const lineContent = editor.getLine(cursor.line)
				if (lineContent === "") {
					editor.exec("deleteLine")
				} else {
					editor.setLine(cursor.line, lineContent.substring(0, cursor.ch))
					editor.setCursor(cursor)
				}
			}
		});

		this.addCommand({
			id: 'delete-char',
			name: 'Delete char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor)

				this.withDeleteInText(editor, () => {
					editor.exec("goRight")
				})
			}
		});

		this.addCommand({
			id: 'kill-word',
			name: 'Kill word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor)

				this.withDeleteInText(editor, () => {
					editor.exec("goWordRight")
				})
			}
		});

		this.addCommand({
			id: 'backward-kill-word',
			name: 'Backward kill word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor)

				this.withDeleteInText(editor, () => {
					editor.exec("goWordLeft")
				})
			}
		});

		this.addCommand({
			id: 'kill-ring-save',
			name: 'Kill ring save',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				if (this.selectFrom === undefined) {
					return
				}

				navigator.clipboard.writeText(editor.getSelection())

				this.disableSelection(editor)
			}
		});

		this.addCommand({
			id: 'kill-region',
			name: 'Kill region',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				if (this.selectFrom === undefined) {
					return
				}

				navigator.clipboard.writeText(editor.getSelection())
				editor.replaceSelection("")

				this.disableSelection(editor)
			}
		});

		this.addCommand({
			id: 'yank',
			name: 'Yank',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				const clipboardContent = await navigator.clipboard.readText()
				const cursor = editor.getCursor()

				if (this.selectFrom === undefined) {
					editor.replaceRange(clipboardContent, cursor)
				} else {
					editor.replaceSelection(clipboardContent)
					this.disableSelection(editor)
				}

				editor.setCursor(cursor.line, cursor.ch + clipboardContent.length)
			}
		});

		this.addCommand({
			id: 'set-mark-command',
			name: 'Set mark command',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				if (this.selectFrom === undefined) {
					this.selectFrom = editor.getCursor()
				} else {
					this.disableSelection(editor)
				}
			}
		});

		this.addCommand({
			id: 'keyboard-quit',
			name: 'Keyboard-quit',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor)
			}
		});

		this.addCommand({
			id: 'undo',
			name: 'Undo',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				editor.undo()
			}
		});

		this.addCommand({
			id: 'redo',
			name: 'Redo',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				editor.redo()
			}
		});

		this.addCommand({
			id: 'recenter-top-bottom',
			name: 'Recenter',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				const cursor = editor.getCursor()
				const range = {
					from: { line: cursor.line, ch: cursor.ch },
					to: { line: cursor.line, ch: cursor.ch }
				}
				editor.scrollIntoView(range, true)
			}
		});

		this.registerDomEvent(document, "keydown", (ev: KeyboardEvent) => {
			const keyPress: KeyPress = KeyPress.fromEvent(ev);

			const editor = this.app.workspace.activeEditor?.editor
			if (!editor) {
				return;
			}

			const cmd: EmacsCommandName | undefined = this.settings.keyEmacsCmdMap[keyPress.text()];
			console.log(this.settings.keyEmacsCmdMap);
			console.log(keyPress.text());
			if (!cmd) {
				return;
			}

			const cb: EditorCb | undefined = this.emacsCmdCallbackMap?.get(cmd);
			if (!cb) {
				console.error("cannot find callback for Emacs Command ${cmd}")
			}

			if (cb) {
				cb.bind(this)(editor);
			}
			return;
		});

	}

	onunload() {
		console.log('unloading plugin: Emacs text editor');
	}

	// TODO: check invalid CmdName load case
	async loadSettings() {
		const persistedSettings = await this.loadData()

		if (!persistedSettings) {
			this.settings = DEFAULT_SETTINGS;
		} else {
			this.settings = persistedSettings;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	forwardChar(editor: Editor) {
		this.withSelectionUpdate(editor, () => {
			editor.exec("goRight")
		})
	}

	backwardChar(editor: Editor) {
		this.withSelectionUpdate(editor, () => {
			editor.exec("goLeft")
		})
	}

	nextLine(editor: Editor) {
		this.withSelectionUpdate(editor, () => {
			editor.exec("goDown")
		})
	}

	previousLine(editor: Editor) {
		this.withSelectionUpdate(editor, () => {
			editor.exec("goUp")
		})
	}

	disableSelection(editor: Editor) {
		editor.setSelection(editor.getCursor(), editor.getCursor())
		this.selectFrom = undefined
	}

	withSelectionUpdate(editor: Editor, callback: () => void) {
		if (this.selectFrom !== undefined) {
			editor.setSelection(editor.getCursor())
		}

		callback()

		this.updateSelectionIsNeed(editor)
	}

	updateSelectionIsNeed(editor: Editor) {
		if (this.selectFrom === undefined) {
			return
		}

		editor.setSelection(this.selectFrom, editor.getCursor())
	}

	withDeleteInText(editor: Editor, callback: () => void) {
		const cursorBefore = editor.getCursor()

		callback()

		const cursorAfter = editor.getCursor()

		editor.setSelection(cursorBefore, cursorAfter)
		editor.replaceSelection("")
	}

}

class EmacsTextEditorSettingTab extends PluginSettingTab {
	plugin: EmacsTextEditorPlugin;

	constructor(app: App, plugin: EmacsTextEditorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		for (const currentKeyMap in this.plugin.settings.keyEmacsCmdMap) {
			const cmd: EmacsCommandName = this.plugin.settings.keyEmacsCmdMap[currentKeyMap]
			new Setting(containerEl)
				.setName(cmd.toString())
				.addText(text => text
					.setPlaceholder('Enter keymap')
					.setValue(currentKeyMap)
					.onChange(async (newKeyMap) => {
						// TODO: handle empty values
						for (const [key, value] of Object.entries(this.plugin.settings.keyEmacsCmdMap)) {
							if (value == cmd) {
								delete this.plugin.settings.keyEmacsCmdMap[key];
							}
						}
						// this.plugin.settings.keyEmacsCmdMap.delete(currentKeyMap);
						this.plugin.settings.keyEmacsCmdMap[newKeyMap] = cmd;
						await this.plugin.saveSettings();
					}));
		}
	}
}