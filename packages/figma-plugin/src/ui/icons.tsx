const Svg = ({ children, size = 16 }: { children: preact.ComponentChildren; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {children}
  </svg>
);

export const FileIcon = () => (
  <Svg>
    <path d="M4 1.5h5L12.5 5v9.5h-8.5z" stroke="currentColor" />
    <path d="M9 1.5V5h3.5" stroke="currentColor" />
  </Svg>
);

export const DownloadIcon = () => (
  <Svg>
    <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13.5h10" stroke="currentColor" stroke-linecap="round" />
  </Svg>
);

export const ChevronIcon = () => (
  <Svg>
    <path d="m4.5 6.5 3.5 3.5 3.5-3.5" stroke="currentColor" stroke-linecap="round" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg>
    <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-linecap="round" />
  </Svg>
);

export const GearIcon = () => (
  <Svg>
    <circle cx="8" cy="8" r="2" stroke="currentColor" />
    <path
      d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
      stroke="currentColor"
      stroke-linecap="round"
    />
  </Svg>
);

export const RefreshIcon = () => (
  <Svg>
    <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5v2.5h-2.5" stroke="currentColor" stroke-linecap="round" />
  </Svg>
);

/** Octicons "mark-github" (MIT). */
export const GitHubIcon = () => (
  <Svg>
    <path
      fill="currentColor"
      d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
    />
  </Svg>
);

export const Spinner = () => <span class="spinner" aria-hidden="true" />;
