import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JourneyCard } from '@/components/JourneyCard';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { colors } from '@/theme/colors';

function Skeletons() {
  return <>{[0, 1].map((item) => <View key={item} style={styles.skeleton}><View style={styles.skeletonLine} /><View style={styles.skeletonTitle} /></View>)}</>;
}

function EmptyState() {
  return <View style={styles.empty}><View style={styles.emptyMark}><Text style={styles.emptyMarkText}>＋</Text></View><Text style={styles.emptyTitle}>Your journeys will live here.</Text><Text style={styles.emptyCopy}>Create an album for the places, photographs, and small moments you want to remember.</Text><Link href="/journey/new" asChild><Pressable style={styles.emptyButton}><Text style={styles.emptyButtonText}>Create your first journey</Text></Pressable></Link></View>;
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
        <View style={styles.headingRow}><Text style={styles.heading}>Your Journeys</Text>{journeys.length > 0 ? <Link href="/journey/new" asChild><Pressable style={styles.newButton}><Text style={styles.plus}>＋</Text><Text style={styles.newText}>New Journey</Text></Pressable></Link> : null}</View>
        {isLoading ? <Skeletons /> : null}
        {!isLoading && error ? <View style={styles.errorState}><Text style={styles.errorTitle}>We could not reach your journeys.</Text><Text style={styles.errorCopy}>{error}</Text><Pressable onPress={refresh} style={styles.retry}><Text style={styles.retryText}>Try Again</Text></Pressable></View> : null}
        {!isLoading && !error && journeys.length === 0 ? <EmptyState /> : null}
        {!isLoading && !error ? journeys.map((journey) => <JourneyCard key={journey.id} journey={journey} />) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 36 }, grow: { flexGrow: 1 }, brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 34 }, brand: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.7 }, mark: { color: colors.canvas, backgroundColor: colors.ink, width: 32, height: 32, borderRadius: 16, textAlign: 'center', lineHeight: 32, fontSize: 13, fontWeight: '800' }, headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }, heading: { color: colors.ink, fontSize: 30, fontWeight: '700', letterSpacing: -1.2 }, newButton: { flexDirection: 'row', alignItems: 'center', gap: 3 }, plus: { color: colors.accent, fontSize: 19 }, newText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  skeleton: { height: 390, borderRadius: 28, backgroundColor: '#E5E1D7', marginBottom: 20, justifyContent: 'flex-end', padding: 22 }, skeletonLine: { height: 12, width: 80, borderRadius: 6, backgroundColor: '#D4CFC3', marginBottom: 12 }, skeletonTitle: { height: 38, width: '70%', borderRadius: 10, backgroundColor: '#D0CABE' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 70, paddingHorizontal: 20 }, emptyMark: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#E5DED0', alignItems: 'center', justifyContent: 'center' }, emptyMarkText: { color: colors.accent, fontSize: 32 }, emptyTitle: { color: colors.ink, fontSize: 27, fontWeight: '800', textAlign: 'center', marginTop: 24, letterSpacing: -0.8 }, emptyCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 310 }, emptyButton: { backgroundColor: colors.ink, borderRadius: 17, paddingHorizontal: 24, paddingVertical: 17, marginTop: 28 }, emptyButtonText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }, errorTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' }, errorCopy: { color: colors.muted, textAlign: 'center', marginTop: 8 }, retry: { marginTop: 22, borderWidth: 1, borderColor: colors.line, borderRadius: 15, paddingHorizontal: 22, paddingVertical: 13 }, retryText: { color: colors.accent, fontWeight: '800' },
});
