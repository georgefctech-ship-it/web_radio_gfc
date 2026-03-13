import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const fallbackUrl = 'https://cnchoabsmggvdqvvhhcx.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY2hvYWJzbWdndmRxdnZoaGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTQ0NjYsImV4cCI6MjA4NzkzMDQ2Nn0.nJf5hIqaHgZRVdLc9nZhsgT6g-vyT3iLjOOcaWdMLwk';

// Helper to validate URL
const getValidUrl = (url: string | undefined): string | null => {
  if (!url || typeof url !== 'string' || url.trim() === '') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    return null;
  } catch {
    return null;
  }
};

// Determine the actual URL and Key to use
const finalUrl = getValidUrl(envUrl) || fallbackUrl;
const finalKey = (envKey && envKey.length > 10) ? envKey : fallbackKey;

console.log("[Supabase] Initializing with URL:", finalUrl);
if (finalUrl === fallbackUrl) {
  console.warn("[Supabase] Using fallback URL. Environment variables VITE_SUPABASE_URL might not be set.");
}

export const isSupabaseConfigured = !!getValidUrl(finalUrl);

export const supabase = createClient(
  finalUrl,
  finalKey
);
