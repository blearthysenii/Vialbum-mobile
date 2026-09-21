import { useAuth } from '@/features/auth/AuthProvider';
import { WorldMapScreen } from '@/features/world/WorldMapScreen';
export default function MapScreen() {
  const { user } = useAuth();
  return user ? <WorldMapScreen key={user.id} userId={user.id} /> : null;
}
