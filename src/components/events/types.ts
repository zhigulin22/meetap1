export type EventPerson = {
  id: string;
  name: string;
  avatar_url: string | null;
};

export type EventListItem = {
  id: string;
  source_kind: "external" | "community";
  category: string;
  title: string;
  short_description: string;
  full_description: string;
  city: string;
  venue_name: string;
  venue_address: string;
  starts_at: string;
  ends_at: string | null;
  cover_url: string | null;
  is_paid: boolean;
  price: number;
  price_note: string | null;
  external_source: string | null;
  external_url: string | null;
  organizer_telegram: string | null;
  social_mode: string;
  participant_limit: number | null;
  looking_for_count: number | null;
  status: string;
  is_today: boolean;
  participants: EventPerson[];
  going_count: number;
  companion_count: number;
  joined: boolean;
  looking_company: boolean;
};
