export type PlaceSelection = {
  provider: string;
  provider_place_id: string;
  display_name: string;
  name: string;
  locality: string | null;
  region: string | null;
  country: string;
  country_code: string;
  latitude: string;
  longitude: string;
};

export type Place = PlaceSelection & {
  id: string;
  created_at: string;
  updated_at: string;
};
