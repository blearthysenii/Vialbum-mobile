import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { ConnectionsScreen } from '@/features/follows/ConnectionsScreen';
export default function ConnectionsRoute() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  const { user } = useAuth();
  if (!user || id !== user.id) return <Redirect href="/(tabs)/profile" />;
  const selected = kind === 'followers' ? 'followers' : 'following';
  return <ConnectionsScreen key={`${id}:${selected}`} kind={selected} />;
}
