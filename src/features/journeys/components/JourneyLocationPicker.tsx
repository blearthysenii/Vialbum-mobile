import { LocationPicker, type LocationSelection } from '@/features/places/components/LocationPicker';
import type { PlaceSelection } from '@/features/places/types';

export type JourneyLocationSelection = LocationSelection;

type Props = {
  latitude: string | null;
  longitude: string | null;
  place: PlaceSelection | null;
  onCancel: () => void;
  onChange: (selection: JourneyLocationSelection | null) => void;
};

export function JourneyLocationPicker(props: Props) {
  return <LocationPicker {...props} entityLabel="Journey" />;
}
