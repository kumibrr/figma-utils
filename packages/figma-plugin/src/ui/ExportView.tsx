import { useState } from 'preact/hooks';

import type { BuildResult } from '../core/build-export';
import type { Snapshot } from '../core/snapshot';
import { createClient } from '../github/client';
import { publish, type PublishStep } from '../github/publish';
import type { Destination, Prefs } from '../shared/messages';
import { downloadFile, downloadZip } from './download';
import { ErrorList } from './ErrorList';
import { ExportButton } from './ExportButton';
import { FileList } from './FileList';
import { GearIcon, RefreshIcon, Spinner } from './icons';
import { ResultBanner } from './ResultBanner';
import { call } from './rpc';
import {
  errorBanner,
  exportAction,
  exportBlocker,
  previewFiles,
  resultBanner,
  STEP_TEXT,
  type Banner,
  type Build,
  type Format,
} from './state';

type Props = {
  build: Build;
  prefs: Prefs;
  refresh: () => Promise<{ snapshot: Snapshot; result: BuildResult } | null>;
  onPrefs: (prefs: Prefs) => void;
  openSettings: () => void;
};

export function ExportView({ build, prefs, refresh, onPrefs, openSettings }: Props) {
  const [format, setFormat] = useState<Format>('multiple');
  const [step, setStep] = useState<PublishStep | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  const blocker = exportBlocker(build, step !== null);

  async function onExport() {
    setBanner(null);
    const fresh = await refresh();
    if (!fresh || exportBlocker({ status: 'ready', result: fresh.result }, false)) {
      return;
    }

    const action = exportAction({
      destination: prefs.destination,
      format,
      result: fresh.result,
      settings: prefs.settings,
      hasToken: prefs.hasToken,
    });

    if (action.kind === 'open-settings') return openSettings();
    if (action.kind === 'download-zip') return downloadZip(action.files);
    if (action.kind === 'download-file') return downloadFile(action.file);

    setStep('reading');
    try {
      const token = await call('getToken');
      if (!token || !prefs.settings) {
        openSettings();
        return;
      }
      const result = await publish(
        createClient(token),
        prefs.settings,
        { files: action.files, fileName: fresh.snapshot.fileName, userName: fresh.snapshot.userName, now: new Date() },
        setStep,
      );
      setBanner(resultBanner(result));
    } catch (error) {
      setBanner(errorBanner(error));
    } finally {
      setStep(null);
    }
  }

  function onDestination(destination: Destination) {
    onPrefs({ ...prefs, destination });
    void call('saveDestination', destination);
  }

  return (
    <div class="view">
      <header class="header">
        <h1 class="header__title">Export tokens</h1>
        <button class="icon-button" aria-label="GitHub settings" title="GitHub settings" onClick={openSettings}>
          <GearIcon />
        </button>
      </header>

      <div class="segmented" role="radiogroup" aria-label="Format">
        {(['single', 'multiple'] as const).map((value) => (
          <button
            key={value}
            role="radio"
            aria-checked={format === value}
            class={`segmented__option ${format === value ? 'is-selected' : ''}`}
            onClick={() => setFormat(value)}
          >
            {value === 'single' ? 'Single file' : 'Multiple files'}
          </button>
        ))}
      </div>

      <div class="preview-header">
        <h2 class="preview-header__title">Preview</h2>
        <button class="icon-button" aria-label="Refresh" title="Refresh" onClick={() => void refresh()}>
          <RefreshIcon />
        </button>
      </div>

      <div class="preview">
        {build.status === 'loading' && (
          <p class="muted">
            <Spinner /> Reading variables…
          </p>
        )}
        {build.status === 'failed' && <p class="danger">Couldn't read variables: {build.message}</p>}
        {build.status === 'ready' && build.result.errors.length > 0 && <ErrorList errors={build.result.errors} />}
        {build.status === 'ready' && build.result.errors.length === 0 && build.result.sets.length === 0 && (
          <p class="muted">No local variables in this file.</p>
        )}
        {build.status === 'ready' && build.result.errors.length === 0 && build.result.sets.length > 0 && (
          <FileList files={previewFiles(build.result, format)} onDownload={downloadFile} />
        )}
      </div>

      {banner && <ResultBanner banner={banner} onOpen={(url) => void call('openUrl', url)} />}

      <footer class="footer">
        <button class="button button--secondary" onClick={() => void call('close')}>
          Cancel
        </button>
        <ExportButton
          destination={prefs.destination}
          format={format}
          disabled={blocker !== null}
          busyText={step ? STEP_TEXT[step] : null}
          onExport={() => void onExport()}
          onDestination={onDestination}
        />
      </footer>
    </div>
  );
}
