import { useLocalSearchParams } from 'expo-router';
import { JourneyStopsScreen } from '@/features/journeys/JourneyStopsScreen';
export default function Stops() { const { id } = useLocalSearchParams<{ id: string }>(); return <JourneyStopsScreen id={id} />; }
