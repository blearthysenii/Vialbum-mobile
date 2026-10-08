import * as ImagePicker from 'expo-image-picker';

import type { SelectedPhoto } from '@/features/media/types';

function exifDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : undefined;
}

export async function pickPhotos({ includeVideos = false, compatible = false, selectionLimit = 0 }: { includeVideos?: boolean; compatible?: boolean; selectionLimit?: number } = {}): Promise<SelectedPhoto[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: includeVideos ? ['images', 'videos'] : ['images'],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit,
    exif: !compatible,
    quality: compatible ? 0.85 : 1,
    preferredAssetRepresentationMode: compatible ? ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible : ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });
  if (result.canceled) return [];
  return result.assets.map((asset, index) => {
    const latitude = typeof asset.exif?.GPSLatitude === 'number' ? asset.exif.GPSLatitude : undefined;
    const longitude = typeof asset.exif?.GPSLongitude === 'number' ? asset.exif.GPSLongitude : undefined;
    return {
    type: asset.type === 'video' ? 'video' : 'photo',
    duration: asset.duration ? asset.duration / 1000 : undefined,
    libraryId: asset.assetId ?? undefined,
    key: asset.assetId ?? `${asset.uri}-${index}`,
    uri: asset.uri,
    name: asset.fileName ?? `vialbum-photo-${index + 1}.jpg`,
    mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/quicktime' : 'image/jpeg'),
    width: asset.width,
    height: asset.height,
    capturedAt: exifDate(asset.exif?.DateTimeOriginal ?? asset.exif?.DateTimeDigitized),
    latitude: latitude !== undefined && asset.exif?.GPSLatitudeRef === 'S' ? -latitude : latitude,
    longitude: longitude !== undefined && asset.exif?.GPSLongitudeRef === 'W' ? -longitude : longitude,
  };
  });
}
