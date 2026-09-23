# Manual test — Export Design Tokens

Run in Figma desktop after `pnpm --filter export-design-tokens build`, with the plugin imported
from `packages/figma-plugin/manifest.json`.

## Setup

- [ ] Import the Lumen Academy collections as described in `examples/lumen-academy/README.md`
      (including Web code syntax for the three font families and the Font weight / Font family scopes).

## Normal editor

- [ ] The window opens with "Multiple files" selected and lists `primitives.json`,
      `semantic/brand/{nova,orbit,ember}.json`, `semantic/theme/{light,dark}.json`,
      `typography.json`, `$themes.json`.
- [ ] "Single file" lists only `tokens.json`.
- [ ] Clicking a row downloads that file alone.
- [ ] Destination menu: "Export to GitHub repo" is checked on first run; the button is black with the GitHub logo.
- [ ] Choose "Export to this computer": the button turns blue with a download icon. Export downloads
      `tokens.zip`; unzipped, `tokens/` equals `examples/lumen-academy/tokens/` (`diff -r`).
- [ ] Close and reopen the plugin: "Export to this computer" is still selected.
- [ ] Add a BOOLEAN variable to `semantic/theme`, refresh: the error list shows it once, Export is disabled.
      Delete it, refresh: the file list is back.
- [ ] A file with no local variables shows "No local variables in this file." and Export is disabled.

## GitHub

- [ ] With GitHub selected and nothing configured, Export opens GitHub settings.
- [ ] A wrong repository shows "Repository or branch not found." inline; nothing suggests replacing the token.
- [ ] Valid settings + a fine-grained token (Contents + Pull requests read/write) return to the export view.
- [ ] Settings now show "Token saved" and "Replace token"; the token is not visible anywhere.
- [ ] "Replace token" shows an empty field; "Keep the saved token" restores "Token saved"; exporting still works.
- [ ] Export: the button shows the steps, then "PR #N opened" with Open. The PR is on
      `styles/figma-export-<UTC timestamp>`, titled `chore(tokens): export from Figma`, the target folder
      contains exactly the exported files (stale files deleted), and the body names the file and you.
- [ ] Export again without changes: "No changes vs main", and no new branch appears on GitHub.

## Dev Mode

- [ ] Switch to Dev Mode, run the plugin from the Plugins tab: the same window, file list and downloads work.
- [ ] Publishing a PR from Dev Mode works.

## Developer shortcut

- [ ] Alt+Shift+S downloads `snapshot.json` and logs it to the console.
