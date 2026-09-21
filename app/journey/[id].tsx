import { Redirect, useLocalSearchParams } from 'expo-router';

export default function JourneyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/post/[id]', params: { id, scope: 'own' } }} />;
}
