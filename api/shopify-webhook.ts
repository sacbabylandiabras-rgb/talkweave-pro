import { createHmac, timingSafeEqual } from 'crypto';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
  const secret = process.env.SHOPIFY_CLIENT_SECRET || '';

  if (!hmacHeader) {
    return res.status(200).send('OK');
  }

  const body = JSON.stringify(req.body);
  const hash = createHmac('sha256', secret).update(body).digest('base64');

  try {
    const valid = timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
    if (!valid) {
      return res.status(401).send('Unauthorized');
    }
  } catch {
    return res.status(401).send('Unauthorized');
  }

  return res.status(200).send('OK');
}
