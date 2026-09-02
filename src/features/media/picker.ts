import * as ImagePicker from 'expo-image-picker';

import type { SelectedPhoto } from '@/features/media/types';

function exifDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : undefined;
}

export async function pickPhotos(): Promise<SelectedPhoto[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    exif: true,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.map((asset, index) => {
    const latitude = typeof asset.exif?.GPSLatitude === 'number' ? asset.exif.GPSLatitude : undefined;
    const longitude = typeof asset.exif?.GPSLongitude === 'number' ? asset.exif.GPSLongitude : undefined;
    return {
    key: asset.assetId ?? `${asset.uri}-${index}`,
    uri: asset.uri,
    name: asset.fileName ?? `vialbum-photo-${index + 1}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    width: asset.width,
    height: asset.height,
    capturedAt: exifDate(asset.exif?.DateTimeOriginal ?? asset.exif?.DateTimeDigitized),
    latitude: latitude !== undefined && asset.exif?.GPSLatitudeRef === 'S' ? -latitude : latitude,
    longitude: longitude !== undefined && asset.exif?.GPSLongitudeRef === 'W' ? -longitude : longitude,
  };
  });
}
