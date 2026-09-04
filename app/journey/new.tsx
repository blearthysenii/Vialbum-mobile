import { router } from 'expo-router';

import { NewJourneyForm } from '@/features/journeys/components/NewJourneyForm';

export default function NewJourneyScreen() {
  return (
    <NewJourneyForm
      onCancel={() => router.back()}
      onCreated={(id) =>
        router.replace({ pathname: '/journey/[id]', params: { id } })
      }
    />
  );
}
