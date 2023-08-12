import { Editor, EditorPosition, Plugin, MarkdownView } from "obsidian";

export default class EmacsTextEditorPlugin extends Plugin {

	// TODO: Consider possibility migrate to native selection mechanism
	selectFrom?: EditorPosition = undefined

	onload() {
		console.log('loading plugin: Emacs text editor');

		this.addCommand({
			id: 'emacs-forward-char',
			name: 'Forward char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goRight")
				})
			}
		});

		this.addCommand({
			id: 'emacs-backward-char',
			name: 'Backward char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goLeft")
				})
			}
		});

		this.addCommand({
			id: 'emacs-next-line',
			name: 'Next line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goDown")
				})
			}
		});

		this.addCommand({
			id: 'emacs-previous-line',
			name: 'Previous line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goUp")
				})
			}
		});

		this.addCommand({
			id: 'emacs-forward-word',
			name: 'Forward word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goWordRight")
				})
			}
		});

		this.addCommand({
			id: 'emacs-backward-word',
			name: 'Backward word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goWordLeft")
				})
			}
		});

		this.addCommand({
			id: 'emacs-move-end-of-line',
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
			id: 'emacs-move-beginning-of-line',
			name: 'Move cursor to beginning of line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					const cursor = editor.getCursor()
					editor.setCursor({ line: cursor.line, ch: 0 })
				})
			}
		});

		this.addCommand({
			id: 'emacs-beginning-of-buffer',
			name: 'Beginning of buffer',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goStart")
				})
			}
		});

		this.addCommand({
			id: 'emacs-end-of-buffer',
			name: 'End of buffer',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					editor.exec("goEnd")
				})
			}
		});

		this.addCommand({
			id: 'emacs-kill-line',
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
			id: 'emacs-delete-char',
			name: 'Delete char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor)
				
				this.withDeleteInText(editor, () => {
					editor.exec("goRight")
				})
			}
		});

		this.addCommand({
			id: 'emacs-kill-word',
			name: 'Kill word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor)
				
				this.withDeleteInText(editor, () => {
					editor.exec("goWordRight")
				})
			}
		});

		this.addCommand({
			id: 'emacs-backward-kill-word',
			name: 'Backward kill word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor)
				
				this.withDeleteInText(editor, () => {
					editor.exec("goWordLeft")
				})
			}
		});

		this.addCommand({
			id: 'emacs-kill-ring-save',
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
			id: 'emacs-kill-region',
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
			id: 'emacs-yank',
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
			id: 'emacs-set-mark-command',
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
			id: 'emacs-keyboard-quit',
			name: 'Keyboard-quit',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.disableSelection(editor)
			}
		});

		this.addCommand({
			id: 'emacs-undo',
			name: 'Undo',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				editor.undo()
			}
		});

		this.addCommand({
			id: 'emacs-redo',
			name: 'Redo',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				editor.redo()
			}
		});

		this.addCommand({
			id: 'emacs-recenter-top-bottom',
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
