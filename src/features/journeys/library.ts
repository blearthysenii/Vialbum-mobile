import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type * as MediaLibrary from 'expo-media-library/legacy';
import type { SelectedPhoto } from '@/features/media/types';
import { mediaCoordinate } from './draft';

// Do not evaluate a native-only module on web or in an older development build.
export function deviceLibrary(): typeof MediaLibrary | null {
  if (Platform.OS === 'web' || !requireOptionalNativeModule('ExpoMediaLibrary')) return null;
  // The guarded synchronous import keeps older native builds and web usable.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-media-library/legacy') as typeof MediaLibrary;
}
export function assetPhoto(asset: MediaLibrary.Asset): SelectedPhoto {
  const extension = asset.filename.split('.').pop()?.toLowerCase();
  return { type: asset.mediaType === 'video' ? 'video' : 'photo', duration: asset.duration || undefined, key: asset.id, libraryId: asset.id, uri: asset.uri, name: asset.filename,
    mimeType: asset.mediaType === 'video' ? extension === 'mov' ? 'video/quicktime' : 'video/mp4' : extension === 'png' ? 'image/png' : extension === 'heic' ? 'image/heic' : extension === 'heif' ? 'image/heif' : 'image/jpeg',
    width: asset.width, height: asset.height,
    capturedAt: asset.creationTime ? new Date(asset.creationTime).toISOString() : undefined };
}
export async function resolvePhoto(photo: SelectedPhoto): Promise<SelectedPhoto> {
  if (!photo.uri.startsWith('ph://') && !photo.uri.startsWith('assets-library://')) return photo;
  const library = deviceLibrary();
  if (!library || !photo.libraryId) throw new Error('This photo is unavailable. Choose it again with the system photo picker.');
  const info = await library.getAssetInfoAsync(photo.libraryId, { shouldDownloadFromNetwork: true });
  if (!info.localUri) throw new Error('This photo could not be downloaded from iCloud. Check your connection and try again.');
  return { ...photo, uri: info.localUri, latitude: mediaCoordinate(info.location?.latitude, 90), longitude: mediaCoordinate(info.location?.longitude, 180) };
}
