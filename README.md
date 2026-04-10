# Emacs Text Editor for Obsidian

This plugin adds a few commands to use Obsidian with Emacs-like keybindings.

## Purpose of the project

What is this plugin:
1. Basic imitation of Emacs commands to make text editing for Emacs users more smooth

What **isn't** this plugin:
1. Implementation of complete GNU Emacs functionality and integration elisp into Obsidian
2. Exact reproducing behavior of GNU Emacs commands

## How to install

Run:

```
export OBSIDIAN_PLUGINS_DIR=/path/to/obsidian/vault/.obsidian/plugins
make install
```

## How to uninstall

```
export OBSIDIAN_PLUGINS_DIR=/path/to/obsidian/vault/.obsidian/plugins
make uninstall
```


## Example of keybindings configuration

| Hotkey                  | Obisdian command           | Description               |
| ----------------------- | -------------------------- | ------------------------- |
| Ctrl + b                | Backward char              | Move cursor one character backward |
| Alt + Backspace         | Backward kill word         | Delete one word backward |
| Alt + Shift + [         | Backward paragraph         | Move cursor one paragraph backward |
| Alt + b                 | Backward word              | Move cursor one word backward |
| Alt + Shift + ,         | Beginning of buffer        | Move to the beginning of a buffer |
| Ctrl + d                | Delete char                | Delete the following char |
| Alt + Shift + .         | End of buffer              | Move to the end of a buffer |
| Ctrl + f                | Forward char               | Move cursor one character forward |
| Alt + Shift + ]         | Forward paragraph          | Move cursor one paragraph forward |
| Alt + f                 | Forward word               | Move cursor one word forward |
| Ctrl + g                | Keyboard quit              | Signal a ‘quit’ condition (works only for selection) |
| Ctrl + k                | Kill line                  | Kill the rest of the current line |
| Ctrl + w                | Kill region                | Cut a selected region  |
| Alt + w                 | Kill ring save             | Copy a selected region    |
| Alt + d                 | Kill word                  | Delete chars until end of a word |
| Ctrl + a                | Move beginning of line     | Move cursor to beginning of line |
| Ctrl + e                | Move end of line           | Move cursor to end of line |
| Ctrl + n                | Next line                  | Move cursor to next line |
| Ctrl + p                | Previous line              | Move cursor to previous line |
| Ctrl + l                | Recenter                   | Scroll window to center current line |
| Ctrl + Shift + -        | Redo                       | Redo |
| Ctrl + Space            | Set mark command           | Mark the beginning of a selection |
| (not configured)        | Mark whole buffer          | Select the entire buffer and set mark at the beginning |
| Ctrl + /                | Undo                       | Undo |
| Ctrl + y                | Yank                       | Paste (Yank) a cut or copied a region |
| (not configured)        | Transpose chars            | Swap the two characters around the cursor |
| (not configured)        | Upcase word                | Make entire next word uppercase, advance cursor |
| (not configured)        | Downcase word              | Make entire next word lowercase, advance cursor |
| (not configured)        | Capitalize word            | Capitalize next word or rest of current word, advance cursor |
| (not configured)        | Upcase region              | Make entire selected region uppercase |
| (not configured)        | Downcase region            | Make entire selected region lowercase |
| (not configured)        | Capitalize region          | Capitalize each word in selected region |
| Alt + u                 | Upcase dwim                | Uppercase selection if selection exists, else word |
| Alt + l                 | Downcase dwim              | Lowercase selection if selection exists, else word |
| Alt + c                 | Capitalize dwim            | Capitalize selection if selection exists, else word |
| Alt + x                 | Open command palette       | Open command palette |

## Key Repeat

When enabled in Settings → Community plugins → Emacs text editor, the following additional hotkeys will repeat when held down, as in emacs:

- **Character movement:** Ctrl+F, Ctrl+B
- **Line movement:** Ctrl+N, Ctrl+P  
- **Word movement:** Alt+F, Alt+B
- **Character, Word Deletion**: Ctrl+D, Alt+D

In the Settings, you can also adjust the initial repeat delay or interval, or use quick presets (Slow/Medium/Fast).  This repeat mechanism works around Obsidian API limitations which prevent changing ctrl or alt key repeats.  It is separate from your OS keyboard repeat controls; changing repeat timing here affects only Obsidian hotkey behavior.

## Known issues

1. Move to beginning of line command (Ctrl + a) conflicts with select all action. Solution: Use Home/End + Shift.
2. Conflicts with existing hotkeys. Solution: use additional plugin for custom bindings, for example https://github.com/tgrosinger/leader-hotkeys-obsidian
3. Absent support of "kill-ring". Solution: use plugin https://github.com/Karakaz/obsidian-paste-from-history with `Alt + y` keybinding
4. Absent support of scroll-up/scroll-down commands. [Solution is not found](https://github.com/Klojer/obsidian-emacs-text-editor/issues/1)
