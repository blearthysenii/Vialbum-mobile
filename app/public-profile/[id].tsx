import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { PublicJourneyCollection } from '@/features/publicProfile/PublicJourneyCollection';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  if (id === user?.id) return <Redirect href="/(tabs)/profile" />;
  return <PublicJourneyCollection key={id} ownerId={id} />;
}
