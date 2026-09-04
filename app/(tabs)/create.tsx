import { router } from 'expo-router';

import { NewJourneyForm } from '@/features/journeys/components/NewJourneyForm';

export default function CreateTabScreen() {
  return (
    <NewJourneyForm
      embedded
      onCreated={(id) =>
        router.push({ pathname: '/journey/[id]', params: { id } })
      }
    />
  );
}
