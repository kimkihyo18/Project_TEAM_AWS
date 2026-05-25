export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  profile_image?: string;
  role: 'user' | 'host' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}
