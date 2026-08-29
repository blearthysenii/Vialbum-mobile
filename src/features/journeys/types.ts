export type Journey = {
  id: string;
  title: string;
  destination: string;
  country: string;
  start_date: string;
  end_date: string;
  description: string | null;
  cover_media_url: string | null;
  created_at: string;
  updated_at: string;
};

export type JourneyInput = Pick<
  Journey,
  'title' | 'destination' | 'country' | 'start_date' | 'end_date' | 'description'
> & { cover_media_url?: string | null };

export type JourneyUpdate = Partial<JourneyInput>;
