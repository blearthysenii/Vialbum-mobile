import { useLocalSearchParams } from 'expo-router';
import { EditPostScreen } from '@/features/posts/EditPostScreen';

export default function EditJourneyScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  return <EditPostScreen key={id} id={id} action={action} />;
}
