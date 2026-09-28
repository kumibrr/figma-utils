# Manual test — Export Design Tokens

Run in Figma desktop after `pnpm --filter export-design-tokens build`, with the plugin imported
from `packages/figma-plugin/manifest.json`.

## Setup

- [ ] Import the Lumen Academy collections as described in `examples/lumen-academy/README.md`
      (including Web code syntax for the three font families), without setting the Font weight scopes.
- [ ] The export is blocked with "4 variables have no scope" under `typography`: `weight/regular`,
      `weight/medium`, `weight/bold` and `weight/title`, each "→ Font weight (name)". No other errors are listed.
- [ ] Untick `weight/title`: the button reads "Apply 3 scopes". Tick it again and click "Apply 4 scopes":
      the banner says "Set the scopes of 4 variables", the file list appears, and Local variables
      shows only "Font weight" for the four weights.
- [ ] ⌘Z / Ctrl+Z in Figma puts all four back on "All scopes"; refresh shows the suggestions again.
      Apply them again.
- [ ] Set `size/m` and `leading/m` to "All scopes", refresh: they are suggested "Font size (name)" and
      "Line height (name)". After applying, they show only that scope and the export still equals `tokens/`.
- [ ] Add a number `opacity/50` = 0.5 on "All scopes", refresh: it is suggested
      "Opacity (name; can't be exported)". After applying, the error list shows "opacity variables are
      not supported". Delete it.

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
- [ ] Only the token step is enabled. A wrong token + Continue shows "GitHub rejected the token." under the
      field; nothing is saved and the other steps stay disabled.
- [ ] A fine-grained token (Contents + Pull requests read/write) + Continue (or Enter) shows "Token saved" and
      fills Owner. With a single-owner token that owner is already selected.
- [ ] Owner lists only repositories the token can push to; an owner with just one is selected automatically.
- [ ] Picking a repository fills Base branch with its default branch and suggests its branches.
- [ ] Typing a name that isn't a branch shows "New branch — will be created from <default>". Save creates it on
      GitHub from the default branch and returns to the export view.
- [ ] Picking an existing branch and saving returns to the export view without creating anything.
- [ ] Reopening settings pre-selects the saved owner, repository and base branch; the token is not visible anywhere.
- [ ] With a saved repository the token can no longer reach, the owner stays selected and the flow says
      "<owner/repo> isn't available with this token — pick a repository."
- [ ] "Replace token" shows an empty field and disables the other steps; "Keep the saved token" restores
      "Token saved" and the previous choices; exporting still works.
- [ ] Export: the button shows the steps, then "PR #N opened" with Open. The PR is on
      `styles/figma-export-<UTC timestamp>`, titled `chore(tokens): export from Figma`, the target folder
      contains exactly the exported files (stale files deleted), and the body names the file and you.
- [ ] Export again without changes: "No changes vs main", and no new branch appears on GitHub.

## Dev Mode

- [ ] Switch to Dev Mode, run the plugin from the Plugins tab: the same window, file list and downloads work.
- [ ] Publishing a PR from Dev Mode works.
- [ ] With a weight back on "All scopes", Dev Mode lists the suggestion but its checkbox and
      "Apply" are disabled, with a note to open the file in the editor.

## Developer shortcut

- [ ] Alt+Shift+S downloads `snapshot.json` and logs it to the console.
