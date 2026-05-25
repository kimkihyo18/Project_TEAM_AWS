export interface Hotel {
  id: string;
  host_id: string;
  name: string;
  description: string;
  category: 'hotel' | 'motel' | 'pension' | 'guesthouse' | 'resort' | 'camping';
  address: string;
  city: string;
  region: string;
  latitude?: number;
  longitude?: number;
  amenities: string;
  images: string;
  check_in_time: string;
  check_out_time: string;
  rating: number;
  review_count: number;
  is_active: boolean;
  video_url?: string | null;
  video_status?: 'none' | 'processing' | 'ready';
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  hotel_id: string;
  name: string;
  description: string;
  type: 'standard' | 'deluxe' | 'suite' | 'family' | 'dormitory';
  capacity: number;
  price_per_night: number;
  discount_rate: number;
  images: string;
  amenities: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

export interface SearchQuery {
  city?: string;
  region?: string;
  category?: string;
  check_in?: string;
  check_out?: string;
  guests?: number;
  min_price?: number;
  max_price?: number;
  amenities?: string[];
  sort_by?: 'price_asc' | 'price_desc' | 'rating' | 'popular';
  page?: number;
  limit?: number;
}
