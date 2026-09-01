export type MapItemType = 'journey' | 'memory' | 'photo';

export type MapItem = {
  type: MapItemType;
  id: string;
  journey_id: string;
  latitude: string;
  longitude: string;
  title: string;
  subtitle: string | null;
  date: string | null;
  thumbnail_url: string | null;
  thumbnail_revision: string | null;
  caption: string | null;
  location: string | null;
  journey_start_date: string;
  journey_end_date: string;
  memory_id: string | null;
  memory_title: string | null;
};

export type MapFilter = 'all' | MapItemType;

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
