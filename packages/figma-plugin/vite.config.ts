import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'src/ui',
  plugins: [preact(), viteSingleFile()],
  build: { outDir: '../../dist', emptyOutDir: true },
});
