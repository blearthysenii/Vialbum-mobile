import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { LoadingState } from '@/components/ui/Feedback';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { JourneyForm, JourneyFormValues } from '@/features/journeys/components/JourneyForm';

export default function EditJourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { journeys, fetchOne, update } = useJourneys();
  const journey = journeys.find((item) => item.id === id);
  useEffect(() => {
    if (!journey) void fetchOne(id).catch(() => router.back());
  }, [fetchOne, id, journey]);
  if (!journey) return <LoadingState fullScreen label="Opening journey details…" />;
  async function submit(values: JourneyFormValues) { await update(id, values); router.back(); }
  return <JourneyForm eyebrow="EDIT ALBUM" heading="Refine your journey." submitLabel="Save Changes" initialValues={{ title: journey.title, destination: journey.destination, country: journey.country, start_date: journey.start_date, end_date: journey.end_date, description: journey.description, latitude: journey.latitude, longitude: journey.longitude, place: journey.place ?? undefined }} onSubmit={submit} onCancel={() => router.back()} />;
}
