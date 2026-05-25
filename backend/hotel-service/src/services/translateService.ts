import { config, isLocal } from '../config';
import logger from '../utils/logger';

// 번역 캐시 (DynamoDB로 교체 가능)
const memCache = new Map<string, string>();

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || targetLang === 'ko') return text;

  const cacheKey = `${targetLang}:${text.slice(0, 80)}`;
  if (memCache.has(cacheKey)) return memCache.get(cacheKey)!;

  if (!config.azure.translatorKey) {
    logger.warn('Azure Translator key not configured, skipping translation');
    return text;
  }

  try {
    const body = JSON.stringify([{ text }]);
    const url  = `${config.azure.translatorEndpoint}/translate?api-version=3.0&from=ko&to=${targetLang}`;

    const https = require('https');
    const parsed = await new Promise<any>((resolve, reject) => {
      const req = https.request(url, {
        method:  'POST',
        headers: {
          'Ocp-Apim-Subscription-Key':    config.azure.translatorKey,
          'Ocp-Apim-Subscription-Region': config.azure.translatorRegion,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res: any) => {
        let data = '';
        res.on('data', (c: string) => { data += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON from Azure Translator')); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    const translated = parsed?.[0]?.translations?.[0]?.text ?? text;
    memCache.set(cacheKey, translated);
    return translated;
  } catch (err) {
    logger.error('Azure translation failed', { err });
    return text;
  }
}

export async function translateFields<T extends Record<string, any>>(
  items: T[],
  fields: (keyof T)[],
  targetLang: string
): Promise<T[]> {
  if (targetLang === 'ko' || !targetLang) return items;

  return Promise.all(
    items.map(async item => {
      const translated = { ...item };
      for (const field of fields) {
        if (typeof item[field] === 'string') {
          (translated as any)[field] = await translateText(item[field] as string, targetLang);
        }
      }
      return translated;
    })
  );
}
