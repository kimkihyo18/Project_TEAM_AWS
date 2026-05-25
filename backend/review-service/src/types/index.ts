export interface Review {
  id: string;
  user_id: string;
  hotel_id: string;
  booking_id: string;
  rating: number;
  title: string;
  content: string;
  images: string;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}
