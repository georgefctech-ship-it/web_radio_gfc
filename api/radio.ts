import type { VercelRequest, VercelResponse } from '@vercel/node';

const verifiedMirrors = [
  "de1.api.radio-browser.info",
  "fr1.api.radio-browser.info",
  "nl1.api.radio-browser.info",
  "at1.api.radio-browser.info",
  "ca1.api.radio-browser.info",
  "all.api.radio-browser.info"
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract the path after /api/radio/
  // req.url will be something like /api/radio/stations/bycountrycodeexact/BR?...
  const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
  const pathPart = urlObj.pathname.replace('/api/radio/', '');
  const query = urlObj.search;

  if (!pathPart) {
    return res.status(400).json({ error: "Missing path" });
  }

  console.log(`[Radio Proxy Vercel] Requesting: ${pathPart} | Query: ${query}`);

  const shuffledMirrors = [...verifiedMirrors].sort(() => Math.random() - 0.5);
  
  const tryMirror = async (mirror: string, protocol: string, signal: AbortSignal) => {
    const url = `${protocol}://${mirror}/json/${pathPart}${query}`;
    const response = await fetch(url, { 
      signal: signal as any,
      headers: { 
        'User-Agent': 'RadioGeorgeFctech/1.0 (georgefctech@gmail.com)',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }
    
    return await response.json();
  };

  // Try in batches of 3 mirrors (6 requests: 3 HTTPS, 3 HTTP)
  const batchSize = 3;
  for (let i = 0; i < shuffledMirrors.length; i += batchSize) {
    const batch = shuffledMirrors.slice(i, i + batchSize);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s per batch

    try {
      const promises = batch.flatMap(m => [
        tryMirror(m, 'https', controller.signal),
        tryMirror(m, 'http', controller.signal)
      ]);

      const result = await Promise.any(promises);
      clearTimeout(timeoutId);
      controller.abort();
      return res.status(200).json(result);
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[Radio Proxy Vercel] Batch ${i/batchSize + 1} failed`);
    }
  }

  res.status(503).json({ 
    error: "Service Unavailable", 
    message: "Could not connect to any radio mirrors." 
  });
}
