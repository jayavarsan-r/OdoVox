/** Connection lifecycle the socket client exposes; drives the top-bar dot + offline banner. */
export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface StatusIndicator {
  /** Design-system tone for the dot: lime (live), amber (in-flight), danger (offline). */
  tone: 'lime' | 'amber' | 'danger';
  label: string;
  live: boolean;
  /** Whether to show the "Reconnecting…" banner under the top bar. */
  showBanner: boolean;
}

export function statusIndicator(status: RealtimeStatus): StatusIndicator {
  switch (status) {
    case 'connected':
      return { tone: 'lime', label: 'Live', live: true, showBanner: false };
    case 'connecting':
      return { tone: 'amber', label: 'Connecting…', live: false, showBanner: false };
    case 'reconnecting':
      return { tone: 'amber', label: 'Reconnecting…', live: false, showBanner: true };
    case 'disconnected':
      return { tone: 'danger', label: 'Offline', live: false, showBanner: true };
  }
}
