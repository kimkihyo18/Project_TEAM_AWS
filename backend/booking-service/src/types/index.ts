export interface Booking {
  id: string;
  user_id: string;
  host_id: string;
  hotel_id: string;
  hotel_name: string;
  hotel_address?: string;
  room_id: string;
  room_name: string;
  room_type: string;
  check_in_date: string;
  check_out_date: string;
  guests: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  special_requests?: string;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}
