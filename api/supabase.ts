import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
  const table = urlObj.pathname.replace('/api/supabase/', '');
  const query = urlObj.search;

  if (!table) {
    return res.status(400).json({ error: "Missing table" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://cnchoabsmggvdqvvhhcx.supabase.co";
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY2hvYWJzbWdndmRxdnZoaGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTQ0NjYsImV4cCI6MjA4NzkzMDQ2Nn0.nJf5hIqaHgZRVdLc9nZhsgT6g-vyT3iLjOOcaWdMLwk";
  
  const url = `${supabaseUrl}/rest/v1/${table}${query}`;

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch from Supabase", message: err.message });
  }
}
