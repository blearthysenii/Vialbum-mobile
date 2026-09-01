import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JourneyCard } from '@/components/JourneyCard';
import { EmptyState, ErrorBanner } from '@/components/ui/Feedback';
import { ScreenHeader } from '@/components/ui/Headers';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { colors } from '@/theme/colors';

function Skeletons() {
  return <>{[0, 1].map((item) => <View key={item} style={styles.skeleton}><View style={styles.skeletonLine} /><View style={styles.skeletonTitle} /></View>)}</>;
}

export default function HomeScreen() {
  const { journeys, isLoading, error, refresh } = useJourneys();
  const [isRefreshing, setIsRefreshing] = useState(false);
  async function pullToRefresh() {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, !isLoading && journeys.length === 0 && styles.grow]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={pullToRefresh} tintColor={colors.accent} />}>
        <View style={styles.brandRow}><Text style={styles.brand}>Vialbum</Text><Text style={styles.mark}>V</Text></View>
        <ScreenHeader title="Your Journeys" trailing={journeys.length > 0 ? <Link href="/journey/new" asChild><Pressable accessibilityRole="button" accessibilityLabel="Create a new journey" style={styles.newButton}><Text style={styles.newText}>New Journey</Text></Pressable></Link> : null} />
        {isLoading ? <Skeletons /> : null}
        {!isLoading && error ? <View style={styles.feedback}><ErrorBanner message={error} onRetry={() => void refresh()} /></View> : null}
        {!isLoading && !error && journeys.length === 0 ? <EmptyState title="Your journeys will live here." message="Create an album for the places, photographs, and small moments you want to remember." actionLabel="Create your first journey" onAction={() => router.push('/journey/new')} mark="V" /> : null}
        {!isLoading && !error ? journeys.map((journey) => <JourneyCard key={journey.id} journey={journey} />) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 36, gap: 18 }, grow: { flexGrow: 1 }, brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, brand: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.7 }, mark: { color: colors.canvas, backgroundColor: colors.ink, width: 32, height: 32, borderRadius: 16, textAlign: 'center', lineHeight: 32, fontSize: 13, fontWeight: '800' }, newButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, newText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  skeleton: { height: 390, borderRadius: 28, backgroundColor: '#E5E1D7', marginBottom: 20, justifyContent: 'flex-end', padding: 22 }, skeletonLine: { height: 12, width: 80, borderRadius: 6, backgroundColor: '#D4CFC3', marginBottom: 12 }, skeletonTitle: { height: 38, width: '70%', borderRadius: 10, backgroundColor: '#D0CABE' },
  feedback: { marginTop: 8 },
});
