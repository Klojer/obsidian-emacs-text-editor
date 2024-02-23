import { Editor, EditorPosition, Plugin, MarkdownView } from "obsidian";

enum Direction {
	Forward,
	Backward
}

const ExtendLastKillOnRepeatCommands = [
	'kill-word',
	'backward-kill-word',
	'kill-line'
]

const ExtendLastKillBackwardsOnRepeatCommands = [
	'backwards-kill-word'
]

export default class EmacsTextEditorPlugin extends Plugin {
	// toggle to enable debug logging
	debugEnabled = false
	extendLastKill = false
	extendLastKillBackwards = false
	killRing: string[] = []
	killRingEndIndex = -1
	killRingMaxSize = 120 // Same default size as emacs
	lastCommandInvoked?: string = undefined
	yankEnd?: EditorPosition = undefined
	// TODO: Consider possibility migrate to native selection mechanism
	selectFrom?: EditorPosition = undefined
	yankIndex = -1
	yankPopIndex = -1
	yankStart?: EditorPosition = undefined

	onload() {
		this.killRing = new Array<string>(this.killRingMaxSize)
		console.log('loading plugin: Emacs text editor');
		this.addCommand({
			id: 'forward-char',
			name: 'Forward char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("forward-char")
				this.withSelectionUpdate(editor, () => {
					this.cancelYankPop();
					editor.exec("goRight")
				})
			}
		});

		this.addCommand({
			id: 'backward-char',
			name: 'Backward char',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("backward-char")
				this.withSelectionUpdate(editor, () => {
					editor.exec("goLeft")
				})
			}
		});

		this.addCommand({
			id: 'next-line',
			name: 'Next line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("next-line")
				this.withSelectionUpdate(editor, () => {
					editor.exec("goDown")
				})
			}
		});

		this.addCommand({
			id: 'previous-line',
			name: 'Previous line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("previous-line")
				this.withSelectionUpdate(editor, () => {
					editor.exec("goUp")
				})
			}
		});

		this.addCommand({
			id: 'forward-word',
			name: 'Forward word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("forward-word")
				this.withSelectionUpdate(editor, () => {
					editor.exec("goWordRight")
				})
			}
		});

		this.addCommand({
			id: 'backward-word',
			name: 'Backward word',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("backward-word")
				this.withSelectionUpdate(editor, () => {
					editor.exec("goWordLeft")
				})
			}
		});

		this.addCommand({
			id: 'move-end-of-line',
			name: 'Move end of line',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("move-end-of-line")
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
				this.commandInvoked("move-beginning-of-line")
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
				this.commandInvoked("beginning-of-buffer")
				this.withSelectionUpdate(editor, () => {
					editor.exec("goStart")
				})
			}
		});

		this.addCommand({
			id: 'end-of-buffer',
			name: 'End of buffer',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("end-of-buffer")
				this.withSelectionUpdate(editor, () => {
					editor.exec("goEnd")
				})
			}
		});

		this.addCommand({
			id: 'kill-line',
			name: 'Kill line',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("kill-line")
				await this.killLine(editor)
			}
		});

		this.addCommand({
			id: 'delete-char',
			name: 'Delete char',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("delete-char")
				await this.withDelete(editor, () => {
					editor.exec("goRight")
				})
			}
		});

		this.addCommand({
			id: 'kill-word',
			name: 'Kill word',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("kill-word")
				await this.withKill(editor, () => {
					editor.exec("goWordRight");
				});
			}
		});

		this.addCommand({
			id: 'backward-kill-word',
			name: 'Backward kill word',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("backward-kill-word")
				await this.withKill(editor, () => {
					editor.exec("goWordLeft");
				})
			}
		});

		this.addCommand({
			id: 'kill-ring-save',
			name: 'Kill ring save',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.commandInvoked('kill-ring-save')
				if (!this.selectionIsActive()) {
					return;
				}
				await this.killRingSave(editor.getSelection());
				this.cancelSelect(editor);
			}
		});

		this.addCommand({
			id: 'kill-region',
			name: 'Kill region',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.commandInvoked('kill-region')
				await this.killRegion(editor)
			}
		});

		this.addCommand({
			id: 'yank',
			name: 'Yank',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.commandInvoked('yank')
				await this.yank(editor)
			}
		});


		this.addCommand({
			id: "yank-pop",
			name: "Yank Pop",
			editorCallback: async (editor, _) => {
				this.commandInvoked("yank-pop")
				await this.yankPop(editor)
			}
		});

		this.addCommand({
			id: 'set-mark-command',
			name: 'Set mark command',
			editorCallback: (editor, _) => {
				this.commandInvoked("set-mark-command")
				this.setMark(editor)
			}
		});

		this.addCommand({
			id: 'keyboard-quit',
			name: 'Keyboard-quit',
			editorCallback: (editor, _) => {
				this.commandInvoked("keyboard-quit")
				this.keyboardQuit(editor)
			}
		});

		this.addCommand({
			id: 'undo',
			name: 'Undo',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("undo")
				editor.undo()
			}
		});

		this.addCommand({
			id: 'redo',
			name: 'Redo',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("redo")
				editor.redo()
			}
		});

		this.addCommand({
			id: 'recenter-top-bottom',
			name: 'Recenter',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked("recenter-top-bottom")
				this.recenterToBottom(editor)
			}
		});

		this.addCommand({
			id: 'forward-paragraph',
			name: 'Forward paragraph',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.commandInvoked('forward-paragraph')
				this.withSelectionUpdate(editor, () => {
					this.moveToNextParagraph(editor, Direction.Forward)
				})
			}
		});

		this.addCommand({
			id: 'backward-paragraph',
			name: 'Backward paragraph',
			editorCallback: async (editor: Editor, _: MarkdownView) => {
				this.commandInvoked('backward-paragraph')
				this.withSelectionUpdate(editor, () => {
					this.moveToNextParagraph(editor, Direction.Backward)
				})
			}
		});
	}

	commandInvoked(id: string) {
		this.logDebug("command invoked: " + id)
		if (id !== "yank-pop") {
			this.cancelYankPop()
		}
		const isRepeat = this.lastCommandInvoked === id
		this.extendLastKill = isRepeat && ExtendLastKillOnRepeatCommands.includes(id)
		this.extendLastKillBackwards = isRepeat && ExtendLastKillBackwardsOnRepeatCommands.includes(id)
		this.lastCommandInvoked = id
	}

	logDebug(text: string) {
		if (! this.debugEnabled ) {
			return
		}
		console.log("emacs-text-editor: " + text)
	}

	onunload() {
		console.log('unloading plugin: Emacs text editor');
	}

	withSelectionUpdate(editor: Editor, callback: () => void) {
		if (this.selectFrom !== undefined) {
			editor.setSelection(editor.getCursor())
		}

		callback()

		this.extendSelection(editor)
	}

	extendSelection(editor: Editor) {
		if (this.selectFrom === undefined) {
			return
		}
		const start = this.selectFrom
		const end = editor.getCursor()
		this.logDebug("extending selection to cursor at " + JSON.stringify(end))
		editor.setSelection(start, end)
		this.logDebug("selection is now from " + JSON.stringify(start) +  " to " + JSON.stringify(end))
		this.logDebug("selected text: " + editor.getSelection())
	}

	async withDelete(editor: Editor, callback: () => void) {
		const cursorBefore = editor.getCursor()
		callback()
		const cursorAfter = editor.getCursor()
		editor.setSelection(cursorBefore, cursorAfter)
		this.logDebug("set selection from " + cursorBefore + " to " + cursorAfter + ", selected text: " + editor.getSelection())
		this.logDebug("seplacing selection with empty string")
		editor.replaceSelection("")
		this.cancelSelect(editor)
	}


	async killRingSave(text: string) {
		if (this.extendLastKill && this.killRing[this.yankIndex]) {
			this.logDebug("extending last kill")
			const lastKill = this.killRing[this.yankIndex]
			if (this.extendLastKillBackwards) {
				text = text + lastKill
			}  else {
				text = lastKill + text
			}
		} else {
			this.yankIndex++
			if (this.yankIndex >= this.killRingMaxSize) {
				this.yankIndex = 0
			}
			if (this.yankIndex > this.killRingEndIndex) {
				this.killRingEndIndex = this.yankIndex
			}
		}
		this.killRing[this.yankIndex] = text
		this.logDebug("kill ring index " + this.yankIndex + " text now : " + text)
		const clipboardText = await navigator.clipboard.readText()
		if (clipboardText === text) {
			return;
		}
		await navigator.clipboard.writeText(text);
		this.logDebug("wrote text to navigator clipboard: " + text)

	}

	cancelSelect(editor: Editor) {
		this.logDebug("clearing selection")
		editor.setSelection(editor.getCursor(), editor.getCursor());
		this.selectFrom = undefined;
	}

	selectionIsActive(): boolean {
		return (this.selectFrom !== undefined)
	}
	async withKill(editor: Editor, callback: () => void) {
		this.withSelect(editor, callback)
		await this.replaceSelectedText(editor, "", true)
	}

	async replaceSelectedText(editor: Editor, text = "", save = true) {
		if (!this.selectionIsActive()) {
			return;
		}
		this.logDebug("replacing selected text")
		if (! text) {
			text = ""
		}
		if (save) {
			const selectedText = editor.getSelection()
			this.logDebug("saving selected text to kill ring: " + selectedText)
			await this.killRingSave(selectedText)
		}
		editor.replaceSelection(text);
		this.logDebug("replaced selected text with '" + text + "'")
		this.cancelSelect(editor);
	}

	withSelect(editor: Editor, callback: () => void) {
		this.cancelSelect(editor);
		const start = editor.getCursor();
		this.selectFrom = start
		callback();
		const end = editor.getCursor();
		this.logDebug("selecting text from " + JSON.stringify(start) + " to " + JSON.stringify(end))
		editor.setSelection(start, end);
		this.logDebug("selected text is now: " + editor.getSelection())

	}
	async killWord(editor: Editor) {
		this.cancelSelect(editor);
		await this.withKill(editor, () => {
			editor.exec("goWordRight");
		});
	}

	async killLine(editor: Editor) {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		this.logDebug("kill-line - line is '" + line + "'")
		if (line === '') {
			await this.withKill(editor, () => {
				editor.exec("goRight")
			})
			return
		}
		this.logDebug("kill-line - cursor is " + JSON.stringify(cursor))
		const textToBeRetained = line.slice(0, cursor.ch);
		const textToBeCut = line.slice(cursor.ch);
		await this.killRingSave(textToBeCut)
		this.logDebug("kill-line - setting line " + cursor.line + " to '" + textToBeRetained + "'")
		editor.setLine(cursor.line, textToBeRetained);
		editor.setCursor(cursor, cursor.ch);
	}

	async killRegion(editor: Editor) {
		await this.replaceSelectedText(editor, "", true)
	}

	async yank(editor: Editor) {
		this.logDebug("started yank")
		this.cancelYankPop();
		const clipboardText = await navigator.clipboard.readText();
		const yankText = this.killRing[this.yankIndex]
		if (yankText !== clipboardText) {
			await this.killRingSave(clipboardText)
		}
		const position = editor.getCursor();
		if (!this.selectionIsActive()) {
			this.logDebug("inserting text at position " + position + ": " + clipboardText)
			editor.replaceRange(clipboardText, position);
		} else {
			this.logDebug("replacing selection with: " + clipboardText)
			editor.replaceSelection(clipboardText);
			this.cancelSelect(editor);
		}
		this.yankStart = position;
		editor.setCursor(this.yankStart.line, this.yankStart.ch + clipboardText.length);
		this.yankEnd = editor.getCursor()
		this.yankPopIndex = this.yankIndex - 1;
		this.logDebug("yanked '" + yankText + "'")
	}

	cancelYankPop() {
		this.yankPopIndex = this.yankIndex;
		this.yankStart = undefined;
		this.yankEnd = undefined;
		this.logDebug("yank pop stopped")
	}

	async yankPop(editor: Editor) {
		this.logDebug("yank pop started")
		if (this.yankStart === undefined || this.yankEnd === undefined || this.yankIndex < 0) {
			this.logDebug("can't yank pop")
			return;
		}
		if (this.yankPopIndex < 0) {
			this.yankPopIndex = this.killRingEndIndex
			console.log("yank pop index less than zero, setting to kill ring end index " + this.yankPopIndex)
		}
		const yankPopText = this.killRing[this.yankPopIndex];
		console.log("yank pop text: " + yankPopText)
		this.cancelSelect(editor);
		editor.setSelection(this.yankStart, this.yankEnd)
		editor.replaceSelection(yankPopText);
		editor.setCursor(this.yankStart.line, this.yankStart.ch + yankPopText.length);
		this.yankEnd = editor.getCursor()
		this.yankPopIndex--;
		this.logDebug("yank poppped '" + yankPopText + "'")
	}

	setMark(editor: Editor) {
		/*  start new selection from cursor if already started */
		if (this.selectionIsActive()) {
			this.cancelSelect(editor);
		}
		this.selectFrom = editor.getCursor();
		this.logDebug("selection start is now " + this.selectFrom)
	}

	keyboardQuit(editor: Editor) {
		this.cancelYankPop();
		this.cancelSelect(editor)
	}

	recenterToBottom(editor: Editor) {
		const cursor = editor.getCursor();
		const range = {
			from: {line: cursor.line, ch: cursor.ch},
			to: {line: cursor.line, ch: cursor.ch}
		};
		editor.scrollIntoView(range, true);
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
