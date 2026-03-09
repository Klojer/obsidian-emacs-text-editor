# My obsidian plugin needs to move the cursor to the visual end of a line.  By visual end, I mean the end of the line as it appears on the screen, not the end of the string in the datastructure.  The visual line end changes as the screen size of fonts change.  It also needs to be able to go to the visual start of a line.  It probably needs to get to to the codemirror level to accomplish this.  What do you suggest?  
  
The key is CodeMirror 6's `EditorView.moveToLineBoundary` method, which is designed exactly for this — it operates on **visual lines** (as rendered on screen), not logical document lines.

## The Core Method: `moveToLineBoundary`

CodeMirror 6's `EditorView` has a method purpose-built for this:

```ts
view.moveToLineBoundary(pos: SelectionRange, forward: boolean, includeWrap?: boolean): SelectionRange
```

- `forward: true` → moves to the **visual end** of the line[1]
- `forward: false` → moves to the **visual start** of the line[1]
- It accounts for line wrapping caused by screen width and font size changes, because it queries the DOM layout directly

This is distinct from `state.doc.line(n).to`, which gives you the logical end of a document line (the newline character position), regardless of how the text is wrapped on screen.[2]

## Accessing the CodeMirror View in Obsidian

In an Obsidian plugin, you get the underlying `EditorView` via the active leaf's `cm` property:

```ts
import { EditorView } from "@codemirror/view";

// Get the CM6 EditorView from Obsidian's editor
const view = (this.app.workspace.activeLeaf.view as any).editor.cm as EditorView;
```

## Moving to Visual Line End/Start

Here's a complete implementation for both operations:

```ts
import { EditorView } from "@codemirror/view";

function moveToVisualLineEnd(view: EditorView) {
    const selection = view.state.selection.main;
    const newRange = view.moveToLineBoundary(selection, true);  // true = forward = end
    view.dispatch({
        selection: { anchor: newRange.head, head: newRange.head },
        scrollIntoView: true,
    });
}

function moveToVisualLineStart(view: EditorView) {
    const selection = view.state.selection.main;
    const newRange = view.moveToLineBoundary(selection, false);  // false = backward = start
    view.dispatch({
        selection: { anchor: newRange.head, head: newRange.head },
        scrollIntoView: true,
    });
}
```

## Why `moveToLineBoundary` Is the Right Tool

| Method | What it measures | Respects wrapping? |
|---|---|---|
| `state.doc.line(n).to` | Document string offset | ❌ No |
| `view.moveToLineBoundary(pos, true)` | Visual screen position | ✅ Yes |

The `moveToLineBoundary` method uses the actual rendered DOM geometry to compute where a visual line ends, so it automatically adapts when fonts change size or the editor is resized. The `@codemirror/commands` package also exposes `cursorLineBoundaryForward` and `cursorLineBoundaryBackward` as pre-built commands that call `moveToLineBoundary` under the hood — you could dispatch those commands instead if you want a simpler approach that also handles selection extending.[1]  
  
# Citations:  
[1] [CodeMirror Reference Manual](https://codemirror.net/docs/ref/)  
[2] [Codemirror 6: Move cursor to specific line and mark its text](https://discuss.codemirror.net/t/codemirror-6-move-cursor-to-specific-line-and-mark-its-text/4388)  
[3] [Cursor moves to start of line - discuss.CodeMirror](https://discuss.codemirror.net/t/cursor-moves-to-start-of-line/5608)  
[4] [set cursor position in v6 - discuss.CodeMirror](https://discuss.codemirror.net/t/set-cursor-position-in-v6/4476)  
[5] [CodeMirror keyboard shortcuts - DefKey](https://defkey.com/codemirror-shortcuts)  
[6] [Obsidian plugin with options to customize the behavior of CodeMirror](https://github.com/nothingislost/obsidian-codemirror-options)  
[7] [How to set cursor position in Codemirror editor - Stack Overflow](https://stackoverflow.com/questions/33394855/how-to-set-cursor-position-in-codemirror-editor)  
[8] [Buggy visual-line navigation using current codemirror-vim](https://forum.obsidian.md/t/buggy-visual-line-navigation-using-current-codemirror-vim/86300)  
[9] [Get accurate cursor position for hanging wrap point - v6](https://discuss.codemirror.net/t/get-accurate-cursor-position-for-hanging-wrap-point/8469)  
[10] [esm7/obsidian-vimrc-support: A plugin for the Obsidian.md ... - GitHub](https://github.com/esm7/obsidian-vimrc-support)  
[11] [cursor moves to the beginning of the line while typing quickly if the ...](https://github.com/uiwjs/react-codemirror/issues/694)  
[12] [Vim `gk` at the head of line goes 2 line up - Obsidian Forum](https://forum.obsidian.md/t/vim-gk-at-the-head-of-line-goes-2-line-up/74445)  
[13] [RTL editor: can't type any thing after a LTR text if it's at the end of the ...](https://discuss.codemirror.net/t/rtl-editor-cant-type-any-thing-after-a-ltr-text-if-its-at-the-end-of-the-line/8688)  
[14] [How can I get a minimap in Obsidian like the one in VS Code shown ...](https://www.reddit.com/r/ObsidianMD/comments/111wpdj/how_can_i_get_a_minimap_in_obsidian_like_the_one/)  
[15] [Getting started with the new CodeMirror 6 | DataCamp Engineering](https://blog.datacamp.engineering/codemirror-6-getting-started-7fd08f467ed2)