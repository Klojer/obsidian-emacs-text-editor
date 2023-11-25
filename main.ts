import { Editor, EditorPosition, Plugin, MarkdownView } from "obsidian";

export default class EmacsTextEditorPlugin extends Plugin {

	// TODO: Consider possibility migrate to native selection mechanism
	selectFrom?: EditorPosition = undefined
	ctrlPressed?: boolean = false;

	onload() {
		console.log('loading plugin: Emacs text editor');

		this.addCommand({
			id: 'forward-char',
			name: 'Forward char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goRight")
				})
			}
		});

		this.addCommand({
			id: 'backward-char',
			name: 'Backward char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goLeft")
				})
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
			console.log('Keydown', ev);

			if (ev.ctrlKey || ev.key == "CapsLock") {
				this.ctrlPressed = true;
				console.log('Ctrl down');
			}

			if (!this.ctrlPressed) {
				return;
			}

			const app = this.app as any;

			if (ev.key == "f") {
				app.commands.executeCommandById('emacs-text-editor:forward-char');
				return;
			}

			if (ev.key == "b") {
				app.commands.executeCommandById('emacs-text-editor:backward-char');
				return;
			}

			if (ev.key == "n") {
				app.commands.executeCommandById('emacs-text-editor:next-line');
				return;
			}

			if (ev.key == "p") {
				app.commands.executeCommandById('emacs-text-editor:previous-line');
				return;
			}

		});
		
		this.registerDomEvent(document, "keyup", (ev: KeyboardEvent) => {
			console.log('Keyup', ev);

			if (ev.ctrlKey || ev.key == "CapsLock") {
				this.ctrlPressed = false;
				console.log('Ctrl up');
			}
		});

	}

	onunload() {
		console.log('unloading plugin: Emacs text editor');
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
