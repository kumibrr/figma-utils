---
'export-design-tokens': major
---

Size variables are now read as px and exported as rem, divided by a base font size set in Settings (default 16px) and saved in the Figma file, so everyone exporting it gets the same output. Files whose size variables hold rem numbers (e.g. `0.875`) must be changed to px (`14`) or re-imported from `css-to-dtcg --target figma`. The settings screen is now "Settings", with an Export section above GitHub.
