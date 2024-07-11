import { Editor, EditorPosition, Plugin, MarkdownView } from "obsidian";

enum Direction {
	Forward,
	Backward
}

export default class EmacsTextEditorPlugin extends Plugin {

	pluginTriggerSelection = false
	disableSelectionWhenPossible = false;

	onload() {
		console.log('loading plugin: Emacs text editor');

		document.addEventListener('keydown',(e) =>{
			if (e.code == 'Backspace'){
				this.disableSelectionWhenPossible = true;
			}
		});

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
				if (!this.getCurrentSelectionStart(editor)) {
					return
				}

				navigator.clipboard.writeText(editor.getSelection())
				document.dispatchEvent(new ClipboardEvent('copy'));

				this.disableSelection(editor)
			}
		});

		this.addCommand({
			id: 'kill-region',
			name: 'Kill region',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				if (!this.getCurrentSelectionStart(editor)) {
					return
				}

				navigator.clipboard.writeText(editor.getSelection())
				editor.replaceSelection("")
				document.dispatchEvent(new ClipboardEvent('cut'));

				this.disableSelection(editor)
			}
		});

		this.addCommand({
			id: 'yank',
			name: 'Yank',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				const clipboardContent = await navigator.clipboard.readText()
				const cursor = editor.getCursor()

				if (!this.getCurrentSelectionStart(editor)) {
					editor.replaceRange(clipboardContent, cursor)
				} else {
					editor.replaceSelection(clipboardContent)
					this.disableSelection(editor)
				}

				editor.setCursor(cursor.line, cursor.ch + clipboardContent.length)
				document.dispatchEvent(new ClipboardEvent('paste'));
			}
		});

		this.addCommand({
			id: 'set-mark-command',
			name: 'Set mark command',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				if (this.pluginTriggerSelection) {
					this.disableSelection(editor)
				} else {
					this.pluginTriggerSelection = true
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

		this.addCommand({
			id: 'forward-paragraph',
			name: 'Forward paragraph',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					this.moveToNextParagraph(editor, Direction.Forward)
				})
			}
		});

		this.addCommand({
			id: 'backward-paragraph',
			name: 'Backward paragraph',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.withSelectionUpdate(editor, () => {
					this.moveToNextParagraph(editor, Direction.Backward)
				})
			}
		});

	}

	onunload() {
		console.log('unloading plugin: Emacs text editor');
	}

	disableSelection(editor: Editor) {
		editor.setSelection(editor.getCursor(), editor.getCursor());
		this.pluginTriggerSelection = false;
		this.disableSelectionWhenPossible = false;
	}

	withSelectionUpdate(editor: Editor, callback: () => void) {
		if (this.disableSelectionWhenPossible) {
			this.disableSelection(editor);
		}

		const currentSelectionStart = this.getCurrentSelectionStart(editor);
		if (currentSelectionStart) {
			editor.setSelection(editor.getCursor())
		}

		callback()

		if (currentSelectionStart) {
			editor.setSelection(currentSelectionStart, editor.getCursor())
		}
	}

	getCurrentSelectionStart(editor: Editor): EditorPosition | undefined {
		const selections = editor.listSelections()

		if (selections.length == 0) {
			return undefined
		}

		if (selections[0].anchor.line !== selections[0].head.line ||
			selections[0].anchor.ch !== selections[0].head.ch) {
			return selections[0].anchor
		}

		if (this.pluginTriggerSelection) {
			return selections[0].anchor
		}

		return undefined
	}

	withDeleteInText(editor: Editor, callback: () => void) {
		const cursorBefore = editor.getCursor()

		callback()

		const cursorAfter = editor.getCursor()

		editor.setSelection(cursorBefore, cursorAfter)
		editor.replaceSelection("")
	}

	moveToNextParagraph(editor: Editor, direction: Direction) {
		const cursor = editor.getCursor();
		const value = editor.getValue();
		const maxOffset = value.length;
		const currentOffset = editor.posToOffset(cursor);

		if ((direction === Direction.Forward && currentOffset >= maxOffset) ||
			(direction === Direction.Backward && currentOffset === 0)) {
			return;
		}

		let nextParagraphOffset = direction === Direction.Forward ? maxOffset : 0;
		let foundText = false;
		let foundFirstBreak = false;

		function isNewLine(position: number, direction: Direction): boolean {
			if (direction === Direction.Forward) {
				return value[position] === "\n" || (value[position] === "\r" && value[position + 1] === "\n");
			} else {
				return value[position] === "\n" || (position > 0 && value[position - 1] === "\r" && value[position] === "\n");
			}
		}

		const step = direction === Direction.Forward ? 1 : -1;
		let i = currentOffset;

		while ((direction === Direction.Forward && i < maxOffset) || (direction === Direction.Backward && i > 0)) {
			if (foundText && isNewLine(i, direction)) {
				if (foundFirstBreak) {
					nextParagraphOffset = direction === Direction.Forward ? i : i + 1;
					if ((direction === Direction.Forward && value[i] === "\r") ||
						(direction === Direction.Backward && i > 0 && value[i - 1] === "\r")) {
						nextParagraphOffset += direction === Direction.Forward ? 1 : -1;
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

}
