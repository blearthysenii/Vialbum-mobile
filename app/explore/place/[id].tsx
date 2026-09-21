import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlaceExploreScreen } from '@/features/explore/PlaceExploreScreen';
export default function PlaceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return <PlaceExploreScreen key={`${user?.id}:${id}`} id={id} />;
}
