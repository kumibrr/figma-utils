import { strToU8, zipSync } from 'fflate';

import type { ExportFile } from '../core/files';

export const zipFiles = (files: ExportFile[]): Uint8Array =>
  zipSync(Object.fromEntries(files.map((file) => [`tokens/${file.path}`, strToU8(file.json)])));

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadText = (name: string, text: string) =>
  downloadBlob(name, new Blob([text], { type: 'application/json' }));

/** Browsers cannot create folders, so a single file downloads under its own name. */
export const downloadFile = (file: ExportFile) => downloadText(file.path.split('/').at(-1) ?? file.path, file.json);

export const downloadZip = (files: ExportFile[]) =>
  downloadBlob('tokens.zip', new Blob([new Uint8Array(zipFiles(files))], { type: 'application/zip' }));
