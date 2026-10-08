import { useAuth } from '@/features/auth/AuthProvider';
import { DestinationCatalog } from '@/features/explore/DestinationCatalog';
export default function DestinationsRoute() { const { user } = useAuth(); return <DestinationCatalog key={user?.id} />; }
