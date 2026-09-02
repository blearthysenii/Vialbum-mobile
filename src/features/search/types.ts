export type JourneySearchResult = {
  type: 'journey'; id: string; title: string; destination: string; country: string;
  start_date: string; end_date: string; location: string | null; thumbnail_url: string | null;
};

export type MemorySearchResult = {
  type: 'memory'; id: string; journey_id: string; journey_title: string;
  journey_start_date: string; title: string; date: string; location: string | null; context: string | null;
};

export type PhotoSearchResult = {
  type: 'photo'; id: string; journey_id: string; journey_title: string; date: string;
  caption: string | null; location: string | null; memory_title: string | null; thumbnail_url: string | null;
};

export type SearchResult = JourneySearchResult | MemorySearchResult | PhotoSearchResult;
export type SearchResponse = {
  query: string;
  journeys: JourneySearchResult[];
  memories: MemorySearchResult[];
  photos: PhotoSearchResult[];
};

export type SearchSection = { title: 'Journeys' | 'Memories' | 'Photos'; data: SearchResult[] };
