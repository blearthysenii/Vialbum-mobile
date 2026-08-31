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
  caption: string | null;
};

export type MapFilter = 'all' | MapItemType;
