export type ExportState = 'idle' | 'preparing' | 'sharing';

export function safeExportFilename(title: string, year?: string) {
  const safe = title.normalize('NFKD').replace(/[^\w -]/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'Journey';
  return `Vialbum-${safe}${year ? `-${year}` : ''}.zip`;
}

export function parseExportError(body: string, status: number) {
  try {
    const payload = JSON.parse(body);
    if (typeof payload?.detail === 'string') return payload.detail;
  } catch {}
  return status === 401
    ? 'Your session has expired. Please sign in again.'
    : 'Vialbum could not prepare this export. Please try again.';
}

export function exportStateMessage(state: ExportState) {
  if (state === 'preparing') return 'Preparing and downloading your private export…';
  if (state === 'sharing') return 'Your export is ready. Opening sharing options…';
  return null;
}

export function isSuccessfulDownload(status: number) {
  return status >= 200 && status < 300;
}
