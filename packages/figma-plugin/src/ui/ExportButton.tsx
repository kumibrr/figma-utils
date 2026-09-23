import { useEffect, useRef, useState } from 'preact/hooks';

import type { Destination } from '../shared/messages';
import { CheckIcon, ChevronIcon, DownloadIcon, GitHubIcon, Spinner } from './icons';
import { destinationLabel, type Format } from './state';

type Props = {
  destination: Destination;
  format: Format;
  disabled: boolean;
  busyText: string | null;
  onExport: () => void;
  onDestination: (destination: Destination) => void;
};

const DESTINATIONS: Destination[] = ['github', 'computer'];

export function ExportButton({ destination, format, disabled, busyText, onExport, onDestination }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const github = destination === 'github';

  return (
    <div ref={root} class={`split ${github ? 'split--github' : 'split--brand'}`}>
      <button class="split__main" disabled={disabled} onClick={onExport}>
        {busyText ? (
          <>
            <Spinner /> {busyText}
          </>
        ) : (
          <>
            {github ? <GitHubIcon /> : <DownloadIcon />} Export
          </>
        )}
      </button>
      <button
        class="split__toggle"
        aria-label="Choose export destination"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busyText !== null}
        onClick={() => setOpen(!open)}
      >
        <ChevronIcon />
      </button>
      {open && (
        <ul class="menu" role="menu">
          {DESTINATIONS.map((value) => (
            <li key={value}>
              <button
                class="menu__item"
                role="menuitemradio"
                aria-checked={destination === value}
                onClick={() => {
                  onDestination(value);
                  setOpen(false);
                }}
              >
                <span class="menu__check">{destination === value && <CheckIcon />}</span>
                {value === 'github' ? <GitHubIcon /> : <DownloadIcon />}
                {destinationLabel(value, format)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
