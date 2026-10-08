import { useAuth } from '@/features/auth/AuthProvider';
import { MomentsFeed } from '@/features/moments/MomentsFeed';
export default function MomentsScreen() { const { user } = useAuth(); return <MomentsFeed key={user?.id} embedded />; }
