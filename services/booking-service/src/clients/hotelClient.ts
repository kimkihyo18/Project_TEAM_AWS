import https from 'https';
import http from 'http';
import { config } from '../config';

export interface RoomDetail {
  id: string;
  hotel_id: string;
  host_id: string;
  hotel_name: string;
  hotel_address: string;
  hotel_images: string;
  name: string;
  type: string;
  capacity: number;
  price_per_night: number;
  discount_rate: number;
  is_available: boolean;
}

function request<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const lib     = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'x-internal-secret': config.internal.secret,
        'Content-Type':      'application/json',
      },
    };

    lib.get(url, options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.message || 'hotel-service error'));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error('Invalid JSON from hotel-service'));
        }
      });
    }).on('error', reject);
  });
}

export async function getInternalRoom(hotelId: string, roomId: string): Promise<RoomDetail> {
  const url = `${config.internal.hotelService}/internal/hotels/${hotelId}/rooms/${roomId}`;
  const res = await request<{ success: boolean; data: RoomDetail }>(url);
  return res.data;
}
