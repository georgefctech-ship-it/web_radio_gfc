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
  
  const tryMirror = async (mirror: string, protocol: string) => {
    const url = `${protocol}://${mirror}/json/${pathPart}${query}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(url, { 
        signal: controller.signal as any,
        headers: { 
          'User-Agent': 'RadioGeorgeFctech/1.0 (georgefctech@gmail.com)',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  for (const mirror of shuffledMirrors) {
    try {
      const data = await tryMirror(mirror, 'https');
      return res.status(200).json(data);
    } catch (err) {
      try {
        const data = await tryMirror(mirror, 'http');
        return res.status(200).json(data);
      } catch (err2) {
        console.warn(`[Radio Proxy Vercel] Mirror Failed: ${mirror}`);
      }
    }
  }

  res.status(503).json({ 
    error: "Service Unavailable", 
    message: "Could not connect to any radio mirrors." 
  });
}
