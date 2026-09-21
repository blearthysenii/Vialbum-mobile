import { useAuth } from '@/features/auth/AuthProvider';
import { ExploreScreen } from '@/features/explore/ExploreScreen';
export default function SearchScreen() {
  const { user } = useAuth();
  return <ExploreScreen key={user?.id} />;
}
