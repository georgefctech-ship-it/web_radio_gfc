export interface RadioStation {
  changeId: string;
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  state: string;
  language: string;
  votes: number;
  lastchangetime: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  lastchecktime: string;
  lastcheckoktime: string;
  lastlocalchecktime: string;
  clicktimestamp: string;
  clickcount: number;
  clicktrend: number;
  geo_lat: number | null;
  geo_long: number | null;
}

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Ensure we use the current origin to avoid protocol/host mismatches
    return `${window.location.origin}/api/radio`;
  }
  return '/api/radio';
};

const BASE_URL = getBaseUrl();
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased to 20s timeout per attempt
    
    try {
      console.log(`[RadioService] Fetching: ${url} (Attempt ${i + 1})`);
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) return response;
      
      const errorText = await response.text().catch(() => 'No error body');
      console.warn(`[RadioService] Fetch failed: ${response.status} ${response.statusText} - ${errorText}`);
      
      if ((response.status === 503 || response.status === 504 || response.status === 429) && i < retries - 1) {
        await new Promise(res => setTimeout(res, delay * (i + 1)));
        continue;
      }
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError';
      const errorMessage = err.message || 'Unknown network error';
      
      console.error(`[RadioService] ${isTimeout ? 'Timeout' : 'Network error'} on attempt ${i + 1}:`, errorMessage);
      
      if (i === retries - 1) throw err;
      // Exponential backoff
      await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries reached');
};

const FALLBACK_STATIONS: RadioStation[] = [
  {
    changeId: 'f1',
    stationuuid: 'f1',
    name: 'Antena 1 FM',
    url: 'https://stream.antena1.com.br/stream',
    url_resolved: 'https://stream.antena1.com.br/stream',
    homepage: 'https://www.antena1.com.br',
    favicon: 'https://www.antena1.com.br/favicon.ico',
    tags: 'Pop, Soft Rock',
    country: 'Brazil',
    countrycode: 'BR',
    state: 'São Paulo',
    language: 'Portuguese',
    votes: 1000,
    lastchangetime: new Date().toISOString(),
    codec: 'MP3',
    bitrate: 128,
    hls: 0,
    lastcheckok: 1,
    lastchecktime: new Date().toISOString(),
    lastcheckoktime: new Date().toISOString(),
    lastlocalchecktime: new Date().toISOString(),
    clicktimestamp: new Date().toISOString(),
    clickcount: 5000,
    clicktrend: 10,
    geo_lat: -23.5505,
    geo_long: -46.6333
  },
  {
    changeId: 'f2',
    stationuuid: 'f2',
    name: 'Jovem Pan FM',
    url: 'https://streaming.jovempan.com.br/pan-jp-fm',
    url_resolved: 'https://streaming.jovempan.com.br/pan-jp-fm',
    homepage: 'https://jovempan.com.br',
    favicon: 'https://jovempan.com.br/favicon.ico',
    tags: 'Pop, Rock, News',
    country: 'Brazil',
    countrycode: 'BR',
    state: 'São Paulo',
    language: 'Portuguese',
    votes: 900,
    lastchangetime: new Date().toISOString(),
    codec: 'MP3',
    bitrate: 128,
    hls: 0,
    lastcheckok: 1,
    lastchecktime: new Date().toISOString(),
    lastcheckoktime: new Date().toISOString(),
    lastlocalchecktime: new Date().toISOString(),
    clicktimestamp: new Date().toISOString(),
    clickcount: 4500,
    clicktrend: 5,
    geo_lat: -23.5505,
    geo_long: -46.6333
  }
];

export const radioService = {
  async getTopBrazilStations(): Promise<RadioStation[]> {
    const cacheKey = 'top_brazil';
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      return cache[cacheKey].data;
    }
    try {
      const response = await fetchWithRetry(`${BASE_URL}/stations/bycountrycodeexact/BR?order=clickcount&reverse=true&limit=250&hidebroken=true`);
      if (!response.ok) {
        throw new Error(`Failed to fetch stations: ${response.status}`);
      }
      const data: RadioStation[] = await response.json();
      cache[cacheKey] = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      console.error('Error fetching Brazil stations, using fallback:', error);
      return FALLBACK_STATIONS;
    }
  },

  async searchStations(query: string): Promise<RadioStation[]> {
    if (!query.trim()) return this.getTopBrazilStations();
    const cacheKey = `search_${query}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      return cache[cacheKey].data;
    }
    try {
      const response = await fetchWithRetry(`${BASE_URL}/stations/byname/${encodeURIComponent(query)}?limit=150&hidebroken=true`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        throw new Error(`Search failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      const data: RadioStation[] = await response.json();
      cache[cacheKey] = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      console.error('Error searching stations:', error);
      return [];
    }
  },

  async getStationsByTag(tag: string): Promise<RadioStation[]> {
    const cacheKey = `tag_${tag}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      return cache[cacheKey].data;
    }
    try {
      const response = await fetchWithRetry(`${BASE_URL}/stations/bytag/${encodeURIComponent(tag)}?limit=150&hidebroken=true&country=brazil`);
      if (!response.ok) throw new Error('Tag search failed');
      const data: RadioStation[] = await response.json();
      cache[cacheKey] = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      console.error('Error fetching stations by tag:', error);
      return [];
    }
  }
};
