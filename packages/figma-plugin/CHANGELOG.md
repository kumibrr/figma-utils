# tokensync

## 2.0.4

### Patch Changes

- 8466230: Remove the "TokenSync" header row; the settings button now sits next to the format switch. Figma's window bar already shows the plugin name, and its icon once the plugin is published.

## 2.0.3

### Patch Changes

- 055bfe2: Show the TokenSync icon and name in the plugin header.

## 2.0.2

### Patch Changes

- e19cb03: Fix the settings view showing two scrollbars.

## 2.0.1

### Patch Changes

- c46d032: Rename the plugin to TokenSync. Releases are now tagged `tokensync@<version>`.

## 2.0.0

### Major Changes

- 9be5f6a: Size variables are now read as px and exported as rem, divided by a base font size set in Settings (default 16px) and saved in the Figma file, so everyone exporting it gets the same output. Files whose size variables hold rem numbers (e.g. `0.875`) must be changed to px (`14`) or re-imported from `css-to-dtcg --target figma`. The settings screen is now "Settings", with an Export section above GitHub.

### Patch Changes

- Updated dependencies [9be5f6a]
  - css-to-dtcg@0.3.0

## 1.0.0

### Major Changes

- First release: export Figma variables as W3C DTCG tokens, downloaded or as a GitHub pull request, with suggested scopes for variables left on "All scopes".
