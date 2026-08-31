import { router } from 'expo-router';

import { useJourneys } from '@/features/journeys/JourneyProvider';
import { JourneyForm, JourneyFormValues } from '@/features/journeys/components/JourneyForm';

const today = new Date().toISOString().slice(0, 10);

export default function NewJourneyScreen() {
  const { create } = useJourneys();
  async function submit(values: JourneyFormValues) {
    const journey = await create(values);
    router.replace({ pathname: '/journey/[id]', params: { id: journey.id } });
  }
  return <JourneyForm eyebrow="NEW ALBUM" heading="Where will your memories live?" submitLabel="Create Journey" initialValues={{ title: '', destination: '', country: '', start_date: today, end_date: today, description: null, latitude: null, longitude: null }} onSubmit={submit} onCancel={() => router.back()} />;
}
