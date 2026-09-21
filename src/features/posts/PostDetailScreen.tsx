import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/AuthProvider';
import { DiscoverError } from '@/features/discover/components/DiscoverFeedback';
import { useProfileTheme } from '@/features/profile/theme';
import { colors } from '@/theme/colors';
import { usePostDetail } from './usePostDetail';
import { PostContent, PostSkeleton } from './PostContent';
import { PostGlassButton } from './PostGlassButton';
import { PostMenu } from './PostMenu';

export function PostDetailScreen({ id, own = false, memoryId }: { id: string; own?: boolean; memoryId?: string }) {
  const { user } = useAuth();
  const theme = useProfileTheme();
  const { journey, error, refresh, initialLoading } = usePostDetail(id, own, user);
  const owner = Boolean(user && journey?.creator.id === user.id);
  const openJourney = () => { if (owner) router.push(`/journey/edit/${id}`); };
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.dark ? theme.glassStrong : colors.tab }}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <View style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <PostGlassButton theme={theme} label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')}  ><Ionicons name="chevron-back" size={25} color={theme.ink} /></PostGlassButton>
      <Text accessibilityRole="header" style={{ color: theme.ink, fontSize: 17, fontWeight: '600' }}>Post</Text>
      {journey ? <PostMenu journey={journey} owner={owner} theme={theme} /> : <View style={{ width: 44 }} />}
    </View>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      {journey ? <PostContent key={`${journey.id}:${memoryId ?? ''}`} journey={journey} theme={theme} own={owner} memoryId={memoryId} onOpen={openJourney} onRefresh={refresh} /> : initialLoading ? <PostSkeleton theme={theme} /> : null}
      {error ? <DiscoverError message={error} theme={theme} onRetry={refresh} /> : null}
    </ScrollView>
  </SafeAreaView>;
}
