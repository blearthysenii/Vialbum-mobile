import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { apiBaseUrl, ApiError } from '@/api/client';
import { tokenStorage } from '@/features/auth/storage';
import type { ExportState } from '@/features/exports/utils';
import { isSuccessfulDownload, parseExportError } from '@/features/exports/utils';

async function exportAndShare(path: string, filename: string, onState: (state: ExportState) => void) {
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new ApiError('Temporary file storage is unavailable.', 0);
  const token = await tokenStorage.get();
  if (!token) throw new ApiError('Your session has expired. Please sign in again.', 401);
  const fileUri = `${directory}${Date.now()}-${filename}`;
  onState('preparing');
  try {
    const result = await FileSystem.downloadAsync(`${apiBaseUrl()}${path}`, fileUri, {
      headers: { Accept: 'application/zip', Authorization: `Bearer ${token}` },
    });
    if (!isSuccessfulDownload(result.status)) {
      const body = await FileSystem.readAsStringAsync(fileUri).catch(() => '');
      throw new ApiError(parseExportError(body, result.status), result.status);
    }
    if (!(await Sharing.isAvailableAsync())) {
      throw new ApiError('Sharing is not available on this device.', 0);
    }
    onState('sharing');
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/zip', UTI: 'com.pkware.zip-archive', dialogTitle: 'Save your Vialbum export',
    });
  } finally {
    await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
  }
}

export const exportApi = {
  journey: (journeyId: string, includeMedia: boolean, filename: string, onState: (state: ExportState) => void) =>
    exportAndShare(`/journeys/${journeyId}/export?include_media=${includeMedia}`, filename, onState),
  account: (onState: (state: ExportState) => void) =>
    exportAndShare('/account/export', 'Vialbum-Account-Export.zip', onState),
};
