import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useJourneys } from '@/features/journeys/JourneyProvider';
import { JourneyForm, JourneyFormValues } from '@/features/journeys/components/JourneyForm';
import { colors } from '@/theme/colors';

export default function EditJourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { journeys, fetchOne, update } = useJourneys();
  const journey = journeys.find((item) => item.id === id);
  useEffect(() => {
    if (!journey) void fetchOne(id).catch(() => router.back());
  }, [fetchOne, id, journey]);
  if (!journey) return <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>;
  async function submit(values: JourneyFormValues) { await update(id, values); router.back(); }
  return <JourneyForm eyebrow="EDIT ALBUM" heading="Refine your journey." submitLabel="Save Changes" initialValues={{ title: journey.title, destination: journey.destination, country: journey.country, start_date: journey.start_date, end_date: journey.end_date, description: journey.description }} onSubmit={submit} onCancel={() => router.back()} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' } });
