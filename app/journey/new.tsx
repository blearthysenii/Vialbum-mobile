import { router, useLocalSearchParams } from 'expo-router';
import { NewJourneyForm } from '@/features/journeys/components/NewJourneyForm';

export default function NewJourneyScreen() {
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  return <NewJourneyForm draftId={draftId} onCancel={() => router.back()} onCreated={id => router.replace({ pathname: '/post/[id]', params: { id, scope: 'own' } })} />;
}
