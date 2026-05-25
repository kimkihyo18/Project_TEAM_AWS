import https from 'https';
import http from 'http';
import { config } from '../config';

export interface BookingDetail {
  id: string;
  user_id: string;
  hotel_id: string;
  status: string;
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
            reject(new Error(parsed.message || 'booking-service error'));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error('Invalid JSON from booking-service'));
        }
      });
    }).on('error', reject);
  });
}

export async function getInternalBooking(bookingId: string): Promise<BookingDetail> {
  const url = `${config.internal.bookingService}/internal/bookings/${bookingId}`;
  const res = await request<{ success: boolean; data: BookingDetail }>(url);
  return res.data;
}
