export default {
  outDir: 'tokens',
  figmaOutDir: 'figma',
  sets: [
    { name: 'primitives', file: 'src/css/colors.css', selector: ':root' },
    { name: 'semantic/brand/nova', file: 'src/css/brands.css', selector: ":root, [data-brand='nova']" },
    { name: 'semantic/brand/orbit', file: 'src/css/brands.css', selector: "[data-brand='orbit']" },
    { name: 'semantic/brand/ember', file: 'src/css/brands.css', selector: "[data-brand='ember']" },
    { name: 'semantic/theme/light', file: 'src/css/theme.css', selector: ':root' },
    { name: 'semantic/theme/dark', file: 'src/css/theme.css', selector: "[data-mode='dark']" },
    { name: 'typography', file: 'src/css/typography.css', selector: ':root' },
  ],
  themes: {
    Brand: ['semantic/brand/nova', 'semantic/brand/orbit', 'semantic/brand/ember'],
    Theme: ['semantic/theme/light', 'semantic/theme/dark'],
  },
};
