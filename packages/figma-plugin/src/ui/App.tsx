import { serialize } from 'css-to-dtcg/serialize';
import { useCallback, useEffect, useState } from 'preact/hooks';

import { buildExport } from '../core/build-export';
import type { Prefs } from '../shared/messages';
import { downloadText } from './download';
import { ExportView } from './ExportView';
import { call } from './rpc';
import { SettingsView } from './SettingsView';
import type { Build } from './state';

export function App() {
  const [build, setBuild] = useState<Build>({ status: 'loading' });
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [view, setView] = useState<'export' | 'settings'>('export');

  const refresh = useCallback(async () => {
    setBuild({ status: 'loading' });
    try {
      const snapshot = await call('getSnapshot');
      const result = buildExport(snapshot);
      setBuild({ status: 'ready', result });
      return { snapshot, result };
    } catch (error) {
      setBuild({ status: 'failed', message: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    void call('getPrefs').then(setPrefs);
  }, [refresh]);

  // Hidden developer shortcut: Alt+Shift+S downloads the raw snapshot, so a
  // team can run the build against their real file without committing it.
  useEffect(() => {
    const onKey = async (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === 'KeyS') {
        const snapshot = await call('getSnapshot');
        console.log(snapshot);
        downloadText('snapshot.json', serialize(snapshot));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!prefs) {
    return <p class="muted view">Loading…</p>;
  }

  return view === 'settings' ? (
    <SettingsView prefs={prefs} onPrefs={setPrefs} onDone={() => setView('export')} />
  ) : (
    <ExportView build={build} prefs={prefs} refresh={refresh} onPrefs={setPrefs} openSettings={() => setView('settings')} />
  );
}
