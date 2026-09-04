import { router } from 'expo-router';
import { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JourneyCard } from '@/components/JourneyCard';
import {
  EmptyState,
  ErrorBanner,
} from '@/components/ui/Feedback';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
import { colors } from '@/theme/colors';

function Skeletons() {
  return (
    <>
      {[0, 1].map((item) => (
        <View
          key={item}
          style={styles.skeleton}
        >
          <View style={styles.skeletonCountry} />
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonLocation} />
        </View>
      ))}
    </>
  );
}

export default function HomeScreen() {
  const tabBarScroll = useTabBarScroll();
  const {
    journeys,
    isLoading,
    error,
    refresh,
  } = useJourneys();

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  async function pullToRefresh() {
    setIsRefreshing(true);

    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top']}
    >
      <ScrollView
        {...tabBarScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          !isLoading &&
            journeys.length === 0 &&
            styles.grow,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={pullToRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* VIALBUM */}
        <View style={styles.brandRow}>
          <Text style={styles.brand}>
            Vialbum
          </Text>
        </View>

        {/* TITLE */}
        <View style={styles.headingRow}>
          <Text style={styles.heading}>
            Your Journeys
          </Text>
        </View>

        {/* JOURNEYS */}
        <View style={styles.journeyList}>
          {isLoading ? (
            <Skeletons />
          ) : null}

          {!isLoading && error ? (
            <View style={styles.feedback}>
              <ErrorBanner
                message={error}
                onRetry={() =>
                  void refresh()
                }
              />
            </View>
          ) : null}

          {!isLoading &&
          !error &&
          journeys.length === 0 ? (
            <EmptyState
              title="Your journeys will live here."
              message="Create an album for the places, photographs, and small moments you want to remember."
              actionLabel="Create your first journey"
              onAction={() =>
                router.push('/journey/new')
              }
              mark="V"
            />
          ) : null}

          {!isLoading && !error
            ? journeys.map((journey) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                />
              ))
            : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },

  content: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 150,
  },

  grow: {
    flexGrow: 1,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 68,
  },

  brand: {
    color: colors.ink,

    fontSize: 28,
    fontWeight: '900',

    letterSpacing: -1.4,
    lineHeight: 32,
  },

  headingRow: {
    marginBottom: 32,
  },

  heading: {
    color: colors.ink,

    fontSize: 48,
    fontWeight: '900',

    letterSpacing: -2.4,
    lineHeight: 52,
  },

  journeyList: {
    gap: 24,
  },

  feedback: {
    marginTop: 4,
  },

  skeleton: {
    height: 220,

    borderRadius: 24,

    backgroundColor: '#E5E1D7',

    justifyContent: 'flex-end',

    paddingHorizontal: 24,
    paddingVertical: 20,

    overflow: 'hidden',
  },

  skeletonCountry: {
    width: 120,
    height: 12,

    marginBottom: 14,

    borderRadius: 6,

    backgroundColor: '#D4CFC3',
  },

  skeletonTitle: {
    width: '72%',
    height: 36,

    marginBottom: 14,

    borderRadius: 10,

    backgroundColor: '#D0CABE',
  },

  skeletonLocation: {
    width: 90,
    height: 18,

    borderRadius: 8,

    backgroundColor: '#D4CFC3',
  },
});
