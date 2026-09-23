import type { ExportFile } from '../core/files';
import { DownloadIcon, FileIcon } from './icons';

export function FileList({ files, onDownload }: { files: ExportFile[]; onDownload: (file: ExportFile) => void }) {
  return (
    <ul class="files">
      {files.map((file) => (
        <li key={file.path}>
          <button class="file" title={`Download ${file.path}`} onClick={() => onDownload(file)}>
            <FileIcon />
            <span class="file__name">{file.path}</span>
            <span class="file__download">
              <DownloadIcon />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
