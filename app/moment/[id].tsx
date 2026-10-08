import { useLocalSearchParams } from 'expo-router';
import { MomentsFeed } from '@/features/moments/MomentsFeed';
export default function MomentScreen() {
  const { id, ownerId, placeId, saved } = useLocalSearchParams<{ id: string; ownerId?: string; placeId?: string; saved?: string }>();
  return <MomentsFeed key={id} initialId={id} filter={{ owner_id: ownerId, place_id: placeId, saved: saved === '1' }} />;
}
