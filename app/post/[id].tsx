import { useLocalSearchParams } from 'expo-router';
import { PostDetailScreen } from '@/features/posts/PostDetailScreen';

export default function PostRoute() {
  const { id, scope, memoryId } = useLocalSearchParams<{ id: string; scope?: string; memoryId?: string }>();
  return <PostDetailScreen key={`${id}:${scope}:${memoryId}`} id={id} own={scope === 'own'} memoryId={memoryId} />;
}
